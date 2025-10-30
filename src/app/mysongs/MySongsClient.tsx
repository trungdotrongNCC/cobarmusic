"use client";

import { useEffect, useRef, useState } from "react";
import Tabs from "@/components/Tabs";
import Link from "next/link";
type Genre = { id: number; name: string };
type Seller = { id: number; email: string; name: string | null } | null;
type SongDTO = {
  id: number;
  title: string;
  description?: string | null;
  price: string | number;
  listens: number;
  createdAt: string | Date;
  genres: Genre[];
  seller: Seller;
  owned: boolean;
  playUrl: string; // không dùng trực tiếp nữa, sẽ gọi /stream
  avatar?: string | null;
};

const PLAYER_H = 96;

function formatTime(sec: number) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

type RepeatMode = "off" | "all" | "one";

export default function SongsListClient({ initialSongs }: { initialSongs: SongDTO[] }) {
  const [songs] = useState<SongDTO[]>(initialSongs);
  const [index, setIndex] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // refs chống stale trong event handlers
  const indexRef = useRef<number | null>(index);
  const songsRef = useRef<SongDTO[]>(songs);
  useEffect(() => { indexRef.current = index; }, [index]);
  useEffect(() => { songsRef.current = songs; }, [songs]);

  // ==== listen state: đếm 1 lần / mỗi lượt phát (khi >10s) ====
  const listenFiredRef = useRef<boolean>(false); // cờ cho lượt phát hiện tại

  // UI state
  const [, forceTick] = useState(0); // ép re-render (đọc paused từ <audio>)
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [loadingStream, setLoadingStream] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");

  const progressIntervalRef = useRef<number | null>(null);
  const startProgress = () => {
    stopProgress();
    progressIntervalRef.current = window.setInterval(() => {
      const a = audioRef.current;
      if (!a) return;
      setCurrentTime(a.currentTime || 0);
    }, 100);
  };
  const stopProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const current = index !== null ? songs[index] : null;
  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < songs.length - 1;

  // đồng bộ volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ===== LẤY SIGNED URL → TẢI BLOB (ưu tiên full, fallback preview) → PHÁT =====
  useEffect(() => {
    let cancelled = false;

    async function loadAndPlay() {
      const a = audioRef.current;
      if (!current || !a) return;

      // cleanup nguồn cũ
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      stopProgress();
      a.pause();
      if (a.src) a.removeAttribute("src");
      a.load();

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      setLoadingStream(true);
      setStreamError(null);
      setDuration(0);
      setCurrentTime(0);
      listenFiredRef.current = false; // reset cờ đếm cho lượt phát mới
      forceTick((n) => n + 1);

      // helper: lấy signed url
      async function getSigned(kind: "full" | "preview") {
        const r = await fetch(`/api/songs/${current.id}/stream?kind=${kind}`, {
          cache: "no-store",
          signal,
        });
        if (!r.ok) {
          const t = await r.text().catch(() => "");
          throw new Error(`${r.status}:${t || "stream error"}`);
        }
        const data = await r.json();
        const url = data?.url as string | undefined;
        if (!url) throw new Error("missing url");
        return url;
      }

      try {
        // Ưu tiên full (đã mua). Nếu không quyền/khác → fallback preview
        let signedUrl: string;
        try {
          signedUrl = await getSigned("full");
        } catch {
          signedUrl = await getSigned("preview");
        }
        if (cancelled) return;

        // tải blob để có duration/seek chuẩn
        const resp = await fetch(signedUrl, { mode: "cors", cache: "no-store", signal });
        if (!resp.ok) throw new Error("download audio failed");
        const blob = await resp.blob();
        if (cancelled) return;

        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        a.crossOrigin = "anonymous";
        a.preload = "metadata";
        a.src = url;

        await new Promise<void>((resolve, reject) => {
          const onLoadedMeta = () => {
            a.removeEventListener("loadedmetadata", onLoadedMeta);
            const d = a.duration;
            setDuration(Number.isFinite(d) && d > 0 ? d : 0);
            resolve();
          };
          const onErr = () => {
            a.removeEventListener("loadedmetadata", onLoadedMeta);
            reject(a.error);
          };
          a.addEventListener("loadedmetadata", onLoadedMeta, { once: true });
          a.addEventListener("error", onErr, { once: true });
          a.load();
        });

        if (cancelled) return;

        await a.play();  // event 'play' sẽ bật interval
        startProgress(); // bật ngay nếu event đến chậm
        setLoadingStream(false);
        forceTick((n) => n + 1);
      } catch (err: any) {
        if (!cancelled && err?.name !== "AbortError") {
          setStreamError(err?.message || "Stream failed");
          setLoadingStream(false);
          stopProgress();
          forceTick((n) => n + 1);
        }
      }
    }

    loadAndPlay();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
      stopProgress();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [index, current?.id]);

  // ===== Sự kiện audio: sync tiến độ + icon + next/replay =====
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onPlay = () => { startProgress(); forceTick((n) => n + 1); };
    const onPause = () => { stopProgress(); forceTick((n) => n + 1); };
    const onEnded = () => {
      // Hết bài → xử lý theo repeatMode
      const i = indexRef.current;
      const arr = songsRef.current;
      if (i == null) return;

      if (repeatMode === "one") {
        // phát lại bài hiện tại, giữ nguyên objectURL
        listenFiredRef.current = false; // lượt phát mới → cho phép đếm lại
        a.currentTime = 0;
        a.play().catch(() => {});
        startProgress();
        setCurrentTime(0);
        forceTick((n) => n + 1);
        return;
      }

      // next bài hoặc xử lý loop all
      if (i < arr.length - 1) {
        setIndex(i + 1);
      } else if (repeatMode === "all") {
        setIndex(0);
      } else {
        // off: dừng
        a.pause();
        stopProgress();
        setCurrentTime(0);
        forceTick((n) => n + 1);
      }
    };
    const onTime = () => setCurrentTime(a.currentTime || 0);
    const onMeta = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);

    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);

    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      stopProgress();
    };
  }, [repeatMode]); // phụ thuộc repeatMode để lấy giá trị mới nhất trong onEnded

  // ===== Đếm lượt nghe: >10s, mỗi lượt phát chỉ gửi 1 lần =====
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !current) return;

    const checkAndFire = () => {
      if (!current) return;
      const t = a.currentTime || 0;
      if (t >= 10 && !listenFiredRef.current) {
        listenFiredRef.current = true;
        // Fire & forget
        fetch(`/api/songs/${current.id}/listen`, { method: "POST" }).catch(() => {});
      }
    };

    a.addEventListener("timeupdate", checkAndFire);
    const iv = window.setInterval(checkAndFire, 1000);
    return () => {
      a.removeEventListener("timeupdate", checkAndFire);
      clearInterval(iv);
    };
  }, [current?.id]);

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); startProgress(); }
    else { a.pause(); stopProgress(); }
    forceTick((n) => n + 1);
  }

  // trạng thái thực để render icon/animation
  const isPlayingNow = audioRef.current ? !audioRef.current.paused : false;

  // Cycle repeat mode: off → all → one → off
  const cycleRepeat = () =>
    setRepeatMode((m) => (m === "off" ? "all" : m === "all" ? "one" : "off"));

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff" }}>
      {/* CONTENT */}
      <main
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "24px 16px",
          paddingBottom: current ? PLAYER_H + 24 : 24,
          transition: "padding-bottom .2s ease",
        }}
      >
        {/* Title + Tabs */}
        <h1 className="text-3xl md:text-[42px] font-semibold tracking-tight mb-3">Library</h1>
        <Tabs
          className="mb-6"
          tabs={[
            { label: "Songs", href: "/" },        // marketplace
            { label: "Playlists", comingSoon: true },
          ]}
        />

        {/* List các bài đã sở hữu */}
        <div style={{ display: "grid", gap: 12 }}>
          {songs.map((s, i) => {
            const isCurrent = index === i;
            const showEq = isCurrent && isPlayingNow;

            return (
              <div
                key={s.id}
                className="song-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "12px 16px",
                  border: "1px solid #222",
                  borderRadius: 12,
                  background: "#111",
                }}
              >
                {/* left: avatar + info */}
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div className="cover" style={{ position: "relative", width: 56, height: 56 }}>
                    <img
                      src={s.avatar || "/default-avatar.png"}
                      alt={s.title}
                      style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                    />
                    <button
                      className="overlay"
                      title={showEq ? "Pause" : "Play"}
                      onClick={() => (isCurrent ? togglePlay() : setIndex(i))}
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        background: "rgba(0,0,0,.55)",
                        color: "#fff",
                        border: "none",
                        fontSize: 22,
                        opacity: 1,
                        cursor: "pointer",
                        transition: "opacity .15s ease",
                      }}
                    >
                      {showEq ? (
                        <span className="eq">
                          <span className="bar b1" />
                          <span className="bar b2" />
                          <span className="bar b3" />
                        </span>
                      ) : (
                        "▶"
                      )}
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <Link
  href={`/songs/${s.id}`}
  style={{
    fontWeight: 700,
    color: "#fff",
    cursor: "pointer",
    textDecoration: "none",
  }}
  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
>
  {s.title}
                    </Link>
                    <div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 6 }}>
                      {s.genres.map((g) => g.name).join(", ") || "—"} • {s.listens} listens
                    </div>
                  </div>
                </div>

                {/* (Library: không có nút Buy) */}
              </div>
            );
          })}
        </div>
      </main>

      {/* PLAYER */}
      {current && (
        <div
          style={{
            position: "fixed",
            left: "var(--sidebar-w)" as any,
            right: 0,
            bottom: "var(--bottom-nav-h, 0px)",
            height: PLAYER_H,
            background: "#171717",
            borderTop: "1px solid #262626",
            zIndex: 60,
            color: "#fff",
          }}
        >
          <div
            style={{
              height: "100%",
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              alignItems: "center",
              gap: 16,
              padding: "12px 16px",
            }}
          >
            {/* LEFT */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <div style={{ width: 52, height: 52, borderRadius: 8, overflow: "hidden", border: "1px solid #333", flex: "0 0 52px" }}>
                <img src={current.avatar || "/default-avatar.png"} alt={current.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ lineHeight: 1.2, overflow: "hidden" }}>
                <div style={{ fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                  {current.title}
                </div>
                <div style={{ color: "#bbb", fontSize: 12, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                  {current.seller?.name || current.seller?.email || "Anonymous"}&nbsp;|&nbsp;
                  <span style={{ color: "#eee" }}>{formatTime(currentTime)}</span> / {formatTime(duration)}
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={Math.min(currentTime, duration || 0)}
                  onChange={(e) => {
                    const a = audioRef.current;
                    if (!a) return;
                    const v = Number(e.target.value);
                    a.currentTime = v;
                    setCurrentTime(v);
                    forceTick((n) => n + 1);
                  }}
                  title="Seek"
                  style={{ width: 360, accentColor: "#fff", height: 4, marginTop: 6 }}
                />
                {loadingStream && <div style={{ fontSize: 12, color: "#bbb", marginTop: 6 }}>Loading audio…</div>}
                {streamError && <div style={{ fontSize: 12, color: "#f87171", marginTop: 6 }}>{streamError}</div>}
              </div>
            </div>

            {/* CENTER */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22 }}>
              <button
                onClick={() => hasPrev && setIndex((i) => (i === null ? 0 : i - 1))}
                disabled={!hasPrev}
                title="Prev"
                style={{
                  fontSize: 24,
                  background: "none",
                  border: "none",
                  color: "#fff",
                  cursor: hasPrev ? "pointer" : "not-allowed",
                  opacity: hasPrev ? 1 : 0.4,
                }}
              >
                ⏮
              </button>
              <button
                onClick={togglePlay}
                title={audioRef.current && !audioRef.current.paused ? "Pause" : "Play"}
                style={{ fontSize: 28, background: "none", border: "none", color: "#fff", cursor: "pointer" }}
              >
                {audioRef.current && !audioRef.current.paused ? "⏸" : "▶"}
              </button>
              <button
                onClick={() => hasNext && setIndex((i) => (i === null ? 0 : i + 1))}
                disabled={!hasNext}
                title="Next"
                style={{
                  fontSize: 24,
                  background: "none",
                  border: "none",
                  color: "#fff",
                  cursor: hasNext ? "pointer" : "not-allowed",
                  opacity: hasNext ? 1 : 0.4,
                }}
              >
                ⏭
              </button>

              {/* REPEAT MODE */}
              <button
                onClick={cycleRepeat}
                title={
                  repeatMode === "off" ? "Repeat: off" :
                  repeatMode === "all" ? "Repeat: all" : "Repeat: one"
                }
                className="repeat-btn"
                aria-label="Repeat mode"
              >
                {/* icon ↻/🔁 + badge 1 khi repeat-one */}
                <span className="repeat-icon">🔁</span>
                {repeatMode === "one" && <span className="repeat-badge">1</span>}
                {/* viền highlight khi đang bật */}
                <span className={`repeat-ring ${repeatMode !== "off" ? "on" : ""}`} />
              </button>
            </div>

            {/* RIGHT */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
              <span style={{ color: "#fff", fontSize: 16 }}>{volume === 0 ? "🔇" : "🔊"}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  if (audioRef.current) audioRef.current.volume = v;
                }}
                style={{ width: 160, accentColor: "#fff", height: 4 }}
                title="Volume"
              />
            </div>
          </div>

          <audio ref={audioRef} crossOrigin="anonymous" preload="metadata" playsInline />
        </div>
      )}

      <style jsx>{`
        .cover:hover .overlay { opacity: 1 !important; pointer-events: auto !important; }
        /* Equalizer animation khi đang phát */
        .eq { display: inline-flex; align-items: flex-end; gap: 3px; height: 16px; }
        .bar { width: 3px; height: 100%; background: #fff; transform-origin: bottom; animation: eq-bounce 0.8s ease-in-out infinite; }
        .b1 { animation-delay: 0s; }
        .b2 { animation-delay: 0.1s; }
        .b3 { animation-delay: 0.2s; }
        @keyframes eq-bounce {
          0% { transform: scaleY(0.35); }
          50% { transform: scaleY(1); }
          100% { transform: scaleY(0.35); }
        }

        /* Repeat button styling */
        .song-title-link:hover {
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 2px;
        }
        .repeat-btn {
          position: relative;
          background: none;
          border: none;
          color: #fff;
          font-size: 20px;
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .repeat-icon {
          line-height: 1;
          pointer-events: none;
        }
        .repeat-badge {
          position: absolute;
          right: -2px;
          top: -2px;
          font-size: 10px;
          background: #22c55e;
          color: #000;
          border-radius: 999px;
          padding: 0 4px;
          font-weight: 700;
          border: 1px solid #0a0a0a;
        }
        .repeat-ring {
          position: absolute;
          inset: 0;
          border-radius: 8px;
          box-shadow: 0 0 0 0 rgba(147, 95, 255, 0);
          transition: box-shadow .2s ease;
          pointer-events: none;
        }
        .repeat-ring.on {
          box-shadow: 0 0 0 2px rgba(147, 95, 255, .8);
        }
      `}</style>
    </div>
  );
}
