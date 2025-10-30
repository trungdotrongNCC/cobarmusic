"use client";

import { useEffect, useRef, useState } from "react";
import LoginModal from "@/components/LoginModal";
import PaymentQRModal from "@/components/PaymentQRModal";
import toast from "react-hot-toast";

// ===== Types =====
type Genre = { id: number; name: string };
type Seller = { id: number; email: string; name: string | null } | null;
type CommentDTO = {
  id: number;
  content: string;
  createdAt: string | Date;
  user: { id: number; name: string } | null;
};
type SongDTO = {
  id: number;
  title: string;
  description?: string | null;
  lyric?: string | null;
  price: string | number;
  listens: number;
  createdAt: string | Date;
  genres: Genre[];
  seller: Seller;
  owned: boolean;
  previewPath: string;       // path gốc (backend sẽ ký URL)
  avatar?: string | null;
  fullPath?: string | null;  // chỉ có khi owned
  comments?: CommentDTO[];
};

const PLAYER_H = 96;

// ===== Utils =====
function formatTime(sec: number) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
function formatPriceVND(p: string | number) {
  if (typeof p === "number") return new Intl.NumberFormat("vi-VN").format(p) + "₫";
  const num = Number(p);
  if (!Number.isNaN(num) && String(num) === String(p).trim()) {
    return new Intl.NumberFormat("vi-VN").format(num) + "₫";
  }
  return String(p);
}

// ===== Component =====
export default function SongDetailsClient({ initialSong }: { initialSong: SongDTO }) {
  const [song, setSong] = useState<SongDTO>(initialSong);

  // Audio refs/state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const listenedOnceRef = useRef<boolean>(false);

  const [, forceTick] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [loadingStream, setLoadingStream] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // UI: auth + payment
  const [showLogin, setShowLogin] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrString, setQrString] = useState("");
  const [paymentSessionId, setPaymentSessionId] = useState("");

  // Comments input
  const [commentValue, setCommentValue] = useState("");

  // progress fallback
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

  // sync volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ===== LOAD AUDIO (preview hoặc full theo owned) =====
  useEffect(() => {
    let cancelled = false;

    async function loadAudio() {
      const a = audioRef.current;
      if (!a) return;

      // cleanup trước
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
      listenedOnceRef.current = false;
      forceTick((n) => n + 1);

      try {
        const kind = song.owned ? "full" : "preview";
        const r = await fetch(`/api/songs/${song.id}/stream?kind=${kind}`, {
          cache: "no-store",
          signal,
        });
        if (!r.ok) throw new Error(await r.text().catch(() => "stream error"));
        const data = await r.json();
        const signed: string | undefined = data?.url;
        if (!signed) throw new Error("missing url");
        if (cancelled) return;

        const resp = await fetch(signed, { mode: "cors", cache: "no-store", signal });
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
            setDuration(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : 0);
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

    loadAudio();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      stopProgress();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [song.id, song.owned]);

  // ===== AUDIO EVENTS =====
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

  // ===== ĐẾM LISTEN > 10S (1 lần) =====
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const checkAndFire = () => {
      const t = a.currentTime || 0;
      if (t >= 10 && !listenedOnceRef.current) {
        listenedOnceRef.current = true;
        fetch(`/api/songs/${song.id}/listen`, { method: "POST" }).catch(() => {});
        setSong((prev) => ({ ...prev, listens: prev.listens + 1 }));
      }
    };

    a.addEventListener("timeupdate", checkAndFire);
    const iv = window.setInterval(checkAndFire, 1000);
    return () => {
      a.removeEventListener("timeupdate", checkAndFire);
      clearInterval(iv);
    };
  }, [song.id]);

  const isPlayingNow = audioRef.current ? !audioRef.current.paused : false;

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

  async function handlePaymentSuccess() {
    setSong((prev) => ({ ...prev, owned: true }));
    toast.success("Mua thành công! Đang phát bản full…", { duration: 6000, icon: "🎵" });
    setQrOpen(false);
  }

  async function buySong(songId: number) {
    try {
      const r = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ songId }),
      });
      if (r.status === 401 || r.status === 403) {
        setShowLogin(true);
        return;
      }
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        alert(e?.error || "Create payment failed");
        return;
      }
      const data = await r.json();
      setQrString(data.qrString);
      setPaymentSessionId(data.sessionId);
      setQrOpen(true);
    } catch {
      alert("Create payment error");
    }
  }

  async function submitComment() {
    const content = commentValue.trim();
    if (!content) return;
    try {
      const res = await fetch(`/api/songs/${song.id}/comment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.status === 401 || res.status === 403) {
        setShowLogin(true);
        return;
      }
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        toast.error(e?.error || "Comment failed");
        return;
      }
      const newComment: CommentDTO = await res.json();
      setSong((prev) => ({
        ...prev,
        comments: [newComment, ...(prev.comments || [])],
      }));
      setCommentValue("");
    } catch {
      toast.error("Comment error");
    }
  }

  // ===== Render =====
  return (
    <div
      style={{
        // chừa chỗ cho bottom menu + player
        paddingBottom: `calc(var(--bottom-nav-h, 0px) + ${PLAYER_H}px)`,
        transition: "padding-bottom .2s ease",
      }}
    >
      {/* HEADER CARD */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "140px 1fr",
          gap: 16,
          padding: "16px",
          border: "1px solid #222",
          borderRadius: 12,
          background: "#111",
        }}
      >
        <div style={{ position: "relative", width: 140, height: 140 }}>
          <img
            src={song.avatar || "/default-avatar.png"}
            alt={song.title}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 12,
              objectFit: "cover",
              border: "1px solid #333",
            }}
          />
          <button
            title={isPlayingNow ? "Pause" : "Play"}
            onClick={togglePlay}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              background: "rgba(0,0,0,.45)",
              color: "#fff",
              border: "none",
              fontSize: 30,
              cursor: "pointer",
            }}
          >
            {isPlayingNow ? "⏸" : "▶"}
          </button>
        </div>

        <div>
          <div className="text-xl font-semibold">{song.title}</div>
          <div style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
            {song.genres.map((g) => g.name).join(", ") || "—"} • {song.listens} listens
          </div>

          {song.description && (
            <p style={{ marginTop: 10, color: "#ddd", whiteSpace: "pre-wrap" }}>
              {song.description}
            </p>
          )}

          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
            {!song.owned ? (
              <button onClick={() => buySong(song.id)} className="buy-btn" title="Buy this track">
                Give&nbsp;Coffee&nbsp;•&nbsp;{formatPriceVND(song.price)}
              </button>
            ) : (
              <span style={{ color: "#22c55e", fontWeight: 600 }}>Đã mua (Full)</span>
            )}
          </div>
        </div>
      </div>

      {/* BODY: lyric + comments (responsive) */}
      <div className="detail-body">
        {/* LYRIC */}
        {song.lyric && (
          <section
            className="lyric-card"
            style={{
              border: "1px solid #222",
              borderRadius: 12,
              background: "#111",
              padding: 16,
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
              color: "#eee",
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            }}
          >
            {song.lyric}
          </section>
        )}

        {/* COMMENTS */}
        <aside
          className="comments-card"
          style={{
            border: "1px solid #222",
            borderRadius: 12,
            background: "#111",
            padding: 16,
          }}
        >
          <h3 style={{ fontWeight: 600, fontSize: 18, marginBottom: 12 }}>Comments</h3>

          {song.comments?.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {song.comments.map((c) => (
                <div key={c.id} style={{ borderBottom: "1px solid #222", paddingBottom: 8 }}>
                  <div style={{ color: "#9CA3AF", fontSize: 13 }}>
                    {c.user?.name || "Anonymous"} — {new Date(c.createdAt).toLocaleString("vi-VN")}
                  </div>
                  <div style={{ color: "#fff", marginTop: 4, whiteSpace: "pre-wrap" }}>
                    {c.content}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#999", fontStyle: "italic" }}>No comments yet!</p>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <input
              value={commentValue}
              onChange={(e) => setCommentValue(e.target.value)}
              placeholder="Write a comment..."
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "#0a0a0a",
                color: "#fff",
                outline: "none",
              }}
            />
            <button
              onClick={submitComment}
              className="buy-btn"
              title="Post comment"
              style={{ padding: "10px 14px" }}
            >
              Post
            </button>
          </div>
        </aside>
      </div>

      {/* GLOBAL BOTTOM PLAYER */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: "var(--bottom-nav-h, 0px)", // nằm trên bottom menu
          height: PLAYER_H,
          background: "#171717",
          borderTop: "1px solid #262626",
          zIndex: 100,
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
          {/* LEFT: thumb + meta + seek */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid #333",
                flex: "0 0 52px",
              }}
            >
              <img
                src={song.avatar || "/default-avatar.png"}
                alt={song.title}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <div style={{ lineHeight: 1.2, overflow: "hidden" }}>
              <div
                style={{
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                }}
              >
                {song.title}
              </div>
              <div
                style={{
                  color: "#bbb",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                }}
              >
                {song.seller?.name || song.seller?.email || "Anonymous"}&nbsp;|&nbsp;
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
              {loadingStream && (
                <div style={{ fontSize: 12, color: "#bbb", marginTop: 6 }}>
                  Loading audio…
                </div>
              )}
              {streamError && (
                <div style={{ fontSize: 12, color: "#f87171", marginTop: 6 }}>
                  {streamError}
                </div>
              )}
            </div>
          </div>

          {/* CENTER: controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22 }}>
            <button
              onClick={togglePlay}
              title={isPlayingNow ? "Pause" : "Play"}
              style={{ fontSize: 28, background: "none", border: "none", color: "#fff", cursor: "pointer" }}
            >
              {isPlayingNow ? "⏸" : "▶"}
            </button>
          </div>

          {/* RIGHT: volume */}
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
      </div>

      {/* Modals */}
      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        nextPath={typeof window !== "undefined" ? window.location.pathname : "/"}
      />
      <PaymentQRModal
        open={qrOpen}
        qrString={qrString}
        sessionId={paymentSessionId}
        onClose={() => setQrOpen(false)}
        onSuccess={handlePaymentSuccess}
      />

      <style jsx>{`
        .buy-btn {
          appearance: none;
          border: none;
          color: #fff;
          font-weight: 600;
          padding: 10px 16px;
          border-radius: 10px;
          background-image: linear-gradient(90deg, #9b5cff 0%, #5a6bff 100%);
          box-shadow: 0 6px 18px rgba(133, 92, 255, 0.35);
          transition: transform 0.08s ease, box-shadow 0.2s ease, filter 0.2s ease;
          cursor: pointer;
          white-space: nowrap;
        }
        .buy-btn:hover { filter: brightness(1.05); box-shadow: 0 8px 22px rgba(133, 92, 255, 0.5); }
        .buy-btn:active { transform: translateY(1px); }

        /* Layout lyric + comments */
        .detail-body { display: grid; gap: 16px; margin-top: 16px; }
        /* Desktop: 2 cột (lyric rộng, comments hẹp) */
        @media (min-width: 1024px) {
          .detail-body { grid-template-columns: 1fr 420px; align-items: start; }
        }
      `}</style>

      {/* Hidden audio element */}
      <audio ref={audioRef} crossOrigin="anonymous" preload="metadata" playsInline />
    </div>
  );
}
