
export interface PricingAlert {
  productionID: number;
  productID: number;
  quantity: number;
  totalCost: number;
  unitCost: number;
  marginPct: number;
  minSellingPrice: number;
}

const FINANCE_API_URL =
  process.env.NEXT_PUBLIC_FINANCE_API_URL || "http://127.0.0.1:8000";

export async function fetchFinanceFloorPrices(
  marginPct = 20
): Promise<PricingAlert[]> {
  const res = await fetch(
    `${FINANCE_API_URL}/api/expense/pricing-alerts?margin_pct=${marginPct}`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  if (!res.ok) {
    throw new Error(
      `Failed to fetch Finance pricing alerts: ${res.status}`
    );
  }

  return res.json();
}

export function validateSellingPrice(
  productId: number,
  enteredUnitPrice: number,
  alerts: PricingAlert[]
): { allowed: boolean; message?: string } {
  const rule = alerts.find(
    (alert) => Number(alert.productID) === Number(productId)
  );

  if (!rule) {
    return { allowed: true };
  }

  if (enteredUnitPrice < Number(rule.minSellingPrice)) {
    return {
      allowed: false,
      message: `Blocked by Finance Policy: Unit price (${enteredUnitPrice.toLocaleString(
        "en-PH"
      )}) is below the minimum selling price of ${Number(
        rule.minSellingPrice
      ).toLocaleString("en-PH")} (Unit Cost: ${Number(
        rule.unitCost
      ).toLocaleString("en-PH")} + ${rule.marginPct}% margin).`,
    };
  }

  return { allowed: true };
}
