"use client";

import { useEffect, useRef, useState } from "react";
import Tabs from "@/components/Tabs";
import LoginModal from "@/components/LoginModal";
import PaymentQRModal from "@/components/PaymentQRModal";
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
  previewPath: string;   // path trong bucket private
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

export default function SongsListClient({
  initialSongs,
}: {
  initialSongs: SongDTO[];
}) {
  const [songs, setSongs] = useState<SongDTO[]>(initialSongs);
  const [index, setIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  // streaming state
  const [loadingStream, setLoadingStream] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // modal login
  const [showLogin, setShowLogin] = useState(false);

  // modal QR
  const [qrOpen, setQrOpen] = useState(false);
  const [qrString, setQrString] = useState("");
  const [paymentSessionId, setPaymentSessionId] = useState("");

  const current = index !== null ? songs[index] : null;
  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < songs.length - 1;

  // ===== LẤY SIGNED URL VÀ PHÁT NHẠC (Supabase) =====
  useEffect(() => {
    let cancelled = false;

    async function loadAndPlayPreview() {
      if (!current || !audioRef.current) return;

      const a = audioRef.current;

      // reset nguồn cũ để tránh race condition khi đổi bài nhanh
      a.pause();
      a.removeAttribute("src");
      a.load();

      setPlaying(false);
      setLoadingStream(true);
      setStreamError(null);
      setDuration(0);
      setCurrentTime(0);

      // bắt lỗi phần tử <audio>
      const onAudioError = () => {
        if (cancelled) return;
        const code = a.error?.code;
        const msg =
          code === 1 ? "ABORTED" :
          code === 2 ? "NETWORK" :
          code === 3 ? "DECODE" :
          code === 4 ? "SRC_NOT_SUPPORTED" : "UNKNOWN";
        setStreamError(`Audio error: ${msg}`);
        setLoadingStream(false);
        setPlaying(false);
      };
      a.addEventListener("error", onAudioError);

      try {
        const r = await fetch(`/api/songs/${current.id}/stream?kind=preview`, {
          cache: "no-store",
        });
        if (!r.ok) {
          const t = await r.text().catch(() => "");
          throw new Error(`${r.status}:${t || "stream error"}`);
        }
        const data = await r.json();
        const url = data?.url as string;
        if (!url) throw new Error("missing url");

        if (cancelled) return;

        // gán nguồn mới và thiết lập CORS
        a.crossOrigin = "anonymous";
        a.src = url;

        // đợi có thể phát (metadata sẵn sàng)
        await new Promise<void>((resolve, reject) => {
          const onCanPlay = () => {
            a.removeEventListener("canplay", onCanPlay);
            resolve();
          };
          const onErr = () => {
            a.removeEventListener("canplay", onCanPlay);
            reject(a.error);
          };
          a.addEventListener("canplay", onCanPlay, { once: true });
          a.addEventListener("error", onErr, { once: true });
          a.load();
        });

        if (cancelled) return;

        await a.play();
        setPlaying(true);
        setLoadingStream(false);

        // log lượt nghe (không chặn UI)
        fetch(`/api/songs/${current.id}/listen`, { method: "POST" }).catch(() => {});
      } catch (err: any) {
        if (cancelled) return;
        setStreamError(err?.message || "Stream failed");
        setLoadingStream(false);
        setPlaying(false);
      } finally {
        a.removeEventListener("error", onAudioError);
      }
    }

    loadAndPlayPreview();
    return () => {
      cancelled = true;
    };
  }, [index, current?.id]);

  // ===== RÀNG BUỘC SỰ KIỆN AUDIO =====
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

  async function reloadSongs() {
    const res = await fetch("/api/songs?limit=100&offset=0", { cache: "no-store" });
    const data = await res.json();
    setSongs(data.items);
  }

  // Khi thanh toán thành công (PaymentQRModal gọi onSuccess)
  async function handlePaymentSuccess() {
    await reloadSongs(); // cập nhật owned=true
    toast.success("Mua thành công, Bạn vào Library để nghe nhé", {
      duration: 6000,
      icon: "🎵",
    });
    setQrOpen(false); // đóng modal nếu còn mở
  }

  // === Buy bằng QR (polling) ===
  async function buySong(songId: number) {
    try {
      const r = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ songId }),
      });

      if (r.status === 401 || r.status === 403) {
        setShowLogin(true); // mở modal login
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
    } catch (e) {
      alert("Create payment error");
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
          // chừa chỗ cho player + bottom nav mobile
          paddingBottom: `calc(var(--bottom-nav-h, 0px) + ${current ? PLAYER_H + 24 : 24}px)`,
          transition: "padding-bottom .2s ease",
        }}
      >
        {/* Title + Tabs */}
        <h1 className="text-3xl md:text-[42px] font-semibold tracking-tight mb-3">
          Marketplace
        </h1>
        <Tabs
          className="mb-6"
          tabs={[
            { label: "Songs", href: "/" },
            { label: "Playlists", comingSoon: true },
          ]}
        />

        {/* List */}
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
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
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
                    {s.genres.map((g) => g.name).join(", ") || "—"} • {String(s.price)} • {s.listens} listens
                  </div>
                </div>
              </div>

              {/* right: buy */}
              {!s.owned && (
                <button
                  onClick={() => buySong(s.id)}
                  style={{
                    border: "1px solid #fff",
                    background: "transparent",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "8px 14px",
                  }}
                >
                  Buy
                </button>
              )}
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
                  src={current.avatar || "/default-avatar.png"}
                  alt={current.title}
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
                  {current.title}
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
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22 }}
            >
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
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}
            >
              <span style={{ color: "#fff", fontSize: 16 }}>
                {volume === 0 ? "🔇" : "🔊"}
              </span>
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

          {/* Thêm crossOrigin để stream Supabase mượt hơn */}
          <audio ref={audioRef} crossOrigin="anonymous" />
        </div>
      )}

      {/* Modal yêu cầu login */}
      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        nextPath={typeof window !== "undefined" ? window.location.pathname : "/"}
      />

      {/* Modal QR thanh toán */}
      <PaymentQRModal
        open={qrOpen}
        qrString={qrString}
        sessionId={paymentSessionId}
        onClose={() => setQrOpen(false)}
        onSuccess={handlePaymentSuccess} // show toast + reload
      />

      <style jsx>{`
        .cover:hover .overlay {
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `}</style>
    </div>
  );
}
