-- ==============================================================================
-- PROPOSED MIGRATION — DO NOT EXECUTE DIRECTLY
-- File: supabase/proposed_migrations/20261016_0029_secure_least_privilege_rls.sql
-- Status: DRAFT / PENDING STAGING VALIDATION
-- Scope: CHERAS CLOTHING POS & Inventory Management (சேராஸ் கிளோதிங்)
-- Description:
--   Establishes least-privilege Row Level Security (RLS) policies and revokes
--   unrestricted table/routine grants from the anonymous ('anon') role.
--   Protects sensitive business data (expenses, inventory audit logs, customer PII)
--   while preserving public catalog browsing and digital invoice lookup.
-- ==============================================================================

-- ==============================================================================
-- ROLLBACK SCRIPT INSTRUCTIONS (If rollback is needed):
-- Run supabase/migrations/20261004_0026_grant_table_permissions.sql to restore
-- universal permissive grants to anon and authenticated roles.
-- ==============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Helper Function: Check User Role from JWT or Profiles Table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() ->> 'role'),
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    'anon'
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PUBLIC CATALOG: categories, products, product_variants
--    - Anyone (anon/authenticated) can read active catalog items.
--    - Only authenticated 'admin' can insert, update, or delete catalog items.
-- ─────────────────────────────────────────────────────────────────────────────

-- Categories
DROP POLICY IF EXISTS categories_portal_manage ON public.categories;
DROP POLICY IF EXISTS categories_public_read ON public.categories;
DROP POLICY IF EXISTS categories_admin_manage ON public.categories;

CREATE POLICY categories_public_read ON public.categories
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE OR public.current_user_role() IN ('admin', 'staff'));

CREATE POLICY categories_admin_manage ON public.categories
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Products
DROP POLICY IF EXISTS products_portal_manage ON public.products;
DROP POLICY IF EXISTS products_public_read ON public.products;
DROP POLICY IF EXISTS products_admin_manage ON public.products;

CREATE POLICY products_public_read ON public.products
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE OR public.current_user_role() IN ('admin', 'staff'));

CREATE POLICY products_admin_manage ON public.products
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'))
  WITH CHECK (public.current_user_role() = 'admin');

-- Product Variants
DROP POLICY IF EXISTS product_variants_portal_manage ON public.product_variants;
DROP POLICY IF EXISTS product_variants_public_read ON public.product_variants;
DROP POLICY IF EXISTS product_variants_admin_manage ON public.product_variants;

CREATE POLICY product_variants_public_read ON public.product_variants
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE OR public.current_user_role() IN ('admin', 'staff'));

CREATE POLICY product_variants_admin_manage ON public.product_variants
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'))
  WITH CHECK (public.current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FINANCIAL RECORDS: expenses & expense_categories
--    - Strictly restricted to authenticated 'admin'.
--    - Zero access for 'anon' or general public.
-- ─────────────────────────────────────────────────────────────────────────────

-- Expense Categories
DROP POLICY IF EXISTS expense_categories_all ON public.expense_categories;
DROP POLICY IF EXISTS expense_categories_admin_manage ON public.expense_categories;

CREATE POLICY expense_categories_admin_manage ON public.expense_categories
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Expenses
DROP POLICY IF EXISTS expenses_all ON public.expenses;
DROP POLICY IF EXISTS expenses_admin_manage ON public.expenses;

CREATE POLICY expenses_admin_manage ON public.expenses
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. INVENTORY & AUDIT LEDGER: inventory_movements & barcode_registry
--    - movements: append-only ledger via RPC; read-only for admin & staff.
--    - barcode_registry: managed by admin & staff.
-- ─────────────────────────────────────────────────────────────────────────────

-- Inventory Movements
DROP POLICY IF EXISTS inventory_movements_all ON public.inventory_movements;
DROP POLICY IF EXISTS inventory_movements_staff_read ON public.inventory_movements;

CREATE POLICY inventory_movements_staff_read ON public.inventory_movements
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'));

-- Barcode Registry
DROP POLICY IF EXISTS barcode_registry_all ON public.barcode_registry;
DROP POLICY IF EXISTS barcode_registry_staff_manage ON public.barcode_registry;

CREATE POLICY barcode_registry_staff_manage ON public.barcode_registry
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('admin', 'staff'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ORDERS & INVOICES: orders & order_items
--    - Full table access restricted to authenticated staff and admin.
--    - Customers read invoices exclusively via public SECURITY DEFINER RPC.
-- ─────────────────────────────────────────────────────────────────────────────

-- Orders
DROP POLICY IF EXISTS orders_portal_manage ON public.orders;
DROP POLICY IF EXISTS orders_staff_manage ON public.orders;

CREATE POLICY orders_staff_manage ON public.orders
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('admin', 'staff'));

-- Order Items
DROP POLICY IF EXISTS order_items_portal_manage ON public.order_items;
DROP POLICY IF EXISTS order_items_staff_manage ON public.order_items;

CREATE POLICY order_items_staff_manage ON public.order_items
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('admin', 'staff'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ADVANCE ORDERS: advance_orders, timeline, payments
--    - Restricted to authenticated staff and admin.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow all for advance orders" ON public.advance_orders;
DROP POLICY IF EXISTS "Allow all for advance timeline" ON public.advance_order_timeline;
DROP POLICY IF EXISTS "Allow all for advance payments" ON public.advance_order_payments;

CREATE POLICY advance_orders_staff_manage ON public.advance_orders
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('admin', 'staff'));

CREATE POLICY advance_timeline_staff_manage ON public.advance_order_timeline
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('admin', 'staff'));

CREATE POLICY advance_payments_staff_manage ON public.advance_order_payments
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('admin', 'staff'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. CUSTOMER BIRTHDAYS & OFFERS
--    - Restricted to authenticated staff and admin.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins and staff can manage customer birthdays" ON public.customer_birthdays;
DROP POLICY IF EXISTS "Admins and staff can manage birthday offers" ON public.birthday_offers;

CREATE POLICY customer_birthdays_staff_manage ON public.customer_birthdays
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('admin', 'staff'));

CREATE POLICY birthday_offers_staff_manage ON public.birthday_offers
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('admin', 'staff'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. STORE SETTINGS & COUPONS
--    - Store settings: readable by all (branding), editable only by admin.
--    - Coupons: readable by all (for validation), editable only by admin.
-- ─────────────────────────────────────────────────────────────────────────────

-- Store Settings
DROP POLICY IF EXISTS store_settings_portal_manage ON public.store_settings;
CREATE POLICY store_settings_public_read ON public.store_settings
  FOR SELECT TO anon, authenticated
  USING (TRUE);

CREATE POLICY store_settings_admin_write ON public.store_settings
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Coupons
DROP POLICY IF EXISTS coupons_portal_manage ON public.coupons;
CREATE POLICY coupons_public_read ON public.coupons
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE OR public.current_user_role() IN ('admin', 'staff'));

CREATE POLICY coupons_admin_manage ON public.coupons
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RPC FUNCTION PRIVILEGES (Least-Privilege Enforcement)
--    - Revoke anonymous execution of financial and stock adjustment RPCs.
--    - Preserve public execution only for get_public_invoice_by_number.
-- ─────────────────────────────────────────────────────────────────────────────

-- Financial RPC: Admin only
REVOKE EXECUTE ON FUNCTION public.get_expense_summary_metrics(DATE) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_expense_summary_metrics(DATE) TO authenticated, service_role;

-- Stock Adjustment RPC: Staff & Admin only
REVOKE EXECUTE ON FUNCTION public.adjust_inventory_stock(BIGINT, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(BIGINT, UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- Stock Receiving & Barcode Creation: Staff & Admin only
REVOKE EXECUTE ON FUNCTION public.create_barcode_and_receive_stock(BIGINT, UUID, NUMERIC, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_barcode_and_receive_stock(BIGINT, UUID, NUMERIC, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- POS Checkout RPC: Authenticated Staff and Admin only
-- NOTE: Requires frontend to obtain an authenticated session prior to checkout
REVOKE EXECUTE ON FUNCTION public.complete_pos_sale_with_inventory(TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, TEXT, NUMERIC, TEXT, JSONB, NUMERIC, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_pos_sale_with_inventory(TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, TEXT, NUMERIC, TEXT, JSONB, NUMERIC, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ) TO authenticated, service_role;

-- Digital Invoice Lookup: Remains public so customers can view receipt links
GRANT EXECUTE ON FUNCTION public.get_public_invoice_by_number(TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
