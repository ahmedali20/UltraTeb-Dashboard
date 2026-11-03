import { createClient } from "@supabase/supabase-js";
import PurchasePriceVarianceClient from "./PurchasePriceVarianceClient";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function PurchasePriceVariancePage() {
  const { data, error } = await supabase
    .from("purchase_price_variances")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return <main style={{ padding: 32, color: "red" }}>{error.message}<p>Run `supabase/purchase_price_variances.sql` in Supabase SQL Editor first.</p></main>;
  }

  return <PurchasePriceVarianceClient initialRows={data ?? []} />;
}
