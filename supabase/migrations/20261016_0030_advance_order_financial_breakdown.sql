-- Migration: 20261016_0030_advance_order_financial_breakdown.sql
-- Description: Adds subtotal, delivery_charge, discounts, and GST breakdown columns to advance_orders table.

ALTER TABLE public.advance_orders
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_discount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS total_gst NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12,2) DEFAULT 0;

GRANT ALL ON TABLE public.advance_orders TO anon, authenticated, service_role;
