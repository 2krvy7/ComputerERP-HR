
export interface SalesInvoice {
  invoice_id: number;
  order_id: number;
  invoice_date: string;
  due_date: string | null;
  installment_months: number;
  interest_rate: string | number;
  interest_amount: string | number;
  total_due: string | number;
}

export interface SalesInvoiceCreate {
  order_id: number;
  invoice_date: string;
  due_date: string | null;
  installment_months: 1 | 3 | 6 | 12;
}
