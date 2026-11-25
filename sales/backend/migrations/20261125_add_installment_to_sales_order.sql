-- Run once against the Sales database before deploying the backend changes.
ALTER TABLE public.sales_order
    ADD COLUMN IF NOT EXISTS installment_months INTEGER NOT NULL DEFAULT 1;
