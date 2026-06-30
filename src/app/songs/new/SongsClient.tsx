"use client";

import { useEffect, useMemo, useState } from "react";

type Genre = { id: number; name: string };

async function uploadViaServer(file: File, type: "audio" | "image"): Promise<{ path: string; publicUrl?: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("type", type);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error || "Upload failed");
  }
  return res.json();
}


export default function SongsClient() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<string>("0");
  const [description, setDescription] = useState("");
  const [lyric, setLyric] = useState("");

  // file chọn (chỉ để hiển thị tên)
  const [fullFile, setFullFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // AUDIO (private) → lưu PATH (không URL)
  const [fullPath, setFullPath] = useState<string>("");

  // IMAGE (public) → lưu PUBLIC URL
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  // trạng thái upload
  const [upFull, setUpFull] = useState(false);
  const [upAvatar, setUpAvatar] = useState(false);

  // genres
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/genres", { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json();
        setGenres(data?.items ?? data ?? []);
      } catch {}
    })();
  }, []);

  function toggleGenre(id: number) {
    setSelectedGenreIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function uploadAudioAndGetPath(_prefix: string, file: File) {
    const { path } = await uploadViaServer(file, "audio");
    return path;
  }

  async function uploadImageAndGetPublicUrl(_prefix: string, file: File) {
    const { publicUrl } = await uploadViaServer(file, "image");
    if (!publicUrl) throw new Error("No public URL returned");
    return publicUrl;
  }

  // --- Handlers chọn file: upload NGAY khi chọn ---
  async function handlePickFull(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFullFile(f);
    setFullPath("");
    if (!f) return;
    try {
      setUpFull(true);
      const path = await uploadAudioAndGetPath("full", f);
      setFullPath(path);
      setMsg(null);
    } catch (err: any) {
      setMsg(err?.message || "Upload full thất bại");
    } finally {
      setUpFull(false);
    }
  }

  async function handlePickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setAvatarFile(f);
    setAvatarUrl("");
    if (!f) return;
    try {
      setUpAvatar(true);
      const url = await uploadImageAndGetPublicUrl("avatars", f);
      setAvatarUrl(url);
      setMsg(null);
    } catch (err: any) {
      setMsg(err?.message || "Upload avatar thất bại");
    } finally {
      setUpAvatar(false);
    }
  }

  const readyToCreate = useMemo(() => {
    return !!title.trim() && !!fullPath && !upFull && !upAvatar && !submitting;
  }, [title, fullPath, upFull, upAvatar, submitting]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!readyToCreate) {
      setMsg("Vui lòng điền Title và chờ upload xong các file.");
      return;
    }

    setSubmitting(true);
    try {
      // Gửi JSON metadata (audio = PATH; image = PUBLIC URL)
      const r = await fetch("/api/songs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          price: Number(price) || 0,
          description: description || "",
          lyric: lyric || "",
          fullPath,
          avatarUrl: avatarUrl || null,
          genreIds: selectedGenreIds,
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(data?.error || "Tạo bài hát thất bại");
      } else {
        setMsg("✅ Tạo bài hát thành công!");
        // reset form nhẹ
        setTitle("");
        setPrice("0");
        setDescription("");
        setLyric("");
        setFullFile(null);
        setAvatarFile(null);
        setFullPath("");
        setAvatarUrl("");
        setSelectedGenreIds([]);
      }
    } catch {
      setMsg("Lỗi mạng");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 720,
        margin: "0 auto",
        color: "#fff",
        background: "#000",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
        Upload Song
      </h1>

      <form
        onSubmit={onSubmit}
        style={{
          display: "grid",
          gap: 12,
          padding: 16,
          border: "1px solid #222",
          borderRadius: 12,
          background: "#111",
        }}
      >
        <div>
          <label style={{ display: "block", fontWeight: 600 }}>Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Song title"
            required
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #333",
              background: "#0b0b0b",
              color: "#fff",
            }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontWeight: 600 }}>Price</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 8,
                border: "1px solid #333",
                background: "#0b0b0b",
                color: "#fff",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 600 }}>Genres</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {genres.map((g) => (
                <label
                  key={g.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid #333",
                    background: selectedGenreIds.includes(g.id)
                      ? "#1f2937"
                      : "#0b0b0b",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedGenreIds.includes(g.id)}
                    onChange={() => toggleGenre(g.id)}
                  />
                  <span>{g.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 600 }}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #333",
              background: "#0b0b0b",
              color: "#fff",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600 }}>Lyric</label>
          <textarea
            value={lyric}
            onChange={(e) => setLyric(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #333",
              background: "#0b0b0b",
              color: "#fff",
            }}
          />
        </div>

        {/* Avatar (public) */}
        <div>
          <label style={{ display: "block", fontWeight: 600 }}>
            Avatar (image, public)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handlePickAvatar}
            style={{ display: "block" }}
          />
          {avatarFile && (
            <div style={{ marginTop: 8 }}>
              <img
                src={URL.createObjectURL(avatarFile)}
                alt="avatar preview"
                style={{
                  width: 120,
                  height: 120,
                  objectFit: "cover",
                  borderRadius: 8,
                  border: "1px solid #333",
                }}
              />
            </div>
          )}
          {upAvatar && (
            <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>
              Uploading avatar…
            </div>
          )}
          {avatarUrl && (
            <div style={{ fontSize: 12, color: "#4ade80", marginTop: 4, wordBreak: "break-all" }}>
              Avatar uploaded: {avatarUrl}
            </div>
          )}
        </div>

        {/* Audio file (private) */}
        <div>
          <label style={{ display: "block", fontWeight: 600 }}>
            Audio file (mp3) *
          </label>
          <input
            type="file"
            accept="audio/*"
            onChange={handlePickFull}
            required
            style={{ display: "block" }}
          />
          {fullFile && (
            <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>
              {fullFile.name}
            </div>
          )}
          {upFull && (
            <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>
              Uploading…
            </div>
          )}
          {fullPath && (
            <div style={{ fontSize: 12, color: "#4ade80", marginTop: 4, wordBreak: "break-all" }}>
              ✓ Uploaded
            </div>
          )}
        </div>

        <button
          disabled={!readyToCreate}
          type="submit"
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: readyToCreate ? "#e5e7eb" : "#9ca3af",
            color: "#111",
            fontWeight: 700,
            cursor: readyToCreate ? "pointer" : "not-allowed",
          }}
        >
          {submitting ? "Creating…" : "Create"}
        </button>

        {msg && <div style={{ color: "#fff" }}>{msg}</div>}
      </form>
    </main>
  );
}
