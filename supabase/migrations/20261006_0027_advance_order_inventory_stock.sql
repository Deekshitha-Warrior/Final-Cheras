-- ==============================================================================
-- Migration: 20261006_0027_advance_order_inventory_stock.sql
-- Description: Advance order stock reservation and inventory movements support.
--              Ensures inventory_movements table supports 'advance_order' reference_type,
--              and documents stock deduction upon advance booking and restoration on cancellation.
-- ==============================================================================

-- 1. Ensure inventory_movements index on reference_type and reference_id
CREATE INDEX IF NOT EXISTS idx_inv_movements_ref
  ON public.inventory_movements(reference_type, reference_id);

-- 2. Document advance order stock deduction policy:
-- Advance orders represent customer deposit bookings that physically reserve items.
-- Stock is deducted immediately at creation and logged in inventory_movements as SALE.
-- If an advance order is cancelled or deleted prior to completion, stock is restored as RETURN.
-- When an advance order is completed, no additional stock deduction is performed.
COMMENT ON TABLE public.advance_orders IS 'Stores customer advance bookings and deposits with inventory stock reserved at booking.';
