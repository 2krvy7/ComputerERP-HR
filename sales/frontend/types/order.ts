
export type SalesOrderStatus =
  | "Pending"
  | "Approved"
  | "Processing"
  | "Completed"
  | "Cancelled";

export interface SalesOrderDetail {
  order_detail_id: number;
  order_id: number;
  IM_ID: number;
  quantity: number;
  unit_price: string | number;
  discount: string | number;
  line_total: string | number;
}

export interface SalesOrder {
  order_id: number;
  customer_id: number;
  quotation_id: number | null;
  order_date: string;
  status: SalesOrderStatus;
  total_amount: string | number;
  tax_type: "VAT" | "Non-VAT" | "Tax-Exempt" | "Custom";
  tax_rate: string | number;
  tax_amount: string | number;
  installment_months: number;
  details: SalesOrderDetail[];
}

export interface SalesOrderDetailCreate {
  IM_ID: number;
  quantity: number;
  discount: number;
}

export interface SalesOrderCreate {
  customer_id: number;
  quotation_id?: number | null;
  order_date?: string;
  tax_type?: "VAT" | "Non-VAT" | "Tax-Exempt" | "Custom";
  tax_rate?: number;
  installment_months?: 1 | 3 | 6 | 12;
  details: SalesOrderDetailCreate[];
}

export interface SalesOrderItem {
  IM_ID: number;
  SKU: string;
  Item_Name: string;
  Category: string | null;
  Brand: string | null;
  unit_of_measure: string | null;
  Price: string | number | null;
  status: string | null;
  stock_available: number;
}

export interface FinishedGoodItem {
  IM_ID: number;
  SKU: string;
  Item_Name: string;
  Category: string | null;
  Brand: string | null;
  ItemType: string | null;
  unit_of_measure: string | null;
  production_cost: string | number | null;
  markup_percentage: string | number | null;
  Price: string | number | null;
  status: string | null;
}
