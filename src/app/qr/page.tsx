"use client";

import type React from "react";
import { useState, useEffect } from "react";
import QRCode from "qrcode";

// Body = ô nhỏ bên trong (trừ 3 mắt)
// EyeOuter = viền 3 mắt
// EyeInner = lõi 3 mắt
type BodyStyle =
  | "square"
  | "dots"
  | "rounded"
  | "tinyDots"
  | "diamond"
  | "mixed";

type EyeOuterStyle =
  | "square"
  | "rounded"
  | "circle"
  | "leaf"
  | "thin"
  | "thick";

type EyeInnerStyle =
  | "square"
  | "circle"
  | "diamond"
  | "star"
  | "rounded"
  | "dot";

// Khung trang trí
type FrameStyle =
  | "none"
  | "plain"
  | "soft"
  | "double"
  | "ticket"
  | "cornerDots"
  | "cornerSquares"
  | "innerBorder"
  | "tagTop"
  | "ribbonBottom";

export default function QRPage() {
  // Nội dung QR
  const [content, setContent] = useState("");

  // Body / Eye styles
  const [bodyStyle, setBodyStyle] = useState<BodyStyle>("dots");
  const [eyeOuterStyle, setEyeOuterStyle] = useState<EyeOuterStyle>("rounded");
  const [eyeInnerStyle, setEyeInnerStyle] = useState<EyeInnerStyle>("circle");

  // Frame
  const [frameStyle, setFrameStyle] = useState<FrameStyle>("plain");

  // Colors
  const [bodyColor, setBodyColor] = useState("#7c2dff");
  const [eyeOuterColor, setEyeOuterColor] = useState("#000000");
  const [eyeInnerColor, setEyeInnerColor] = useState("#000000");
  const [qrPanelColor, setQrPanelColor] = useState("#ffffff");
  const [canvasBgColor, setCanvasBgColor] = useState("#0f172a");

  // Logo (upload, không gửi backend)
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoScale, setLogoScale] = useState(0.23); // tỉ lệ so với cạnh QR
  const [logoHasBg, setLogoHasBg] = useState(true);

  // Output
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setLogoDataUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // ===== Helpers vẽ shape cơ bản =====

  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  const drawDiamond = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    inset = 0
  ) => {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size / 2 - inset;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
  };

  const drawStar = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number
  ) => {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const outer = size / 2;
    const inner = outer * 0.4;
    const spikes = 5;
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outer);
    for (let i = 0; i < spikes; i++) {
      let x1 = cx + Math.cos(rot) * outer;
      let y1 = cy + Math.sin(rot) * outer;
      ctx.lineTo(x1, y1);
      rot += step;
      x1 = cx + Math.cos(rot) * inner;
      y1 = cy + Math.sin(rot) * inner;
      ctx.lineTo(x1, y1);
      rot += step;
    }
    ctx.closePath();
  };

  // ===== Body shape =====

  const drawBodyCell = (
    ctx: CanvasRenderingContext2D,
    style: BodyStyle,
    row: number,
    col: number,
    x: number,
    y: number,
    size: number
  ) => {
    const marginBase = size * 0.18;

    ctx.beginPath();

    switch (style) {
      case "square": {
        ctx.rect(
          x + marginBase,
          y + marginBase,
          size - 2 * marginBase,
          size - 2 * marginBase
        );
        break;
      }
      case "dots": {
        const r = size * 0.3;
        ctx.arc(x + size / 2, y + size / 2, r, 0, Math.PI * 2);
        break;
      }
      case "tinyDots": {
        const r = size * 0.2;
        ctx.arc(x + size / 2, y + size / 2, r, 0, Math.PI * 2);
        break;
      }
      case "rounded": {
        const r = size * 0.35;
        drawRoundedRect(
          ctx,
          x + marginBase * 0.7,
          y + marginBase * 0.7,
          size - marginBase * 1.4,
          size - marginBase * 1.4,
          r
        );
        break;
      }
      case "diamond": {
        drawDiamond(ctx, x, y, size, marginBase * 0.3);
        break;
      }
      case "mixed": {
        if ((row + col) % 2 === 0) {
          const r = size * 0.3;
          ctx.arc(x + size / 2, y + size / 2, r, 0, Math.PI * 2);
        } else {
          drawDiamond(ctx, x, y, size, marginBase * 0.3);
        }
        break;
      }
    }

    ctx.fill();
  };

  // ===== Eye outer =====

  const drawEyeOuter = (
    ctx: CanvasRenderingContext2D,
    style: EyeOuterStyle,
    x: number,
    y: number,
    size: number
  ) => {
    const lineWidthBase = size * 0.16;
    const inset = size * 0.04;

    ctx.beginPath();
    switch (style) {
      case "square": {
        ctx.lineWidth = lineWidthBase;
        ctx.strokeRect(
          x + inset,
          y + inset,
          size - inset * 2,
          size - inset * 2
        );
        return;
      }
      case "thin": {
        ctx.lineWidth = lineWidthBase * 0.6;
        ctx.strokeRect(
          x + inset * 1.5,
          y + inset * 1.5,
          size - inset * 3,
          size - inset * 3
        );
        return;
      }
      case "thick": {
        ctx.lineWidth = lineWidthBase * 1.4;
        ctx.strokeRect(
          x + inset * 0.8,
          y + inset * 0.8,
          size - inset * 1.6,
          size - inset * 1.6
        );
        return;
      }
      case "rounded": {
        ctx.lineWidth = lineWidthBase;
        drawRoundedRect(
          ctx,
          x + inset,
          y + inset,
          size - inset * 2,
          size - inset * 2,
          size * 0.25
        );
        ctx.stroke();
        return;
      }
      case "circle": {
        ctx.lineWidth = lineWidthBase;
        const r = (size - inset * 2) / 2;
        ctx.arc(x + size / 2, y + size / 2, r, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
      case "leaf": {
        ctx.lineWidth = lineWidthBase;
        const cx = x + size / 2;
        const cy = y + size / 2;
        const rx = (size - inset * 2) / 2;
        const ry = rx * 0.7;
        ctx.ellipse(cx, cy, rx, ry, Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
    }
  };

  // ===== Eye inner =====

  const drawEyeInner = (
    ctx: CanvasRenderingContext2D,
    style: EyeInnerStyle,
    x: number,
    y: number,
    size: number
  ) => {
    const inset = size * 0.25;
    const w = size - inset * 2;

    ctx.beginPath();
    switch (style) {
      case "square": {
        ctx.rect(x + inset, y + inset, w, w);
        break;
      }
      case "rounded": {
        drawRoundedRect(ctx, x + inset, y + inset, w, w, w * 0.35);
        break;
      }
      case "circle": {
        const r = w / 2;
        ctx.arc(x + size / 2, y + size / 2, r, 0, Math.PI * 2);
        break;
      }
      case "diamond": {
        drawDiamond(ctx, x + inset, y + inset, w);
        break;
      }
      case "star": {
        drawStar(ctx, x + inset * 0.6, y + inset * 0.6, w * 0.9);
        break;
      }
      case "dot": {
        const r = w * 0.35;
        ctx.arc(x + size / 2, y + size / 2, r, 0, Math.PI * 2);
        break;
      }
    }

    ctx.fill();
  };

  // ===== Frame (khung) =====

  const drawFrame = (
    ctx: CanvasRenderingContext2D,
    style: FrameStyle,
    canvasSize: number,
    x: number,
    y: number,
    size: number
  ) => {
    if (style === "none") return;

    const pad = size * 0.16;
    const fx = x - pad;
    const fy = y - pad;
    const fw = size + pad * 2;
    const fh = size + pad * 2;

    const accent = bodyColor;

    ctx.save();
    switch (style) {
      case "plain": {
        ctx.fillStyle = accent + "20";
        drawRoundedRect(ctx, fx, fy, fw, fh, fw * 0.12);
        ctx.fill();
        break;
      }
      case "soft": {
        ctx.shadowColor = accent + "80";
        ctx.shadowBlur = 32;
        ctx.fillStyle = accent + "10";
        drawRoundedRect(ctx, fx, fy, fw, fh, fw * 0.18);
        ctx.fill();
        break;
      }
      case "double": {
        ctx.strokeStyle = accent + "cc";
        ctx.lineWidth = size * 0.02;
        drawRoundedRect(ctx, fx, fy, fw, fh, fw * 0.2);
        ctx.stroke();
        drawRoundedRect(
          ctx,
          fx + pad * 0.4,
          fy + pad * 0.4,
          fw - pad * 0.8,
          fh - pad * 0.8,
          fw * 0.16
        );
        ctx.stroke();
        break;
      }
      case "ticket": {
        ctx.fillStyle = accent + "15";
        drawRoundedRect(ctx, fx, fy, fw, fh, fw * 0.18);
        ctx.fill();
        // 4 lỗ vé
        const r = pad * 0.6;
        const centers = [
          [fx, fy + fh / 2],
          [fx + fw, fy + fh / 2],
          [fx + fw / 2, fy],
          [fx + fw / 2, fy + fh],
        ];
        ctx.fillStyle = canvasBgColor;
        centers.forEach(([cx, cy]) => {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      }
      case "cornerDots": {
        ctx.fillStyle = accent + "aa";
        const r = pad * 0.7;
        const centers = [
          [fx + r * 1.2, fy + r * 1.2],
          [fx + fw - r * 1.2, fy + r * 1.2],
          [fx + r * 1.2, fy + fh - r * 1.2],
          [fx + fw - r * 1.2, fy + fh - r * 1.2],
        ];
        centers.forEach(([cx, cy]) => {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      }
      case "cornerSquares": {
        ctx.fillStyle = accent + "aa";
        const s = pad * 1.2;
        const corners = [
          [fx, fy],
          [fx + fw - s, fy],
          [fx, fy + fh - s],
          [fx + fw - s, fy + fh - s],
        ];
        corners.forEach(([cx, cy]) => {
          drawRoundedRect(ctx, cx, cy, s, s, s * 0.2);
          ctx.fill();
        });
        break;
      }
      case "innerBorder": {
        ctx.strokeStyle = accent + "dd";
        ctx.lineWidth = size * 0.02;
        drawRoundedRect(
          ctx,
          x + size * 0.04,
          y + size * 0.04,
          size - size * 0.08,
          size - size * 0.08,
          size * 0.18
        );
        ctx.stroke();
        break;
      }
      case "tagTop": {
        ctx.fillStyle = accent + "cc";
        const h = pad * 1.6;
        drawRoundedRect(
          ctx,
          fx + fw * 0.2,
          fy - h * 0.7,
          fw * 0.6,
          h,
          h * 0.5
        );
        ctx.fill();
        break;
      }
      case "ribbonBottom": {
        ctx.fillStyle = accent + "cc";
        const h = pad * 1.4;
        const rx = fx + fw * 0.18;
        const ry = fy + fh + pad * 0.25;
        const rw = fw * 0.64;
        const rh = h;
        drawRoundedRect(ctx, rx, ry, rw, rh, rh * 0.4);
        ctx.fill();
        // 2 tam giác
        ctx.beginPath();
        ctx.moveTo(rx, ry + rh / 2);
        ctx.lineTo(rx - pad * 0.9, ry + rh);
        ctx.lineTo(rx, ry + rh);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(rx + rw, ry + rh / 2);
        ctx.lineTo(rx + rw + pad * 0.9, ry + rh);
        ctx.lineTo(rx + rw, ry + rh);
        ctx.closePath();
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  };

  // ===== Vẽ full QR matrix =====

  const drawQrModules = (
    ctx: CanvasRenderingContext2D,
    modulesData: ArrayLike<number | boolean>,
    moduleCount: number,
    canvasSize: number
  ) => {
    const qrSize = canvasSize * 0.7;
    const cellSize = qrSize / moduleCount;
    const offsetX = (canvasSize - qrSize) / 2;
    const offsetY = (canvasSize - qrSize) / 2;

    // Khung ngoài
    drawFrame(ctx, frameStyle, canvasSize, offsetX, offsetY, qrSize);

    // Panel nền dưới QR
    ctx.fillStyle = qrPanelColor;
    drawRoundedRect(
      ctx,
      offsetX,
      offsetY,
      qrSize,
      qrSize,
      qrSize * 0.08
    );
    ctx.fill();

    // Vẽ mắt trước
    const drawEye = (corner: "tl" | "tr" | "bl") => {
      let startRow = 0;
      let startCol = 0;
      if (corner === "tr") startCol = moduleCount - 7;
      if (corner === "bl") startRow = moduleCount - 7;

      const x = offsetX + startCol * cellSize;
      const y = offsetY + startRow * cellSize;
      const size = cellSize * 7;

      // Outer
      ctx.strokeStyle = eyeOuterColor;
      ctx.fillStyle = eyeInnerColor;
      drawEyeOuter(ctx, eyeOuterStyle, x, y, size);

      // Inner
      drawEyeInner(
        ctx,
        eyeInnerStyle,
        x + cellSize * 2,
        y + cellSize * 2,
        cellSize * 3
      );
    };

    drawEye("tl");
    drawEye("tr");
    drawEye("bl");

    // Body
    ctx.fillStyle = bodyColor;

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        const idx = row * moduleCount + col;
        const isDark = !!(modulesData as any)[idx];
        if (!isDark) continue;

        const inTL = row < 7 && col < 7;
        const inTR = row < 7 && col >= moduleCount - 7;
        const inBL = row >= moduleCount - 7 && col < 7;
        if (inTL || inTR || inBL) continue;

        const x = offsetX + col * cellSize;
        const y = offsetY + row * cellSize;

        drawBodyCell(ctx, bodyStyle, row, col, x, y, cellSize);
      }
    }

    return { offsetX, offsetY, qrSize };
  };

  // ===== Auto-generate QR khi có thay đổi =====

  useEffect(() => {
    const payload = content.trim();
    if (!payload) {
      setQrDataUrl(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        setIsGenerating(true);
        setError(null);

        const qr = QRCode.create(payload, {
          errorCorrectionLevel: "H",
        }) as any;
        const moduleCount: number = qr.modules.size;
        const modulesData: ArrayLike<number | boolean> = qr.modules.data;

        const CANVAS_SIZE = 800;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Cannot get canvas context");

        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;

        // Nền tổng
        ctx.fillStyle = canvasBgColor;
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Vẽ QR + khung
        const metrics = drawQrModules(
          ctx,
          modulesData,
          moduleCount,
          CANVAS_SIZE
        );

        // Logo ở giữa
        if (logoDataUrl) {
          const logoImg = await loadImage(logoDataUrl);
          const { qrSize, offsetX, offsetY } = metrics;
          const maxLogoSize = qrSize * logoScale;

          const ratio = Math.min(
            maxLogoSize / logoImg.width,
            maxLogoSize / logoImg.height
          );
          const w = logoImg.width * ratio;
          const h = logoImg.height * ratio;
          const cx = offsetX + qrSize / 2;
          const cy = offsetY + qrSize / 2;
          const x = cx - w / 2;
          const y = cy - h / 2;

          if (logoHasBg) {
            ctx.save();
            ctx.fillStyle = "#ffffffee";
            const r = Math.max(w, h) * 0.6;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          ctx.drawImage(logoImg, x, y, w, h);
        }

        const finalUrl = canvas.toDataURL("image/png");
        if (!cancelled) setQrDataUrl(finalUrl);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Có lỗi khi generate QR. Thử lại sau.");
      } finally {
        if (!cancelled) setIsGenerating(false);
      }
    }, 350); // debounce nhẹ

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [
    content,
    bodyStyle,
    eyeOuterStyle,
    eyeInnerStyle,
    frameStyle,
    bodyColor,
    eyeOuterColor,
    eyeInnerColor,
    qrPanelColor,
    canvasBgColor,
    logoDataUrl,
    logoScale,
    logoHasBg,
  ]);

  // ===== UI option lists =====

  const bodyOptions: { id: BodyStyle; label: string }[] = [
    { id: "square", label: "Vuông" },
    { id: "dots", label: "Chấm tròn" },
    { id: "rounded", label: "Vuông bo" },
    { id: "tinyDots", label: "Chấm nhỏ" },
    { id: "diamond", label: "Kim cương" },
    { id: "mixed", label: "Mix" },
  ];

  const eyeOuterOptions: { id: EyeOuterStyle; label: string }[] = [
    { id: "square", label: "Vuông" },
    { id: "rounded", label: "Bo góc" },
    { id: "circle", label: "Tròn" },
    { id: "leaf", label: "Lá" },
    { id: "thin", label: "Viền mỏng" },
    { id: "thick", label: "Viền dày" },
  ];

  const eyeInnerOptions: { id: EyeInnerStyle; label: string }[] = [
    { id: "square", label: "Vuông" },
    { id: "rounded", label: "Bo góc" },
    { id: "circle", label: "Tròn" },
    { id: "diamond", label: "Kim cương" },
    { id: "star", label: "Sao" },
    { id: "dot", label: "Chấm" },
  ];

  const frameOptions: { id: FrameStyle; label: string }[] = [
    { id: "none", label: "Không khung" },
    { id: "plain", label: "Basic" },
    { id: "soft", label: "Mềm + shadow" },
    { id: "double", label: "Viền đôi" },
    { id: "ticket", label: "Vé" },
    { id: "cornerDots", label: "Chấm góc" },
    { id: "cornerSquares", label: "Khối góc" },
    { id: "innerBorder", label: "Viền trong" },
    { id: "tagTop", label: "Tag trên" },
    { id: "ribbonBottom", label: "Ribbon dưới" },
  ];

  return (
    <main className="min-h-screen w-full bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl p-6 md:p-8 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-8">
        {/* LEFT */}
        <div className="space-y-6">
          {/* Step 1: content */}
          <section className="space-y-3 border-b border-slate-800 pb-4">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 text-[11px] font-bold text-slate-950">
                1
              </span>
              Complete the content
            </h2>

            <div className="space-y-2">
              <label className="text-sm text-slate-200">
                QR content (URL, text, phone, v.v.)
              </label>
              <textarea
                className="w-full min-h-[140px] rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-y"
                placeholder="Ví dụ: https://cobarmusic.com, +8490..., WIFI:T:WPA;S:MyWifi;P:12345678;;"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-xs text-red-400 pt-1">{error}</p>
            )}
          </section>

          {/* Step 2: design */}
          <section className="space-y-5">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 text-[11px] font-bold text-slate-950">
                2
              </span>
              Tùy chỉnh QR
            </h2>

            {/* Frame */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-200">Khung</p>
              <div className="grid grid-cols-5 gap-2">
                {frameOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.label}
                    onClick={() => setFrameStyle(opt.id)}
                    className={`flex items-center justify-center rounded-xl border bg-slate-900 p-1 ${
                      frameStyle === opt.id
                        ? "border-sky-500 bg-sky-500/10"
                        : "border-slate-700 hover:bg-slate-800"
                    }`}
                  >
                    <FramePreview type={opt.id} />
                  </button>
                ))}
              </div>
            </div>

            {/* BODY SHAPE */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-200">
                Hình dạng cơ thể
              </p>
              <div className="grid grid-cols-6 gap-2">
                {bodyOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.label}
                    onClick={() => setBodyStyle(opt.id)}
                    className={`flex aspect-square items-center justify-center rounded-xl border bg-slate-900 ${
                      bodyStyle === opt.id
                        ? "border-sky-500 bg-sky-500/10"
                        : "border-slate-700 hover:bg-slate-800"
                    }`}
                  >
                    <BodyPreview type={opt.id} />
                  </button>
                ))}
              </div>
            </div>

            {/* OUTER EYE */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-200">Mắt ngoài</p>
              <div className="grid grid-cols-6 gap-2">
                {eyeOuterOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.label}
                    onClick={() => setEyeOuterStyle(opt.id)}
                    className={`flex aspect-square items-center justify-center rounded-xl border bg-slate-900 ${
                      eyeOuterStyle === opt.id
                        ? "border-sky-500 bg-sky-500/10"
                        : "border-slate-700 hover:bg-slate-800"
                    }`}
                  >
                    <EyeOuterPreview type={opt.id} />
                  </button>
                ))}
              </div>
            </div>

            {/* INNER EYE */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-200">Mắt trong</p>
              <div className="grid grid-cols-6 gap-2">
                {eyeInnerOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.label}
                    onClick={() => setEyeInnerStyle(opt.id)}
                    className={`flex aspect-square items-center justify-center rounded-xl border bg-slate-900 ${
                      eyeInnerStyle === opt.id
                        ? "border-sky-500 bg-sky-500/10"
                        : "border-slate-700 hover:bg-slate-800"
                    }`}
                  >
                    <EyeInnerPreview type={opt.id} />
                  </button>
                ))}
              </div>
            </div>

            {/* COLORS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ColorPicker
                label="Màu cơ thể"
                color={bodyColor}
                onChange={setBodyColor}
              />
              <ColorPicker
                label="Màu mắt ngoài"
                color={eyeOuterColor}
                onChange={setEyeOuterColor}
              />
              <ColorPicker
                label="Màu mắt trong"
                color={eyeInnerColor}
                onChange={setEyeInnerColor}
              />
              <ColorPicker
                label="Màu panel QR"
                color={qrPanelColor}
                onChange={setQrPanelColor}
              />
              <ColorPicker
                label="Màu nền tổng"
                color={canvasBgColor}
                onChange={setCanvasBgColor}
              />
            </div>

            {/* Logo */}
            <div className="space-y-3 border-t border-slate-800 pt-3">
              <p className="text-xs font-semibold text-slate-200">Logo</p>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="inline-flex items-center px-3 py-1.5 text-xs rounded-xl border border-slate-700 bg-slate-900 cursor-pointer hover:bg-slate-800">
                  <span>Tải logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </label>
                {logoDataUrl && (
                  <>
                    <button
                      type="button"
                      onClick={() => setLogoDataUrl(null)}
                      className="px-3 py-1.5 text-xs rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800"
                    >
                      Xóa logo
                    </button>
                    <div className="h-10 w-10 rounded-md overflow-hidden border border-slate-700 bg-white">
                      <img
                        src={logoDataUrl}
                        alt="Logo preview"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400 w-24">
                  Kích thước logo
                </span>
                <input
                  type="range"
                  min={0.12}
                  max={0.35}
                  step={0.01}
                  value={logoScale}
                  onChange={(e) => setLogoScale(parseFloat(e.target.value))}
                  className="flex-1"
                />
              </div>

              <label className="flex items-center gap-2 text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  checked={logoHasBg}
                  onChange={(e) => setLogoHasBg(e.target.checked)}
                  className="h-3 w-3"
                />
                Nền tròn phía sau logo
              </label>
            </div>
          </section>
        </div>

        {/* RIGHT: preview + download */}
        <div className="flex flex-col items-center justify-start gap-4">
          <div className="w-full">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 text-[11px] font-bold text-slate-950">
                3
              </span>
              Tạo & tải QR
            </h2>
            <div className="w-full flex justify-center">
              <div className="rounded-3xl bg-slate-900 p-5 min-h-[260px] min-w-[260px] flex flex-col items-center justify-center">
                {qrDataUrl ? (
                  <>
                    <img
                      src={qrDataUrl}
                      alt="Generated QR"
                      className="h-60 w-60"
                    />
                    {isGenerating && (
                      <p className="mt-2 text-[10px] text-slate-400">
                        Đang cập nhật QR...
                      </p>
                    )}
                    <a
                      href={qrDataUrl}
                      download="qr-code.png"
                      className="mt-4 inline-flex items-center justify-center rounded-full border border-slate-700 px-4 py-2 text-xs md:text-sm text-slate-100 hover:bg-slate-800"
                    >
                      Download QR (PNG)
                    </a>
                  </>
                ) : (
                  <div className="text-xs text-slate-400 text-center px-6">
                    Nhập nội dung hoặc chỉnh một số option để tạo QR preview.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ====== Small color picker component ======

type ColorPickerProps = {
  label: string;
  color: string;
  onChange: (val: string) => void;
};

function ColorPicker({ label, color, onChange }: ColorPickerProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-slate-300">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-8 rounded-md border border-slate-700 bg-slate-900"
        />
        <input
          type="text"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs"
        />
      </div>
    </div>
  );
}

// ===== Preview components cho các option =====

function BodyPreview({ type }: { type: BodyStyle }) {
  const dots = Array.from({ length: 9 });
  return (
    <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
      <div className="grid grid-cols-3 gap-[2px]">
        {dots.map((_, i) => {
          const baseSquare = "w-1.5 h-1.5 bg-slate-800";
          switch (type) {
            case "square":
              return (
                <div
                  key={i}
                  className={`${baseSquare} rounded-[2px]`}
                />
              );
            case "dots":
              return (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-slate-800"
                />
              );
            case "tinyDots":
              return (
                <div
                  key={i}
                  className="w-1 h-1 rounded-full bg-slate-800"
                />
              );
            case "rounded":
              return (
                <div
                  key={i}
                  className="w-1.5 h-1.5 bg-slate-800 rounded-md"
                />
              );
            case "diamond":
              return (
                <div
                  key={i}
                  className="w-1.5 h-1.5 bg-slate-800 rotate-45 rounded-[2px]"
                />
              );
            case "mixed":
            default:
              return i % 2 === 0 ? (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-slate-800"
                />
              ) : (
                <div
                  key={i}
                  className="w-1.5 h-1.5 bg-slate-800 rotate-45 rounded-[2px]"
                />
              );
          }
        })}
      </div>
    </div>
  );
}

function EyeOuterPreview({ type }: { type: EyeOuterStyle }) {
  const base = "w-7 h-7 flex items-center justify-center";
  switch (type) {
    case "square":
      return (
        <div className={`${base} bg-white rounded-md`}>
          <div className="w-6 h-6 border-2 border-slate-800 rounded-[4px]" />
        </div>
      );
    case "rounded":
      return (
        <div className={`${base} bg-white rounded-md`}>
          <div className="w-6 h-6 border-2 border-slate-800 rounded-xl" />
        </div>
      );
    case "circle":
      return (
        <div className={`${base} bg-white rounded-md`}>
          <div className="w-6 h-6 border-2 border-slate-800 rounded-full" />
        </div>
      );
    case "leaf":
      return (
        <div className={`${base} bg-white rounded-md`}>
          <div className="w-6 h-4 border-2 border-slate-800 rounded-full rotate-45" />
        </div>
      );
    case "thin":
      return (
        <div className={`${base} bg-white rounded-md`}>
          <div className="w-6 h-6 border border-slate-800 rounded-[4px]" />
        </div>
      );
    case "thick":
    default:
      return (
        <div className={`${base} bg-white rounded-md`}>
          <div className="w-6 h-6 border-[3px] border-slate-800 rounded-[4px]" />
        </div>
      );
  }
}

function EyeInnerPreview({ type }: { type: EyeInnerStyle }) {
  return (
    <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
      <div className="w-6 h-6 bg-slate-200 flex items-center justify-center rounded-[6px]">
        {type === "square" && (
          <div className="w-3 h-3 bg-slate-800 rounded-[3px]" />
        )}
        {type === "rounded" && (
          <div className="w-3 h-3 bg-slate-800 rounded-md" />
        )}
        {type === "circle" && (
          <div className="w-3 h-3 bg-slate-800 rounded-full" />
        )}
        {type === "diamond" && (
          <div className="w-3 h-3 bg-slate-800 rotate-45 rounded-[2px]" />
        )}
        {type === "star" && (
          <div className="w-3 h-3 text-[8px] leading-none text-slate-800">
            ★
          </div>
        )}
        {type === "dot" && (
          <div className="w-2 h-2 bg-slate-800 rounded-full" />
        )}
      </div>
    </div>
  );
}

function FramePreview({ type }: { type: FrameStyle }) {
  const base = "w-8 h-8 rounded-md flex items-center justify-center";
  if (type === "none") {
    return (
      <div className={`${base} bg-slate-800/40`}>
        <div className="w-5 h-5 border border-slate-500 rounded-md" />
      </div>
    );
  }

  if (type === "plain") {
    return (
      <div className={`${base} bg-transparent`}>
        <div className="w-7 h-7 bg-sky-500/20 rounded-xl flex items-center justify-center">
          <div className="w-4 h-4 bg-white rounded-md" />
        </div>
      </div>
    );
  }

  if (type === "soft") {
    return (
      <div className={`${base} bg-transparent`}>
        <div className="w-7 h-7 bg-sky-500/10 rounded-2xl shadow-sm flex items-center justify-center">
          <div className="w-4 h-4 bg-white rounded-md" />
        </div>
      </div>
    );
  }

  if (type === "double") {
    return (
      <div className={`${base} bg-transparent`}>
        <div className="w-7 h-7 rounded-2xl border border-sky-500/70 flex items-center justify-center">
          <div className="w-5 h-5 rounded-xl border border-sky-500/70" />
        </div>
      </div>
    );
  }

  if (type === "ticket") {
    return (
      <div className={`${base} bg-transparent`}>
        <div className="relative w-7 h-7 bg-sky-500/15 rounded-xl">
          <div className="absolute left-[-3px] top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 rounded-full" />
          <div className="absolute right-[-3px] top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 rounded-full" />
        </div>
      </div>
    );
  }

  if (type === "cornerDots") {
    return (
      <div className={`${base} bg-transparent`}>
        <div className="relative w-7 h-7 bg-slate-900/80 rounded-xl">
          <div className="absolute w-2 h-2 bg-sky-400 rounded-full left-0.5 top-0.5" />
          <div className="absolute w-2 h-2 bg-sky-400 rounded-full right-0.5 top-0.5" />
          <div className="absolute w-2 h-2 bg-sky-400 rounded-full left-0.5 bottom-0.5" />
          <div className="absolute w-2 h-2 bg-sky-400 rounded-full right-0.5 bottom-0.5" />
        </div>
      </div>
    );
  }

  if (type === "cornerSquares") {
    return (
      <div className={`${base} bg-transparent`}>
        <div className="relative w-7 h-7 bg-slate-900/80 rounded-xl">
          <div className="absolute w-2 h-2 bg-sky-400 rounded-sm left-0.5 top-0.5" />
          <div className="absolute w-2 h-2 bg-sky-400 rounded-sm right-0.5 top-0.5" />
          <div className="absolute w-2 h-2 bg-sky-400 rounded-sm left-0.5 bottom-0.5" />
          <div className="absolute w-2 h-2 bg-sky-400 rounded-sm right-0.5 bottom-0.5" />
        </div>
      </div>
    );
  }

  if (type === "innerBorder") {
    return (
      <div className={`${base} bg-transparent`}>
        <div className="w-7 h-7 bg-slate-900/80 rounded-xl flex items-center justify-center">
          <div className="w-5 h-5 rounded-lg border border-sky-400" />
        </div>
      </div>
    );
  }

  if (type === "tagTop") {
    return (
      <div className={`${base} bg-transparent`}>
        <div className="relative w-7 h-7 bg-slate-900/80 rounded-xl">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-5 h-3 bg-sky-400 rounded-full" />
        </div>
      </div>
    );
  }

  // ribbonBottom
  return (
    <div className={`${base} bg-transparent`}>
      <div className="relative w-7 h-7 bg-slate-900/80 rounded-xl">
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-3 bg-sky-400 rounded-full" />
      </div>
    </div>
  );
}
