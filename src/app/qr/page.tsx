"use client";

import { useState } from "react";
import QRCode from "qrcode";

export default function QRPage() {
  const [rawInput, setRawInput] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setError(null);
    setQrDataUrl(null);

    const trimmed = rawInput.trim();
    if (!trimmed) {
      setError("Vui lòng nhập nội dung để tạo QR.");
      return;
    }

    try {
      setIsGenerating(true);

      // Tạo QR dưới dạng data URL (PNG)
      const url = await QRCode.toDataURL(trimmed, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 300,
      });

      setQrDataUrl(url);
    } catch (e) {
      console.error(e);
      setError("Có lỗi khi generate QR. Thử lại sau.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg p-6 md:p-8 space-y-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          QR Generator
        </h1>

        <p className="text-sm text-slate-300">
          Nhập bất kỳ nội dung nào (URL, text, số điện thoại, v.v.). Hệ thống
          sẽ encode y nguyên chuỗi đó vào QR.
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-200">
            Nội dung cần encode
          </label>
          <textarea
            className="w-full min-h-[120px] rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-y"
            placeholder="Ví dụ: https://cobarmusic.com/song/123 hoặc GIAMGIA50"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
          />
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="inline-flex items-center justify-center rounded-xl border border-sky-500 bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isGenerating ? "Đang generate..." : "Generate QR"}
        </button>

        {error && (
          <p className="text-sm text-red-400">
            {error}
          </p>
        )}

        {qrDataUrl && (
          <div className="mt-4 flex flex-col items-center gap-4">
            <div className="rounded-2xl bg-white p-4">
              <img
                src={qrDataUrl}
                alt="Generated QR"
                className="h-64 w-64"
              />
            </div>
            <a
              href={qrDataUrl}
              download="qr-code.png"
              className="text-xs md:text-sm underline text-sky-400 hover:text-sky-300"
            >
              Tải QR về (PNG)
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
