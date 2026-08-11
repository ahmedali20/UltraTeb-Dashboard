import VatSalesClient from "./VatSalesClient";
import { loadVatSalesData } from "../../lib/vat-sales-data";
import { getCurrentDashboardUser } from "../../lib/current-dashboard-user";
import { canViewPre2026Sales } from "../../lib/sales-visibility";

export const revalidate = 0;

export default async function VatReportPage() {
  const session = await getCurrentDashboardUser();
  const records = await loadVatSalesData(undefined, undefined, canViewPre2026Sales(session));
  return <VatSalesClient records={records} />;
}
