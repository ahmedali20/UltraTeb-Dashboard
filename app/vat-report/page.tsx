import VatSalesClient from "./VatSalesClient";
import { loadVatSalesData } from "../../lib/vat-sales-data";

export const revalidate = 0;

export default async function VatReportPage() {
  const records = await loadVatSalesData();
  return <VatSalesClient records={records} />;
}
