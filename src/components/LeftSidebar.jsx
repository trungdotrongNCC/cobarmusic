// src/components/LeftSidebar.jsx
import { cookies } from "next/headers";
import LeftSidebarClient from "./LeftSidebarClient";

export default async function LeftSidebar() {
  // Giả sử cookie "session" là JSON: { userId, email, name, avatar, credits }
  const raw = cookies().get("session")?.value;
  let me = null;
  try {
    me = raw ? JSON.parse(raw) : null;
  } catch {
    me = null;
  }

  return <LeftSidebarClient me={me} />;
}
