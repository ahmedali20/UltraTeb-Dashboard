import { createClient } from "@supabase/supabase-js";
import BonusItemsClient from "./BonusItemsClient";
import "./bonus-items.css";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function BonusItemsPage() {
  const { data, error } = await supabase.from("bonus_items").select("*").order("received_date", { ascending: false }).order("id", { ascending: false });
  if (error) return <main style={{ padding: 32, color: "red" }}>{error.message}<p>Run `supabase/bonus_items.sql` in Supabase SQL Editor first.</p></main>;
  return <BonusItemsClient initialRows={data ?? []} />;
}
