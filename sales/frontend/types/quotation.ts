
export type QuotationStatus =
  | "Draft"
  | "Sent"
  | "Accepted"
  | "Rejected"
  | "Expired";

export interface QuotationDetail {
  quotation_detail_id: number;
  quotation_id: number;
  IM_ID: number;
  Item_Name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
}

export interface SalesQuotation {
  quotation_id: number;
  customer_id: number;
  quotation_date: string;
  status: QuotationStatus;
  total_amount: number;
  tax_type: "VAT";
  tax_rate: number;
  tax_amount: number;
  installment_months: 1 | 3 | 6 | 12;
  interest_rate: number;
  interest_amount: number;
  details: QuotationDetail[];
}

export interface QuotationDetailCreate {
  IM_ID: number;
  quantity: number;
  discount: number;
}

export interface SalesQuotationCreate {
  customer_id: number;
  quotation_date?: string | null;
  installment_months: 1 | 3 | 6 | 12;
  details: QuotationDetailCreate[];
}

export interface QuotationCatalogItem {
  IM_ID: number;
  SKU: string;
  Item_Name: string;
  Price: number | string | null;
}
