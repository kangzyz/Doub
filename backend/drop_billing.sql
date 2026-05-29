-- Optional cleanup: drop the billing/usage/subscription database objects.
--
-- The application no longer uses billing at all. GORM auto-migrate never DROPs,
-- so these tables/columns just sit unused after the code removal. Running this
-- script is OPTIONAL and only needed if you want a clean schema. It is
-- DESTRUCTIVE and irreversible — back up first if the data matters.
--
-- Usage (adjust connection as needed):
--   psql "$DATABASE_URL" -f backend/drop_billing.sql

BEGIN;

-- Billing tables (order chosen so dependents drop before parents; CASCADE as a safety net).
DROP TABLE IF EXISTS billing_usage_ledgers CASCADE;
DROP TABLE IF EXISTS billing_balance_transactions CASCADE;
DROP TABLE IF EXISTS billing_model_prices CASCADE;
DROP TABLE IF EXISTS billing_accounts CASCADE;
DROP TABLE IF EXISTS billing_payment_orders CASCADE;
DROP TABLE IF EXISTS billing_subscriptions CASCADE;
DROP TABLE IF EXISTS billing_prices CASCADE;
DROP TABLE IF EXISTS billing_plans CASCADE;

-- Dormant per-message billing columns on the chat_messages table.
ALTER TABLE chat_messages DROP COLUMN IF EXISTS billed_currency;
ALTER TABLE chat_messages DROP COLUMN IF EXISTS billed_nanousd;
ALTER TABLE chat_messages DROP COLUMN IF EXISTS pricing_snapshot;

-- Billing-related dynamic settings (billing.mode, billing.prepaid_amount_usd,
-- billing.payment_providers, billing.usd_to_cny_rate, billing.epay_types, ...).
DELETE FROM system_settings WHERE namespace = 'billing';

COMMIT;
