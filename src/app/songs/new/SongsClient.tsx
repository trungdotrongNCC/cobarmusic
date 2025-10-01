"use client";

import { useEffect, useState } from "react";

type Genre = { id: number; name: string };

export default function SongsClient() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<string>("0");
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<File | null>(null);
  const [full, setFull] = useState<File | null>(null);

  // NEW: avatar
  const [avatar, setAvatar] = useState<File | null>(null);

  // genres
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // lấy danh sách genres (giả sử bạn có /api/genres GET)
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!title || !preview || !full) {
      setMsg("Vui lòng nhập Title + chọn file Preview + Full.");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("price", price || "0");
      fd.append("description", description || "");
      fd.append("preview", preview);
      fd.append("full", full);
      // NEW: avatar (optional)
      if (avatar) fd.append("avatar", avatar);
      // genres
      fd.append("genreIds", JSON.stringify(selectedGenreIds));

      const r = await fetch("/api/songs", {
        method: "POST",
        body: fd,
      });

      const data = await r.json();
      if (!r.ok) {
        setMsg(data?.error || "Upload thất bại");
      } else {
        setMsg("✅ Tạo bài hát thành công!");
        // reset form nhẹ
        setTitle("");
        setPrice("0");
        setDescription("");
        setPreview(null);
        setFull(null);
        setAvatar(null);
        setSelectedGenreIds([]);
      }
    } catch (err) {
      setMsg("Lỗi mạng");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto", color: "#fff", background: "#000" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Upload Song</h1>

      <form onSubmit={onSubmit} style={{
        display: "grid",
        gap: 12,
        padding: 16,
        border: "1px solid #222",
        borderRadius: 12,
        background: "#111",
      }}>
        <div>
          <label style={{ display: "block", fontWeight: 600 }}>Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Song title"
            required
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #333", background: "#0b0b0b", color: "#fff" }}
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
              style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #333", background: "#0b0b0b", color: "#fff" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 600 }}>Genres</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {genres.map((g) => (
                <label key={g.id} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 10px", borderRadius: 999, border: "1px solid #333",
                  background: selectedGenreIds.includes(g.id) ? "#1f2937" : "#0b0b0b",
                  cursor: "pointer"
                }}>
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
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #333", background: "#0b0b0b", color: "#fff" }}
          />
        </div>

        {/* NEW: Avatar (image) */}
        <div>
          <label style={{ display: "block", fontWeight: 600 }}>Avatar (image)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setAvatar(e.target.files?.[0] ?? null)}
            style={{ display: "block" }}
          />
          {avatar && (
            <div style={{ marginTop: 8 }}>
              <img
                src={URL.createObjectURL(avatar)}
                alt="avatar preview"
                style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, border: "1px solid #333" }}
              />
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontWeight: 600 }}>Preview file (mp3) *</label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setPreview(e.target.files?.[0] ?? null)}
              required
              style={{ display: "block" }}
            />
            {preview && <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>{preview.name}</div>}
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 600 }}>Full file (mp3) *</label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setFull(e.target.files?.[0] ?? null)}
              required
              style={{ display: "block" }}
            />
            {full && <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>{full.name}</div>}
          </div>
        </div>

        <button
          disabled={loading}
          type="submit"
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#e5e7eb",
            color: "#111",
            fontWeight: 700,
            cursor: "pointer",
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? "Uploading…" : "Create"}
        </button>

        {msg && <div style={{ color: "#fff" }}>{msg}</div>}
      </form>
    </main>
  );
}
