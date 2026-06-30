"use client";
import Link from "next/link";

import { useEffect, useRef, useState } from "react";
import Tabs from "@/components/Tabs";
import LoginModal from "@/components/LoginModal";
import toast from "react-hot-toast";

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
  previewPath: string;
  avatar?: string | null;
};

const PLAYER_H = 96;

function formatTime(sec: number) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Hiển thị giá đẹp (ưu tiên VND; nếu string đã định dạng sẵn thì giữ nguyên)
function formatPriceVND(p: string | number) {
  if (typeof p === "number") {
    return new Intl.NumberFormat("vi-VN").format(p) + "₫";
  }
  const num = Number(p);
  if (!Number.isNaN(num) && String(num) === p.trim()) {
    return new Intl.NumberFormat("vi-VN").format(num) + "₫";
  }
  return p;
}

export default function SongsListClient({ initialSongs }: { initialSongs: SongDTO[] }) {
  const [songs, setSongs] = useState<SongDTO[]>(initialSongs);
  const [index, setIndex] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // refs để đọc giá trị mới nhất trong event handler
  const indexRef = useRef<number | null>(index);
  const songsRef = useRef<SongDTO[]>(songs);
  useEffect(() => { indexRef.current = index; }, [index]);
  useEffect(() => { songsRef.current = songs; }, [songs]);

  // ==== đếm lượt nghe (mỗi bài 1 lần/phiên, khi > 10s) ====
  const listenedSetRef = useRef<Set<number>>(new Set()); // lưu các id đã đếm trong phiên
  const listenFiredRef = useRef<boolean>(false);         // cờ cho bài hiện tại

  // UI states
  const [, forceTick] = useState(0); // ép re-render (đọc paused từ <audio>)
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [loadingStream, setLoadingStream] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);

  // interval cập nhật tiến độ (fallback nếu timeupdate thưa)
  const progressIntervalRef = useRef<number | null>(null);
  const startProgress = () => {
    stopProgress();
    progressIntervalRef.current = window.setInterval(() => {
      const a = audioRef.current;
      if (!a) return;
      setCurrentTime(a.currentTime || 0);
    }, 100); // 10 lần/giây
  };
  const stopProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const current = index !== null ? songs[index] : null;

  // đồng bộ volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ===== LOAD PREVIEW (Blob → ObjectURL) =====
  useEffect(() => {
    let cancelled = false;

    async function loadAndPlayPreview() {
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

      setLoadingStream(true);
      setStreamError(null);
      setDuration(0);
      setCurrentTime(0);
      listenFiredRef.current = false; // reset cờ đếm khi đổi bài
      forceTick((n) => n + 1); // cập nhật icon ngay

      try {
        // 1) get signed url from server
        const r = await fetch(`/api/songs/${current.id}/stream?kind=full`, {
          cache: "no-store",
          signal,
        });
        if (!r.ok) throw new Error(await r.text().catch(() => "stream error"));
        const data = await r.json();
        const signed: string | undefined = data?.url;
        if (!signed) throw new Error("missing url");
        if (cancelled) return;

        // 2) stream directly — no blob download needed
        a.src = signed;
        a.preload = "metadata";
        a.load();

        await new Promise<void>((resolve, reject) => {
          const onMeta = () => {
            setDuration(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : 0);
            resolve();
          };
          const onErr = () => reject(a.error || new Error("audio error"));
          a.addEventListener("loadedmetadata", onMeta, { once: true });
          a.addEventListener("error", onErr, { once: true });
        });

        if (cancelled) return;

        await a.play();
        startProgress();
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

    loadAndPlayPreview();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
      stopProgress();
      if (false) { // objectUrl no longer used
        objectUrlRef.current = null;
      }
    };
  }, [index, current?.id]);

  // ===== AUDIO EVENTS: sync tiến độ + icon =====
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onPlay = () => {
      startProgress();
      forceTick((n) => n + 1);
    };

    const onPause = () => {
      stopProgress();
      forceTick((n) => n + 1);
    };

    const onEnded = () => {
      a.pause();
      stopProgress();
      setCurrentTime(0);
      forceTick((n) => n + 1);

      // next track nếu còn
      const i = indexRef.current;
      const arr = songsRef.current;
      if (i !== null && i < arr.length - 1) {
        setIndex(i + 1);
      }
    };

    const onTimeUpdate = () => setCurrentTime(a.currentTime || 0);
    const onLoadedMeta = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);

    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("timeupdate", onTimeUpdate);
    a.addEventListener("loadedmetadata", onLoadedMeta);

    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("timeupdate", onTimeUpdate);
      a.removeEventListener("loadedmetadata", onLoadedMeta);
      stopProgress();
    };
  }, []);

  // ===== Đếm lượt nghe: khi nghe > 10s, gửi 1 lần/bài/phiên =====
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !current) return;

    if (listenedSetRef.current.has(current.id)) return; // đã đếm trong phiên

    const checkAndFire = () => {
      if (!current) return;
      const t = a.currentTime || 0;
      if (t >= 10 && !listenFiredRef.current) {
        listenFiredRef.current = true;
        listenedSetRef.current.add(current.id);

        // Fire & forget
        fetch(`/api/songs/${current.id}/listen`, { method: "POST" }).catch(() => {});

        // (Optional) Optimistic UI: +1 ngay
        setSongs((prev) =>
          prev.map((it) => (it.id === current.id ? { ...it, listens: it.listens + 1 } : it))
        );
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
    if (a.paused) {
      a.play();
      startProgress();
    } else {
      a.pause();
      stopProgress();
    }
    forceTick((n) => n + 1);
  }

  async function reloadSongs() {
    const res = await fetch("/api/songs?limit=100&offset=0", { cache: "no-store" });
    const data = await res.json();
    setSongs(data.items);
  }

  async function toggleSave(songId: number, currentlyOwned: boolean) {
    setSavingId(songId);
    try {
      const method = currentlyOwned ? "DELETE" : "POST";
      const r = await fetch(`/api/songs/${songId}/save`, { method });
      if (r.status === 401) { setShowLogin(true); return; }
      if (!r.ok) { toast.error("Failed to update library"); return; }
      setSongs((prev) =>
        prev.map((s) => s.id === songId ? { ...s, owned: !currentlyOwned } : s)
      );
      toast.success(currentlyOwned ? "Removed from My Songs" : "Added to My Songs");
    } catch {
      toast.error("Network error");
    } finally {
      setSavingId(null);
    }
  }

  // trạng thái thực từ <audio> để render icon/animation
  const isPlayingNow = audioRef.current ? !audioRef.current.paused : false;

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff" }}>
      {/* CONTENT */}
      <main
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "24px 16px",
          paddingBottom: `calc(var(--bottom-nav-h, 0px) + ${current ? PLAYER_H + 24 : 24}px)`,
          transition: "padding-bottom .2s ease",
        }}
      >
       <h1 className="text-3xl md:text-[42px] font-extrabold tracking-tight mb-3 text-[#9b5cff] animate-bounce">
  Cobar Music Shop
</h1>
        <p className="text-sm text-[#a084ff] font-semibold animate-pulse">
  Quẹt Mezon ở Cobar Shop xong, nhớ ghé thư viện nghe nhạc full chill nha!
</p>
        <Tabs className="mb-6" tabs={[{ label: "Songs", href: "/" }, { label: "Playlists", comingSoon: true }]} />

        {/* List */}
        <div style={{ display: "grid", gap: 12 }}>
          {songs.map((s, i) => {
            const isCurrent = index === i;
            const showEqualizer = isCurrent && isPlayingNow;

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
                      title={showEqualizer ? "Pause" : "Play"}
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
                      {showEqualizer ? (
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

                  <div>
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
                  <div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>
                     {s.genres.map((g) => g.name).join(", ") || "—"} • {s.listens} listens
                   </div>
                </div>
                </div>

                {/* right: Add to My Songs toggle */}
                <button
                  onClick={() => toggleSave(s.id, s.owned)}
                  disabled={savingId === s.id}
                  className="buy-btn"
                  title={s.owned ? "Remove from My Songs" : "Add to My Songs"}
                >
                  {savingId === s.id ? "…" : s.owned ? "✓ In My Songs" : "+ Add to My Songs"}
                </button>
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
                onClick={() => {
                  const i = indexRef.current;
                  if (i === null) return;
                  setIndex(Math.max(0, i - 1));
                }}
                disabled={index === null || index <= 0}
                title="Prev"
                style={{ fontSize: 24, background: "none", border: "none", color: "#fff", cursor: index !== null && index > 0 ? "pointer" : "not-allowed", opacity: index !== null && index > 0 ? 1 : 0.4 }}
              >
                ⏮
              </button>
              <button
                onClick={togglePlay}
                title={isPlayingNow ? "Pause" : "Play"}
                style={{ fontSize: 28, background: "none", border: "none", color: "#fff", cursor: "pointer" }}
              >
                {isPlayingNow ? "⏸" : "▶"}
              </button>
              <button
                onClick={() => {
                  const i = indexRef.current;
                  const arr = songsRef.current;
                  if (i === null) return;
                  if (i < arr.length - 1) setIndex(i + 1);
                }}
                disabled={index === null || index >= songs.length - 1}
                title="Next"
                style={{ fontSize: 24, background: "none", border: "none", color: "#fff", cursor: index !== null && index < songs.length - 1 ? "pointer" : "not-allowed", opacity: index !== null && index < songs.length - 1 ? 1 : 0.4 }}
              >
                ⏭
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

      {/* Modal yêu cầu login */}
      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        nextPath={typeof window !== "undefined" ? window.location.pathname : "/"}
      />

      <style jsx>{`
        .cover:hover .overlay {
          opacity: 1 !important;
          pointer-events: auto !important;
        }
        /* Equalizer animation khi đang phát */
        .eq {
          display: inline-flex;
          align-items: flex-end;
          gap: 3px;
          height: 16px;
        }
        .bar {
          width: 3px;
          height: 100%;
          background: #fff;
          transform-origin: bottom;
          animation: eq-bounce 0.8s ease-in-out infinite;
        }
        .b1 { animation-delay: 0s; }
        .b2 { animation-delay: 0.1s; }
        .b3 { animation-delay: 0.2s; }
        @keyframes eq-bounce {
          0%   { transform: scaleY(0.35); }
          50%  { transform: scaleY(1); }
          100% { transform: scaleY(0.35); }
        }
        .song-title-link:hover {
        text-decoration: underline;
         text-decoration-thickness: 1px;
         text-underline-offset: 2px;
        }
        /* Give Coffee gradient like login */
        .buy-btn {
          appearance: none;
          border: none;
          color: #fff;
          font-weight: 600;
          padding: 10px 16px;
          border-radius: 10px;
          background-image: linear-gradient(90deg, #9b5cff 0%, #5a6bff 100%);
          box-shadow: 0 6px 18px rgba(133, 92, 255, 0.35);
          transition: transform .08s ease, box-shadow .2s ease, filter .2s ease;
          cursor: pointer;
          white-space: nowrap;
        }
        .buy-btn:hover {
          filter: brightness(1.05);
          box-shadow: 0 8px 22px rgba(133, 92, 255, 0.5);
        }
        .buy-btn:active {
          transform: translateY(1px);
        }
        .buy-btn:focus-visible {
          outline: 2px solid rgba(133, 92, 255, 0.8);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
