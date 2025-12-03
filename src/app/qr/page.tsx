"use client";

import { useState } from "react";
import QRCode from "qrcode";

type QrType = "website" | "text" | "phone" | "email" | "wifi" | "vcard";
type EccLevel = "L" | "M" | "Q" | "H";

const qrTypes: { id: QrType; label: string }[] = [
  { id: "website", label: "Website" },
  { id: "text", label: "Text" },
  { id: "phone", label: "Phone" },
  { id: "email", label: "Email" },
  { id: "wifi", label: "WiFi" },
  { id: "vcard", label: "vCard" },
];

export default function QRPage() {
  const [qrType, setQrType] = useState<QrType>("website");

  // Website
  const [websiteUrl, setWebsiteUrl] = useState("");

  // Text
  const [textValue, setTextValue] = useState("");

  // Phone
  const [phoneNumber, setPhoneNumber] = useState("");

  // Email
  const [emailAddress, setEmailAddress] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // WiFi
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiEncryption, setWifiEncryption] = useState<"WPA" | "WEP" | "nopass">("WPA");

  // vCard
  const [vcardFullName, setVcardFullName] = useState("");
  const [vcardOrg, setVcardOrg] = useState("");
  const [vcardTitle, setVcardTitle] = useState("");
  const [vcardPhone, setVcardPhone] = useState("");
  const [vcardEmail, setVcardEmail] = useState("");
  const [vcardAddress, setVcardAddress] = useState("");

  // QR options
  const [eccLevel, setEccLevel] = useState<EccLevel>("H");

  // Output
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  function buildPayload(): string {
    switch (qrType) {
      case "website": {
        let url = websiteUrl.trim();
        if (!url) return "";
        // Nếu user quên prefix, tự thêm https://
        if (!/^https?:\/\//i.test(url)) {
          url = "https://" + url;
        }
        return url;
      }

      case "text": {
        return textValue.trim();
      }

      case "phone": {
        const phone = phoneNumber.trim();
        if (!phone) return "";
        return `tel:${phone}`;
      }

      case "email": {
        const addr = emailAddress.trim();
        if (!addr) return "";
        const params = new URLSearchParams();
        if (emailSubject.trim()) params.append("subject", emailSubject.trim());
        if (emailBody.trim()) params.append("body", emailBody.trim());
        const query = params.toString();
        return query ? `mailto:${addr}?${query}` : `mailto:${addr}`;
      }

      case "wifi": {
        const ssid = wifiSsid.trim();
        if (!ssid) return "";
        const enc = wifiEncryption === "nopass" ? "nopass" : wifiEncryption;
        const pass = wifiEncryption === "nopass" ? "" : wifiPassword;
        // WIFI:T:WPA;S:MyWifi;P:password;;
        return `WIFI:T:${enc};S:${escapeSemicolon(ssid)};P:${escapeSemicolon(pass)};;`;
      }

      case "vcard": {
        const fn = vcardFullName.trim();
        if (!fn) return "";
        const lines: string[] = [];
        lines.push("BEGIN:VCARD");
        lines.push("VERSION:3.0");
        lines.push(`FN:${fn}`);
        if (vcardOrg.trim()) lines.push(`ORG:${vcardOrg.trim()}`);
        if (vcardTitle.trim()) lines.push(`TITLE:${vcardTitle.trim()}`);
        if (vcardPhone.trim()) lines.push(`TEL;TYPE=CELL:${vcardPhone.trim()}`);
        if (vcardEmail.trim()) lines.push(`EMAIL:${vcardEmail.trim()}`);
        if (vcardAddress.trim()) lines.push(`ADR;TYPE=HOME:;;${vcardAddress.trim()};;;;`);
        lines.push("END:VCARD");
        return lines.join("\n");
      }

      default:
        return "";
    }
  }

  function escapeSemicolon(value: string) {
    return value.replace(/;/g, "\\;");
  }

  const handleGenerate = async () => {
    setError(null);
    setQrDataUrl(null);

    const payload = buildPayload();
    if (!payload) {
      setError("Vui lòng điền đủ thông tin cho loại QR đang chọn.");
      return;
    }

    try {
      setIsGenerating(true);
      const url = await QRCode.toDataURL(payload, {
        errorCorrectionLevel: eccLevel,
        margin: 2,
        width: 320,
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
    <main className="min-h-screen w-full bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl p-6 md:p-8 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-8">
        {/* Left side: form */}
        <div className="space-y-6">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
            {qrTypes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setQrType(t.id)}
                className={`px-3 py-1.5 text-sm rounded-xl border ${
                  qrType === t.id
                    ? "bg-sky-500 border-sky-500 text-slate-950"
                    : "border-transparent bg-slate-800/60 text-slate-200 hover:bg-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Step 1: Content */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 text-[11px] font-bold text-slate-950">
                1
              </span>
              Complete the content
            </h2>

            {qrType === "website" && (
              <div className="space-y-2">
                <label className="text-sm text-slate-200">Enter your Website</label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  placeholder="E.g. https://www.myweb.com/"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
              </div>
            )}

            {qrType === "text" && (
              <div className="space-y-2">
                <label className="text-sm text-slate-200">Enter your Text</label>
                <textarea
                  className="w-full min-h-[120px] rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-y"
                  placeholder="Any text, coupon, note..."
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                />
              </div>
            )}

            {qrType === "phone" && (
              <div className="space-y-2">
                <label className="text-sm text-slate-200">Phone number</label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  placeholder="+84..."
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-slate-400">
                  Khi quét sẽ mở màn hình gọi tới số này.
                </p>
              </div>
            )}

            {qrType === "email" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm text-slate-200">Email address</label>
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="you@example.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-200">Subject (optional)</label>
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-200">Body (optional)</label>
                  <textarea
                    className="w-full min-h-[80px] rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-y"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                  />
                </div>
              </div>
            )}

            {qrType === "wifi" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm text-slate-200">WiFi name (SSID)</label>
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-200">Encryption</label>
                  <select
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    value={wifiEncryption}
                    onChange={(e) =>
                      setWifiEncryption(e.target.value as "WPA" | "WEP" | "nopass")
                    }
                  >
                    <option value="WPA">WPA/WPA2</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">No password</option>
                  </select>
                </div>
                {wifiEncryption !== "nopass" && (
                  <div className="space-y-2">
                    <label className="text-sm text-slate-200">Password</label>
                    <input
                      type="password"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                    />
                  </div>
                )}
                <p className="text-xs text-slate-400">
                  Nhiều điện thoại sẽ gợi ý kết nối WiFi trực tiếp khi quét.
                </p>
              </div>
            )}

            {qrType === "vcard" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm text-slate-200">Full name</label>
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    value={vcardFullName}
                    onChange={(e) => setVcardFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-200">Organisation (optional)</label>
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    value={vcardOrg}
                    onChange={(e) => setVcardOrg(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-200">Title (optional)</label>
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    value={vcardTitle}
                    onChange={(e) => setVcardTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-200">Phone (optional)</label>
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    value={vcardPhone}
                    onChange={(e) => setVcardPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-200">Email (optional)</label>
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    value={vcardEmail}
                    onChange={(e) => setVcardEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-200">Address (optional)</label>
                  <textarea
                    className="w-full min-h-[60px] rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-y"
                    value={vcardAddress}
                    onChange={(e) => setVcardAddress(e.target.value)}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Step 2: Design options */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 text-[11px] font-bold text-slate-950">
                2
              </span>
              Design your QR
            </h2>

            <div className="space-y-2">
              <p className="text-xs text-slate-300">Error correction level</p>
              <div className="flex flex-wrap gap-2">
                {(["L", "M", "Q", "H"] as EccLevel[]).map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setEccLevel(lv)}
                    className={`px-3 py-1.5 text-xs rounded-xl border ${
                      eccLevel === lv
                        ? "bg-sky-500 border-sky-500 text-slate-950"
                        : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    {lv}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                Level càng cao thì QR càng dễ đọc khi bị mờ/mất góc, nhưng pattern sẽ dày hơn.
              </p>
            </div>
          </section>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex items-center justify-center rounded-xl border border-sky-500 bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isGenerating ? "Đang generate..." : "Generate QR"}
          </button>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        {/* Right side: preview + download */}
        <div className="flex flex-col items-center justify-start lg:justify-between gap-4">
          <div className="w-full">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 text-[11px] font-bold text-slate-950">
                3
              </span>
              Download your QR
            </h2>
            <div className="w-full flex justify-center">
              <div className="rounded-3xl bg-white p-5 min-h-[260px] min-w-[260px] flex items-center justify-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Generated QR"
                    className="h-60 w-60"
                  />
                ) : (
                  <div className="text-xs text-slate-400 text-center px-6">
                    Nhập nội dung và bấm &quot;Generate QR&quot; để xem preview.
                  </div>
                )}
              </div>
            </div>
          </div>

          {qrDataUrl && (
            <a
              href={qrDataUrl}
              download="qr-code.png"
              className="mt-3 inline-flex items-center justify-center rounded-full border border-slate-700 px-4 py-2 text-xs md:text-sm text-slate-100 hover:bg-slate-800"
            >
              Download QR (PNG)
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
