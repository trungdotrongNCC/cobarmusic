// SERVER COMPONENT
import { requireRole } from "@/libs/auth";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  await requireRole("admin"); // chặn ở server; nếu không phải admin -> redirect /403
  return <UsersClient />;     // render UI client
}
