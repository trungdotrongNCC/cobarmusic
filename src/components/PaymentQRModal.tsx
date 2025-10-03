"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

type Props = {
  open: boolean;
  qrString: string;      // JSON chuỗi để render QR
  sessionId: string;     // dùng để poll
  onClose: () => void;
  onSuccess?: () => void; // gọi khi status=captured
};

export default function PaymentQRModal({
  open,
  qrString,
  sessionId,
  onClose,
  onSuccess,
}: Props) {
  const [img, setImg] = useState<string>("");
  const [status, setStatus] = useState<string>("pending");
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [qrHash, setQrHash] = useState<string>(""); // SHA-256 của qrString
  const timerRef = useRef<number | null>(null);

  // ===== Helpers =====
  const safeParse = useMemo(() => {
    try {
      // cố ý không trim để thấy khác biệt thật sự giữa local vs vercel
      return { ok: true as const, data: JSON.parse(qrString) };
    } catch (e: any) {
      return { ok: false as const, err: String(e) };
    }
  }, [qrString]);

  const keysPreview = useMemo(() => {
    if (!safeParse.ok || typeof safeParse.data !== "object" || !safeParse.data) return [];
    // show tối đa 12 key
    return Object.keys(safeParse.data).slice(0, 12);
  }, [safeParse]);

  useEffect(() => {
    // Tính SHA-256 của chuỗi QR để so sánh “chính xác từng ký tự”
    (async () => {
      const enc = new TextEncoder();
      const buf = enc.encode(qrString);
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const bytes = Array.from(new Uint8Array(digest));
      const hex = bytes.map(b => b.toString(16).padStart(2, "0")).join("");
      setQrHash(hex);
    })();
  }, [qrString]);

  // ===== Gen QR =====
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      try {
        const url = await QRCode.toDataURL(qrString, { margin: 1, width: 256 });
        if (mounted) setImg(url);
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [open, qrString]);

  // ===== Poll trạng thái thanh toán =====
  useEffect(() => {
    if (!open || !sessionId) return;

    const tick = async () => {
      try {
        const res = await fetch(`/api/payments/${sessionId}`, { cache: "no-store" });
        if (!res.ok) return;
        const ps = await res.json();
        setStatus(ps?.status || "pending");
        if (ps?.status === "captured") {
          onSuccess?.();
          onClose();
        }
      } catch {
        // ignore
      }
    };

    tick(); // gọi ngay
    timerRef.current = window.setInterval(tick, 2000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [open, sessionId, onClose, onSuccess]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        left: "var(--sidebar-w, 0px)" as any,
        top: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,.6)",
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl shadow-lg"
        style={{ width: 380, background: "#111", color: "#fff", padding: 20, border: "1px solid #262626" }}
      >
        <h3 className="text-lg font-semibold mb-2">Scan to Pay</h3>
        <p className="text-sm text-gray-300 mb-4">Mở app để quét QR & thanh toán.</p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          {img ? (
            <img src={img} alt="QR" style={{ width: 256, height: 256, borderRadius: 8, background: "#fff" }} />
          ) : (
            <div style={{ width: 256, height: 256, display: "grid", placeItems: "center", background: "#222", borderRadius: 8 }}>...</div>
          )}
        </div>

        <div className="text-sm text-gray-400 mb-3">
          Session: <span className="text-gray-200">{sessionId?.slice(0, 8) || "-"}…</span>
        </div>
        <div className="text-sm mb-3">
          Status: <span className={status === "captured" ? "text-green-400" : "text-yellow-300"}>{status}</span>
        </div>

        {/* === Debug Panel Toggle === */}
        <button
          onClick={() => setShowDebug(s => !s)}
          className="w-full rounded-lg mb-3"
          style={{ padding: "8px 12px", border: "1px solid #333", background: "#1f1f1f" }}
        >
          {showDebug ? "Hide" : "Show"} QR Debug
        </button>

        {showDebug && (
          <div style={{ border: "1px dashed #333", borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div className="text-xs text-gray-300 mb-2">
              <div>qrString length: <span className="text-gray-100">{qrString.length}</span></div>
              <div>qrString SHA-256: <span className="text-gray-100 break-all">{qrHash}</span></div>
            </div>

            {/* Keys quick view */}
            {safeParse.ok ? (
              <>
                <div className="text-xs text-gray-300 mb-2">
                  <div className="mb-1">JSON keys (max 12):</div>
                  <div className="flex flex-wrap gap-2">
                    {keysPreview.map(k => (
                      <span key={k} style={{ fontFamily: "monospace", background: "#1e1e1e", border: "1px solid #333", borderRadius: 6, padding: "4px 6px" }}>
                        {k}
                      </span>
                    ))}
                    {Object.keys(safeParse.data).length > 12 && (
                      <span className="text-gray-400">…(+{Object.keys(safeParse.data).length - 12} more)</span>
                    )}
                  </div>
                </div>

                {/* Pretty JSON */}
                <div className="text-xs text-gray-300 mb-2">Parsed JSON:</div>
                <textarea
                  readOnly
                  value={JSON.stringify(safeParse.data, null, 2)}
                  style={{ width: "100%", height: 140, fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 12, background: "#0f0f0f", color: "#d1d5db", border: "1px solid #333", borderRadius: 8, padding: 8 }}
                />
              </>
            ) : (
              <>
                <div className="text-xs text-rose-300 mb-2">JSON.parse lỗi:</div>
                <div className="text-xs text-rose-200 mb-2">{safeParse.err}</div>
              </>
            )}

            {/* Raw string so sánh 1:1 */}
            <div className="text-xs text-gray-300 mb-2">Raw qrString:</div>
            <textarea
              readOnly
              value={qrString}
              style={{ width: "100%", height: 100, fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 12, background: "#0f0f0f", color: "#d1d5db", border: "1px solid #333", borderRadius: 8, padding: 8 }}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            className="w-full rounded-lg"
            style={{ padding: "10px 14px", border: "1px solid #333", background: "#1f1f1f" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
