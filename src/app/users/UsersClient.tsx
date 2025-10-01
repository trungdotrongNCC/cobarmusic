"use client";

import { useEffect, useState } from "react";

type User = { id: number; email: string; name: string | null; createdAt?: string };

export default function UsersClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadUsers() {
    const res = await fetch("/api/users", { cache: "no-store" });
    if (!res.ok) {
      // Trường hợp API cũng có guard server-side và trả 401/403 (phòng xa)
      if (res.status === 401) location.href = "/login?next=/users";
      if (res.status === 403) location.href = "/403";
      return;
    }
    const data = await res.json();
    setUsers(data);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error ?? "Create failed");
      } else {
        setMsg("✅ Created!");
        setEmail("");
        setName("");
        await loadUsers();
      }
    } catch {
      setMsg("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: number) {
    if (!confirm(`Delete user #${id}?`)) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    await loadUsers();
  }

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Users</h1>

      <form
        onSubmit={onSubmit}
        style={{
          display: "grid",
          gap: 12,
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          marginBottom: 24,
        }}
      >
        <div>
          <label style={{ display: "block", fontWeight: 600 }}>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="a@example.com"
            required
            style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600 }}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            placeholder="Your name"
            style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
          />
        </div>

        <button
          disabled={loading}
          type="submit"
          style={{
            padding: "10px 14px",
            borderRadius: 6,
            border: "1px solid #111827",
            background: "#111827",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Creating…" : "Create"}
        </button>

        {msg && <div>{msg}</div>}
      </form>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>User list</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {users.length === 0 && <div>No users yet.</div>}
        {users.map((u) => (
          <div
            key={u.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{u.email}</div>
              <div style={{ color: "#6b7280" }}>{u.name ?? "—"}</div>
            </div>
            <button
              onClick={() => onDelete(u.id)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #ef4444",
                background: "white",
                color: "#ef4444",
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
