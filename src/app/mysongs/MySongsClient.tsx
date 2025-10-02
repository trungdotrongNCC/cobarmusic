"use client";

import { useEffect, useRef, useState } from "react";
import Tabs from "@/components/Tabs";

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
  playUrl: string;          // không dùng trực tiếp nữa, sẽ gọi /stream
  avatar?: string | null;
};

const PLAYER_H = 96;

function formatTime(sec: number) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function SongsListClient({ initialSongs }: { initialSongs: SongDTO[] }) {
  const [songs] = useState<SongDTO[]>(initialSongs);
  const [index, setIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const [loadingStream, setLoadingStream] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const current = index !== null ? songs[index] : null;
  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < songs.length - 1;

  // Lấy signed URL và phát bài
  useEffect(() => {
    let cancelled = false;
    async function loadAndPlay() {
      if (!current || !audioRef.current) return;
      setLoadingStream(true);
      setStreamError(null);
      const a = audioRef.current;

      // helper fetch signed url
      async function getSigned(kind: "full" | "preview") {
        const r = await fetch(`/api/songs/${current.id}/stream?kind=${kind}`, { cache: "no-store" });
        if (!r.ok) {
          const errText = await r.text().catch(() => "");
          throw new Error(`${r.status}:${errText || "stream error"}`);
        }
        const data = await r.json();
        if (!data?.url) throw new Error("missing url");
        return data.url as string;
      }

      try {
        // Ưu tiên full (vì Library = đã mua). Nếu lỗi quyền/khác → fallback preview
        let url: string;
        try {
          url = await getSigned("full");
        } catch (e) {
          // nếu lỗi 401/403/404 thì thử preview
          url = await getSigned("preview");
        }
        if (cancelled) return;

        a.src = url;
        a.load();
        await a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        setLoadingStream(false);

        // log listen
        fetch(`/api/songs/${current.id}/listen`, { method: "POST" }).catch(() => {});
      } catch (err: any) {
        if (cancelled) return;
        setLoadingStream(false);
        setPlaying(false);
        setStreamError(err?.message || "Stream failed");
      }
    }

    loadAndPlay();

    return () => {
      cancelled = true;
    };
  }, [index, current?.id]);

  // bind event
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrentTime(a.currentTime || 0);
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => {
      if (hasNext) setIndex((i) => (i === null ? 0 : i + 1));
      else setPlaying(false);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [hasNext]);

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().then(() => setPlaying(true));
    else {
      a.pause();
      setPlaying(false);
    }
  }

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
          {songs.map((s, i) => (
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
                    title="Play"
                    onClick={() => setIndex(i)}
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
                      opacity: 0,
                      pointerEvents: "none",
                      transition: "opacity .15s ease",
                      cursor: "pointer",
                    }}
                  >
                    ▶
                  </button>
                </div>

                <div>
                  <div style={{ fontWeight: 700 }}>{s.title}</div>
                  <div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>
                    {s.genres.map((g) => g.name).join(", ") || "—"} • {s.listens} listens
                  </div>
                </div>
              </div>

              {/* (ĐÃ XOÁ NÚT BUY) */}
            </div>
          ))}
        </div>
      </main>

      {/* PLAYER — chừa chỗ sidebar bằng CSS var */}
      {current && (
        <div
          style={{
            position: "fixed",
            left: "var(--sidebar-w)" as any,
            right: 0,
            bottom: 0,
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
                <div style={{ fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{current.title}</div>
                <div style={{ color: "#bbb", fontSize: 12, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                  {current.seller?.name || current.seller?.email || "Anonymous"} &nbsp;|&nbsp;{" "}
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
                  }}
                  title="Seek"
                  style={{ width: 360, accentColor: "#fff", height: 4, marginTop: 6 }}
                />
                {loadingStream && (
                  <div style={{ fontSize: 12, color: "#bbb", marginTop: 6 }}>Loading audio…</div>
                )}
                {streamError && (
                  <div style={{ fontSize: 12, color: "#f87171", marginTop: 6 }}>{streamError}</div>
                )}
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
                title={playing ? "Pause" : "Play"}
                style={{
                  fontSize: 28,
                  background: "none",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                {playing ? "⏸" : "▶"}
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

          <audio ref={audioRef} />
        </div>
      )}

      <style jsx>{`
        .cover:hover .overlay { opacity: 1 !important; pointer-events: auto !important; }
      `}</style>
    </div>
  );
}
