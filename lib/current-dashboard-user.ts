import { cookies } from "next/headers";
import { readDashboardSession } from "./dashboard-auth";

export async function getCurrentDashboardUser() {
  return readDashboardSession(cookies().get("ultra_teb_session")?.value);
}
