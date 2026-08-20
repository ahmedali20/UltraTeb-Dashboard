import { cookies } from "next/headers";
import { readDashboardSession } from "./dashboard-auth";

export async function getCurrentDashboardUser() {
  const cookieStore = await cookies();
  return readDashboardSession(cookieStore.get("ultra_teb_session")?.value);
}
