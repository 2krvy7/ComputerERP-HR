-- Run once against the Sales database before deploying the backend changes.
ALTER TABLE public.sales_quotation
    ADD COLUMN IF NOT EXISTS tax_type VARCHAR(30) NOT NULL DEFAULT 'VAT',
    ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 12.00,
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS installment_months INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS interest_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

-- Existing quotation totals were stored as the item subtotal. Add the default
-- VAT once to existing records; their default installment is 1 month with no interest.
WITH quotation_subtotals AS (
    SELECT quotation_id, COALESCE(SUM(line_total), 0) AS subtotal
    FROM public.sales_quotation_detail
    GROUP BY quotation_id
)
UPDATE public.sales_quotation AS quotation
SET tax_amount = ROUND(subtotals.subtotal * 12 / 100, 2),
    total_amount = subtotals.subtotal + ROUND(subtotals.subtotal * 12 / 100, 2)
FROM quotation_subtotals AS subtotals
WHERE quotation.quotation_id = subtotals.quotation_id
  AND quotation.tax_amount = 0
  AND quotation.interest_amount = 0
  AND quotation.installment_months = 1;
