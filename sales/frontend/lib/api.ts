
import type {
  SalesOrder,
  SalesOrderCreate,
  SalesOrderItem,
  FinishedGoodItem,
  SalesOrderStatus,
} from "../types/order";

import type {
  Delivery,
  DeliveryCreate,
  DeliveryStatus,
  Warehouse,
} from "../types/delivery";

import type {
  SalesInvoice,
  SalesInvoiceCreate,
} from "../types/invoice";

import type { AccountsReceivable } from "../types/accounts-receivable";
import type { Collection, CollectionCreate } from "../types/payment";
import type { SalesReturn, SalesReturnCreate } from "../types/return";

import type {
  Customer,
  CustomerCreate,
  CustomerUpdate,
} from "../types/customer";

import type {
  SalesQuotation,
  SalesQuotationCreate,
  QuotationCatalogItem,
  QuotationStatus,
} from "../types/quotation";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}${normalizedEndpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new Error(
      "Unable to connect to the server. Check whether the backend is running."
    );
  }

  const responseText = await response.text();

  let responseData: any = null;

  if (responseText.trim()) {
    try {
      responseData = JSON.parse(responseText);
    } catch {
      if (response.ok) {
        throw new Error("The server returned an invalid response.");
      }
    }
  }

  if (!response.ok) {
    const errorMessage =
      responseData?.detail ||
      responseData?.message ||
      responseText ||
      `Request failed with status ${response.status}.`;

    throw new Error(
      typeof errorMessage === "string"
        ? errorMessage
        : JSON.stringify(errorMessage)
    );
  }

  if (response.status === 204 || !responseText.trim()) {
    return undefined as T;
  }

  return responseData as T;
}

// AUTHENTICATION

export interface AuthUser {
  user_id: string;
  username: string;
  email: string;
  role_id: number;
  role: "SuperAdmin" | "Admin" | "Staff";
  dept_id: string | null;
  must_change_password: boolean;
}

export interface ProfileUpdate {
  username?: string;
  email?: string;
}

export interface ChangePassword {
  current_password: string;
  new_password: string;
}

export const authAPI = {
  login: (email: string, password: string) =>
    request<AuthUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request<{ message: string }>("/api/auth/logout", {
      method: "POST",
    }),

  getMe: () => request<AuthUser>("/api/auth/me"),

  updateProfile: (data: ProfileUpdate) =>
    request<AuthUser>("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  changePassword: (data: ChangePassword) =>
    request<{ message: string }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// USER MANAGEMENT

export const userAPI = {
  getAll: () => request<AuthUser[]>("/api/users"),

  create: (data: {
    full_name: string;
    email: string;
    password: string;
  }) =>
    request<AuthUser>("/api/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: { full_name: string }) =>
    request<AuthUser>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateStatus: (id: number, status: boolean) =>
    request<AuthUser>(`/api/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

// CUSTOMERS

export const customerAPI = {
  getAll: (search = "") => {
    const params = new URLSearchParams({
      active_only: "false",
      page: "1",
      page_size: "100",
    });

    if (search.trim()) {
      params.set("search", search.trim());
    }

    return request<Customer[]>(`/api/customers?${params}`);
  },

  create: (data: CustomerCreate) =>
    request<Customer>("/api/customers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: CustomerUpdate) =>
    request<Customer>(`/api/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateStatus: (id: number, status: boolean) =>
    request<Customer>(`/api/customers/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  deactivate: (id: number) =>
    request<Customer>(`/api/customers/${id}`, {
      method: "DELETE",
    }),
};

// SALES ORDERS

export const salesOrderAPI = {
  getAll: () => request<SalesOrder[]>("/api/orders"),

  getById: (id: number) => request<SalesOrder>(`/api/orders/${id}`),

  getItems: (search = "") =>
    request<SalesOrderItem[]>(
      `/api/orders/items?search=${encodeURIComponent(search)}`
    ),

  create: (data: SalesOrderCreate) =>
    request<SalesOrder>("/api/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateStatus: (id: number, status: SalesOrderStatus) =>
    request<SalesOrder>(`/api/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  getFinishedGoods: (search = "") =>
    request<FinishedGoodItem[]>(
      `/api/orders/finished-goods?search=${encodeURIComponent(search)}`
    ),

  updateSellingPrice: (
    itemId: number,
    markupPercentage: number
  ) =>
    request<FinishedGoodItem>(
      `/api/orders/items/${itemId}/selling-price`,
      {
        method: "PATCH",
        body: JSON.stringify({
          markup_percentage: markupPercentage,
        }),
      }
    ),
};

// DELIVERIES

export const deliveryAPI = {
  getAll: () => request<Delivery[]>("/api/deliveries"),

  getById: (id: number) =>
    request<Delivery>(`/api/deliveries/${id}`),

  getWarehouses: () =>
    request<Warehouse[]>("/api/deliveries/warehouses"),

  create: (data: DeliveryCreate) =>
    request<Delivery>("/api/deliveries", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateStatus: (
    id: number,
    status: DeliveryStatus,
    receivedBy?: string
  ) =>
    request<Delivery>(`/api/deliveries/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        ...(receivedBy ? { received_by: receivedBy } : {}),
      }),
    }),
};

// SALES INVOICES

export const invoiceAPI = {
  getAll: () => request<SalesInvoice[]>("/api/invoices"),

  getById: (id: number) => request<SalesInvoice>(`/api/invoices/${id}`),

  create: (data: SalesInvoiceCreate) =>
    request<SalesInvoice>("/api/invoices", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ACCOUNTS RECEIVABLE

export const accountsReceivableAPI = {
  getAll: () =>
    request<AccountsReceivable[]>("/api/accounts-receivable"),

  getById: (id: number) =>
    request<AccountsReceivable>(`/api/accounts-receivable/${id}`),
};

// PAYMENT COLLECTIONS

export const paymentCollectionAPI = {
  getAll: () => request<Collection[]>("/api/payment-collections"),

  getById: (id: number) =>
    request<Collection>(`/api/payment-collections/${id}`),

  create: (data: CollectionCreate) =>
    request<Collection>("/api/payment-collections", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// SALES RETURNS

export const salesReturnAPI = {
  getAll: () => request<SalesReturn[]>("/api/returns"),

  getById: (id: number) => request<SalesReturn>(`/api/returns/${id}`),

  create: (data: SalesReturnCreate) =>
    request<SalesReturn>("/api/returns", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};


export interface OnHandStock {
  IM_ID: number;
  SKU: string;
  Item_Name: string;
  Category: string | null;
  unit_of_measure: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  available_stock: number;
  reorder_level: number;
  status: "In Stock" | "Low Stock" | "Out of Stock";
}

export const onHandStockAPI = {
  getAll: () =>
    request<OnHandStock[]>("/api/dashboard/on-hand-stocks"),
};


// SALES QUOTATIONS

export const quotationAPI = {
  getItems: (search = "") =>
    request<QuotationCatalogItem[]>(
      `/api/quotations/items?search=${encodeURIComponent(search)}`
    ),

  getAll: () => request<SalesQuotation[]>("/api/quotations"),

  create: (data: SalesQuotationCreate) =>
    request<SalesQuotation>("/api/quotations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getById: (id: number) =>
    request<SalesQuotation>(`/api/quotations/${id}`),

  updateStatus: (id: number, status: QuotationStatus) =>
    request<SalesQuotation>(`/api/quotations/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};
