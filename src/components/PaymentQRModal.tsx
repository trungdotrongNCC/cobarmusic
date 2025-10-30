"use client";

import { useEffect, useRef, useState } from "react";
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
  const timerRef = useRef<number | null>(null);

  // gen QR
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
    return () => {
      mounted = false;
    };
  }, [open, qrString]);

  // poll trạng thái
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

    // gọi ngay + mỗi 2s
    tick();
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
        top: 0,
        right: 0,
        bottom: 0,
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
        style={{
          width: 380,
          background: "#111",
          color: "#fff",
          padding: 20,
          border: "1px solid #262626",
        }}
      >
        <h3 className="text-lg font-semibold mb-2">Scan to Pay</h3>
        <p className="text-sm text-gray-300 mb-4">
          Quẹt Mezon lẹ lẹ rồi vô thư viện chill nha. NCC8 nhớ bạn ghê á!
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          {img ? (
            <img
              src={img}
              alt="QR"
              style={{
                width: 256,
                height: 256,
                borderRadius: 8,
                background: "#fff",
              }}
            />
          ) : (
            <div
              style={{
                width: 256,
                height: 256,
                display: "grid",
                placeItems: "center",
                background: "#222",
                borderRadius: 8,
              }}
            >
              ...
            </div>
          )}
        </div>

        <div className="text-sm text-gray-400 mb-3">
          Session: <span className="text-gray-200">{sessionId.slice(0, 8)}…</span>
        </div>
        <div className="text-sm mb-4">
          Status:{" "}
          <span
            className={status === "captured" ? "text-green-400" : "text-yellow-300"}
          >
            {status}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            className="w-full rounded-lg"
            style={{
              padding: "10px 14px",
              border: "1px solid #333",
              background: "#1f1f1f",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
