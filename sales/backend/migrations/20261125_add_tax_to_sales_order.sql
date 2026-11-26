-- Run once against the Sales database before deploying the backend changes.
ALTER TABLE public.sales_order
    ADD COLUMN IF NOT EXISTS tax_type VARCHAR(30) NOT NULL DEFAULT 'VAT',
    ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 12.00,
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
