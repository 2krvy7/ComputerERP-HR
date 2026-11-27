export type DeliveryStatus =
  | "pending-sales"
  | "released-inventory"
  | "received-sales"
  | "received-customer";

export interface DeliveryWarehouseAllocation {
  WH_ID: number;
  quantity: number;
}

export interface Delivery {
  delivery_id: number;
  order_id: number;
  WH_ID: number;
  delivery_date: string | null;
  delivery_address: string;
  status: DeliveryStatus;
  received_by: string | null;
  received_at: string | null;
  warehouse_allocations: DeliveryWarehouseAllocation[];
}

export interface DeliveryCreate {
  order_id: number;
  WH_ID?: number;
  delivery_date: string | null;
  delivery_address: string;
}

export interface DeliveryStatusUpdate {
  status: DeliveryStatus;
  received_by?: string;
}

export interface Warehouse {
  WH_ID: number;
  Warehouse_Name: string;
  Location: string | null;
}