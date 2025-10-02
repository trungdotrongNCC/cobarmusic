"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Genre = { id: number; name: string };

// --- Supabase client (FE) ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Buckets: audio = PRIVATE, images = PUBLIC
const AUDIO_BUCKET = "music";   // private
const IMAGE_BUCKET = "images";  // public

// util tạo path unique (path bên trong bucket)
function makePath(prefix: string, file: File) {
  const ext = file.name.split(".").pop() || "bin";
  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}/${key}.${ext}`;
}

export default function SongsClient() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<string>("0");
  const [description, setDescription] = useState("");

  // file chọn (chỉ để hiển thị tên)
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [fullFile, setFullFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // AUDIO (private) → lưu PATH (không URL)
  const [previewPath, setPreviewPath] = useState<string>("");
  const [fullPath, setFullPath] = useState<string>("");

  // IMAGE (public) → lưu PUBLIC URL
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  // trạng thái upload
  const [upPreview, setUpPreview] = useState(false);
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

  /** Upload audio lên bucket PRIVATE → trả về PATH (không public URL) */
  async function uploadAudioAndGetPath(prefix: string, file: File) {
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new Error(`File quá lớn. Giới hạn: ${Math.round(maxSize / 1024 / 1024)}MB`);
    }
    const path = makePath(prefix, file);
    const { error } = await supabase.storage.from(AUDIO_BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) throw error;
    return path; // chỉ lưu path
  }

  /** Upload ảnh lên bucket PUBLIC → trả về PUBLIC URL */
  async function uploadImageAndGetPublicUrl(prefix: string, file: File) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error(`Ảnh quá lớn. Giới hạn: ${Math.round(maxSize / 1024 / 1024)}MB`);
    }
    const path = makePath(prefix, file);
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
      contentType: file.type || "image/png",
      upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl; // URL public
  }

  // --- Handlers chọn file: upload NGAY khi chọn ---
  async function handlePickPreview(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setPreviewFile(f);
    setPreviewPath("");
    if (!f) return;
    try {
      setUpPreview(true);
      const path = await uploadAudioAndGetPath("preview", f);
      setPreviewPath(path);
      setMsg(null);
    } catch (err: any) {
      setMsg(err?.message || "Upload preview thất bại");
    } finally {
      setUpPreview(false);
    }
  }

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
    const hasTitle = !!title.trim();
    // cần previewPath + fullPath đã có (upload xong)
    return (
      hasTitle &&
      !!previewPath &&
      !!fullPath &&
      !upPreview &&
      !upFull &&
      !upAvatar &&
      !submitting
    );
  }, [title, previewPath, fullPath, upPreview, upFull, upAvatar, submitting]);

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
          previewPath, // PATH trong bucket private
          fullPath,    // PATH trong bucket private
          avatarUrl: avatarUrl || null, // public URL
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
        setPreviewFile(null);
        setFullFile(null);
        setAvatarFile(null);
        setPreviewPath("");
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

        {/* Audio files (private) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontWeight: 600 }}>
              Preview file (mp3, private) *
            </label>
            <input
              type="file"
              accept="audio/*"
              onChange={handlePickPreview}
              required
              style={{ display: "block" }}
            />
            {previewFile && (
              <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>
                {previewFile.name}
              </div>
            )}
            {upPreview && (
              <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>
                Uploading preview…
              </div>
            )}
            {previewPath && (
              <div style={{ fontSize: 12, color: "#4ade80", marginTop: 4, wordBreak: "break-all" }}>
                Preview uploaded (path): {previewPath}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600 }}>
              Full file (mp3, private) *
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
                Uploading full…
              </div>
            )}
            {fullPath && (
              <div style={{ fontSize: 12, color: "#4ade80", marginTop: 4, wordBreak: "break-all" }}>
                Full uploaded (path): {fullPath}
              </div>
            )}
          </div>
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
