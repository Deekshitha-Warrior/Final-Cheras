-- ==========================================================================
-- CHERAS CLOTHING POS - CONSOLIDATED SUPABASE DATABASE MIGRATIONS
-- Total Production Migrations: 29
-- Generated: 2026-10-16T07:46:22.764Z
-- ==========================================================================

-- Administrative helper function for service_role migration execution
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  EXECUTE sql;
END;
$$;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;


-- ==========================================================================
-- MIGRATION 1 of 29: 20260716_0001_universal_look_schema.sql
-- ==========================================================================

-- Universal Look billing schema.
-- Safe to run against a fresh project or the existing Universal Look project.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_code TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  mobile TEXT NOT NULL DEFAULT '',
  email TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS public.customer_code_seq START WITH 1;

CREATE TABLE IF NOT EXISTS public.categories (
  id BIGSERIAL PRIMARY KEY,
  name_en TEXT NOT NULL UNIQUE,
  name_ta TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_ta TEXT NOT NULL DEFAULT '',
  tamil_name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  category_id BIGINT REFERENCES public.categories(id) ON DELETE SET NULL,
  remedy TEXT[] NOT NULL DEFAULT '{}',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  offer_price NUMERIC(12,2),
  purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  mrp NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  unit_type TEXT NOT NULL DEFAULT 'unit' CHECK (unit_type IN ('unit', 'weight', 'volume', 'bundle')),
  unit_label TEXT NOT NULL DEFAULT 'piece',
  unit TEXT NOT NULL DEFAULT 'piece',
  base_quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  stock_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  opening_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  stock_unit TEXT NOT NULL DEFAULT 'piece',
  low_stock_alert NUMERIC(12,3) NOT NULL DEFAULT 5,
  allow_decimal_quantity BOOLEAN NOT NULL DEFAULT FALSE,
  predefined_options JSONB NOT NULL DEFAULT '[]'::JSONB,
  description TEXT NOT NULL DEFAULT '',
  description_ta TEXT NOT NULL DEFAULT '',
  benefits TEXT NOT NULL DEFAULT '',
  benefits_ta TEXT NOT NULL DEFAULT '',
  image TEXT,
  image_url TEXT,
  sku TEXT,
  barcode TEXT,
  brand TEXT,
  supplier TEXT,
  size TEXT,
  color TEXT,
  rating NUMERIC(3,1) NOT NULL DEFAULT 5,
  has_variants BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS products_category_name_unique
  ON public.products (category_id, LOWER(BTRIM(name)))
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  size_label TEXT,
  weight_value NUMERIC(12,3),
  weight_unit TEXT,
  sku TEXT,
  barcode TEXT,
  purchase_price NUMERIC(12,2),
  mrp NUMERIC(12,2),
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  group_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_product_name_unique
  ON public.product_variants (product_id, LOWER(BTRIM(variant_name)))
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.coupons (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expiry_date TIMESTAMPTZ,
  usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  min_order_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_upper_unique ON public.coupons (UPPER(BTRIM(code)));

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT 'Customer',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  order_mode TEXT NOT NULL DEFAULT 'offline',
  order_type TEXT NOT NULL DEFAULT 'pos_sale',
  delivery_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  manual_discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  manual_discount_type TEXT NOT NULL DEFAULT 'flat',
  manual_discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  coupon_code TEXT,
  coupon_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_gst NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  payment_mode TEXT NOT NULL DEFAULT 'cash',
  split_details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL DEFAULT 'Product',
  name TEXT NOT NULL DEFAULT 'Product',
  product_tamil_name TEXT,
  tamil_name TEXT,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'piece',
  unit_type TEXT NOT NULL DEFAULT 'unit',
  base_quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  base_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoice_counter (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  counter BIGINT NOT NULL DEFAULT 0,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.invoice_counter (id, counter, year)
VALUES (1, 0, EXTRACT(YEAR FROM NOW())::INTEGER)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.store_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'Universal Look',
  owner_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '9159600067',
  email TEXT NOT NULL DEFAULT 'universallook600067@gmail.com',
  address TEXT NOT NULL DEFAULT '1/46 GNT Road, Sholavaram, Chennai - 600067',
  gst_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.store_settings (id, name, phone, email, address)
VALUES (
  1,
  'Universal Look',
  '9159600067',
  'universallook600067@gmail.com',
  '1/46 GNT Road, Sholavaram, Chennai - 600067'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  address = EXCLUDED.address,
  updated_at = NOW();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := CASE WHEN COALESCE(NEW.raw_user_meta_data ->> 'role', '') = 'admin' THEN 'admin' ELSE 'customer' END;
BEGIN
  INSERT INTO public.profiles (id, customer_code, name, mobile, email, role)
  VALUES (
    NEW.id,
    'CUST-' || LPAD(nextval('public.customer_code_seq')::TEXT, 5, '0'),
    COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'name'), ''), split_part(COALESCE(NEW.email, ''), '@', 1), 'Customer'),
    COALESCE(NEW.raw_user_meta_data ->> 'mobile', ''),
    NEW.email,
    v_role
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    mobile = EXCLUDED.mobile,
    email = EXCLUDED.email,
    updated_at = NOW();

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::JSONB) || jsonb_build_object('role', v_role)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.sync_product_category_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    SELECT name_en INTO NEW.category FROM public.categories WHERE id = NEW.category_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_product_category_name_trigger ON public.products;
CREATE TRIGGER sync_product_category_name_trigger
BEFORE INSERT OR UPDATE OF category_id ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_product_category_name();

CREATE OR REPLACE FUNCTION public.sync_category_name_to_products()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name_en IS DISTINCT FROM OLD.name_en THEN
    UPDATE public.products SET category = NEW.name_en, updated_at = NOW() WHERE category_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_category_name_to_products_trigger ON public.categories;
CREATE TRIGGER sync_category_name_to_products_trigger
AFTER UPDATE OF name_en ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.sync_category_name_to_products();

CREATE OR REPLACE FUNCTION public.ensure_one_default_variant()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.product_variants
    SET is_default = FALSE, updated_at = NOW()
    WHERE product_id = NEW.product_id AND id <> NEW.id AND is_default;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_one_default_variant_trigger ON public.product_variants;
CREATE TRIGGER ensure_one_default_variant_trigger
AFTER INSERT OR UPDATE OF is_default ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.ensure_one_default_variant();

CREATE OR REPLACE FUNCTION public.get_next_invoice_no()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_counter BIGINT;
  v_existing_max BIGINT;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(invoice_no FROM '^UL-' || v_year || '-([0-9]+)$')::BIGINT), 0)
  INTO v_existing_max
  FROM public.orders
  WHERE invoice_no ~ ('^UL-' || v_year || '-[0-9]+$');

  INSERT INTO public.invoice_counter (id, counter, year)
  VALUES (1, 1, v_year)
  ON CONFLICT (id) DO UPDATE SET
    counter = CASE
      WHEN public.invoice_counter.year = v_year
        THEN GREATEST(public.invoice_counter.counter, v_existing_max) + 1
      ELSE 1
    END,
    year = v_year,
    updated_at = NOW()
  RETURNING counter INTO v_counter;

  RETURN 'UL-' || v_year || '-' || LPAD(v_counter::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.create_order_with_stock(
  p_customer_name TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_items JSONB,
  p_shipping NUMERIC DEFAULT 0,
  p_status TEXT DEFAULT 'pending',
  p_order_mode TEXT DEFAULT 'offline',
  p_order_type TEXT DEFAULT 'pos_sale',
  p_delivery_charge NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_manual_discount_amount NUMERIC DEFAULT 0,
  p_manual_discount_type TEXT DEFAULT 'flat',
  p_manual_discount_value NUMERIC DEFAULT 0,
  p_coupon_code TEXT DEFAULT NULL,
  p_coupon_percentage NUMERIC DEFAULT 0,
  p_total_gst NUMERIC DEFAULT 0,
  p_gst_enabled BOOLEAN DEFAULT FALSE,
  p_payment_method TEXT DEFAULT 'cash',
  p_split_details JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_no TEXT;
  v_order_id UUID;
  v_subtotal NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2);
  v_item JSONB;
  v_product_id BIGINT;
  v_variant_id UUID;
  v_attempt INTEGER;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal + COALESCE((v_item ->> 'line_total')::NUMERIC, 0);
  END LOOP;

  v_total := GREATEST(
    0,
    v_subtotal + COALESCE(p_total_gst, 0) + COALESCE(p_delivery_charge, 0) + COALESCE(p_shipping, 0)
      - COALESCE(p_discount_amount, 0) - COALESCE(p_manual_discount_amount, 0)
  );

  FOR v_attempt IN 1..5 LOOP
    v_invoice_no := public.get_next_invoice_no();
    BEGIN
      INSERT INTO public.orders (
        invoice_no, user_id, customer_name, phone, address, items, subtotal, shipping, total,
        status, order_mode, order_type, delivery_charge, discount_amount, manual_discount_amount,
        manual_discount_type, manual_discount_value, coupon_code, coupon_percentage, total_gst,
        gst_amount, gst_enabled, payment_method, payment_mode, split_details
      ) VALUES (
        v_invoice_no, auth.uid(), COALESCE(NULLIF(BTRIM(p_customer_name), ''), 'Customer'),
        COALESCE(BTRIM(p_phone), ''), COALESCE(BTRIM(p_address), ''), p_items, v_subtotal,
        COALESCE(p_shipping, 0), v_total, COALESCE(NULLIF(BTRIM(p_status), ''), 'pending'),
        COALESCE(NULLIF(BTRIM(p_order_mode), ''), 'offline'), COALESCE(NULLIF(BTRIM(p_order_type), ''), 'pos_sale'),
        COALESCE(p_delivery_charge, 0), COALESCE(p_discount_amount, 0), COALESCE(p_manual_discount_amount, 0),
        COALESCE(NULLIF(BTRIM(p_manual_discount_type), ''), 'flat'), COALESCE(p_manual_discount_value, 0),
        NULLIF(BTRIM(COALESCE(p_coupon_code, '')), ''), COALESCE(p_coupon_percentage, 0),
        COALESCE(p_total_gst, 0), COALESCE(p_total_gst, 0), COALESCE(p_gst_enabled, FALSE),
        COALESCE(NULLIF(BTRIM(p_payment_method), ''), 'cash'), COALESCE(NULLIF(BTRIM(p_payment_method), ''), 'cash'),
        COALESCE(p_split_details, '{}'::JSONB)
      ) RETURNING id INTO v_order_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_product_id := NULLIF(COALESCE(v_item ->> 'product_id', v_item ->> 'id'), '')::BIGINT;
    v_variant_id := NULLIF(v_item ->> 'variant_id', '')::UUID;

    INSERT INTO public.order_items (
      order_id, product_id, variant_id, product_name, name, product_tamil_name, tamil_name,
      quantity, unit, unit_type, base_quantity, base_price, line_total, image_url, is_manual,
      discount, gst_amount, gst_rate
    ) VALUES (
      v_order_id, v_product_id, v_variant_id,
      COALESCE(NULLIF(v_item ->> 'name', ''), 'Product'), COALESCE(NULLIF(v_item ->> 'name', ''), 'Product'),
      NULLIF(v_item ->> 'tamil_name', ''), NULLIF(v_item ->> 'tamil_name', ''),
      COALESCE((v_item ->> 'quantity')::NUMERIC, 0), COALESCE(NULLIF(v_item ->> 'unit', ''), 'piece'),
      COALESCE(NULLIF(v_item ->> 'unit_type', ''), 'unit'), COALESCE((v_item ->> 'base_quantity')::NUMERIC, 1),
      COALESCE((v_item ->> 'base_price')::NUMERIC, 0), COALESCE((v_item ->> 'line_total')::NUMERIC, 0),
      NULLIF(v_item ->> 'image_url', ''), COALESCE(v_item ->> 'source' = 'manual', FALSE),
      COALESCE((v_item ->> 'discount')::NUMERIC, 0), COALESCE((v_item ->> 'gst_amount')::NUMERIC, 0),
      COALESCE((v_item ->> 'gst_rate')::NUMERIC, 0)
    );

    IF v_product_id IS NOT NULL THEN
      UPDATE public.products
      SET stock_quantity = GREATEST(stock_quantity - COALESCE((v_item ->> 'quantity')::NUMERIC, 0), 0),
          stock = GREATEST(FLOOR(stock_quantity - COALESCE((v_item ->> 'quantity')::NUMERIC, 0)), 0)::INTEGER,
          updated_at = NOW()
      WHERE id = v_product_id;
    END IF;

    IF v_variant_id IS NOT NULL THEN
      UPDATE public.product_variants
      SET stock = GREATEST(stock - COALESCE((v_item ->> 'quantity')::NUMERIC, 0), 0), updated_at = NOW()
      WHERE id = v_variant_id;
    END IF;
  END LOOP;

  IF NULLIF(BTRIM(COALESCE(p_coupon_code, '')), '') IS NOT NULL THEN
    UPDATE public.coupons
    SET usage_count = usage_count + 1, updated_at = NOW()
    WHERE UPPER(BTRIM(code)) = UPPER(BTRIM(p_coupon_code))
      AND is_active
      AND (usage_limit IS NULL OR usage_count < usage_limit);
  END IF;

  RETURN jsonb_build_object('orderId', v_order_id, 'invoiceNo', v_invoice_no, 'createdAt', NOW());
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_invoice_by_number(p_invoice_no TEXT)
RETURNS SETOF public.orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.orders WHERE invoice_no = NULLIF(BTRIM(p_invoice_no), '') LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_invoice_by_number(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_by_number(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock(
  TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC,
  TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC, BOOLEAN, TEXT, JSONB
) TO anon, authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_portal_manage ON public.profiles;
CREATE POLICY profiles_portal_manage ON public.profiles FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS categories_portal_manage ON public.categories;
CREATE POLICY categories_portal_manage ON public.categories FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS products_portal_manage ON public.products;
CREATE POLICY products_portal_manage ON public.products FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS product_variants_portal_manage ON public.product_variants;
CREATE POLICY product_variants_portal_manage ON public.product_variants FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS coupons_portal_manage ON public.coupons;
CREATE POLICY coupons_portal_manage ON public.coupons FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS orders_portal_manage ON public.orders;
CREATE POLICY orders_portal_manage ON public.orders FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS order_items_portal_manage ON public.order_items;
CREATE POLICY order_items_portal_manage ON public.order_items FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS store_settings_portal_manage ON public.store_settings;
CREATE POLICY store_settings_portal_manage ON public.store_settings FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('invoices', 'invoices', TRUE, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = TRUE, file_size_limit = 10485760, allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS invoices_public_read ON storage.objects;
CREATE POLICY invoices_public_read ON storage.objects FOR SELECT TO public USING (bucket_id = 'invoices');
DROP POLICY IF EXISTS invoices_portal_upload ON storage.objects;
CREATE POLICY invoices_portal_upload ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'invoices');
DROP POLICY IF EXISTS invoices_portal_update ON storage.objects;
CREATE POLICY invoices_portal_update ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'invoices') WITH CHECK (bucket_id = 'invoices');

CREATE INDEX IF NOT EXISTS products_category_id_idx ON public.products(category_id);
CREATE INDEX IF NOT EXISTS products_active_sort_idx ON public.products(is_active, sort_order);
CREATE INDEX IF NOT EXISTS variants_product_id_idx ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_phone_idx ON public.orders(phone);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items(order_id);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

-- ==========================================================================
-- MIGRATION 2 of 29: 20260716_0002_universal_look_catalog.sql
-- ==========================================================================

-- Universal Look initial catalog. Existing matching products are preserved.

INSERT INTO public.categories (name_en, name_ta, is_active, sort_order)
VALUES
  ('Tailoring', '', TRUE, 1),
  ('Jewellery & Accessories', '', TRUE, 2),
  ('Posstore', '', TRUE, 3)
ON CONFLICT (name_en) DO UPDATE SET
  is_active = TRUE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

WITH catalog(category_name, product_name, sort_order) AS (
  VALUES
    ('Tailoring', 'Saree Blouse', 101),
    ('Tailoring', 'Saree Blouse + Cup', 102),
    ('Tailoring', 'Readymade Saree', 103),
    ('Tailoring', 'Punjabi Suit', 104),
    ('Tailoring', 'Punjabi Suit + Salwar', 105),
    ('Tailoring', 'Baju Kurung', 106),
    ('Tailoring', 'Baju Kebaya', 107),
    ('Tailoring', 'Baju Melaya', 108),
    ('Tailoring', 'Lehelga', 109),
    ('Tailoring', 'Alterations', 110),
    ('Tailoring', 'Pavadai Sattai', 111),
    ('Tailoring', 'Designs', 112),
    ('Tailoring', 'Add-ons', 113),
    ('Jewellery & Accessories', 'Earrings', 201),
    ('Jewellery & Accessories', 'Bridal Jewellery Rent', 202),
    ('Jewellery & Accessories', 'Choker Set', 203),
    ('Jewellery & Accessories', 'Anklet', 204),
    ('Jewellery & Accessories', 'Add-ons', 205),
    ('Posstore', 'Claim Parcel', 301),
    ('Posstore', 'Perfume', 302),
    ('Posstore', 'Add-ons', 303)
), resolved AS (
  SELECT c.id AS category_id, c.name_en AS category_name, catalog.product_name, catalog.sort_order
  FROM catalog
  JOIN public.categories c ON LOWER(c.name_en) = LOWER(catalog.category_name)
)
INSERT INTO public.products (
  name, category, category_id, price, purchase_price, mrp, unit_type, unit_label,
  unit, base_quantity, stock_quantity, opening_stock, stock, stock_unit,
  allow_decimal_quantity, predefined_options, description, is_active, sort_order
)
SELECT
  resolved.product_name,
  resolved.category_name,
  resolved.category_id,
  0,
  0,
  0,
  'unit',
  'piece',
  'piece',
  1,
  999,
  999,
  999,
  'piece',
  FALSE,
  '[]'::JSONB,
  resolved.product_name || ' service or product',
  TRUE,
  resolved.sort_order
FROM resolved
WHERE NOT EXISTS (
  SELECT 1
  FROM public.products p
  WHERE p.category_id = resolved.category_id
    AND LOWER(BTRIM(p.name)) = LOWER(BTRIM(resolved.product_name))
);

UPDATE public.products p
SET is_active = TRUE,
    category = c.name_en,
    updated_at = NOW()
FROM public.categories c
WHERE p.category_id = c.id
  AND c.name_en IN ('Tailoring', 'Jewellery & Accessories', 'Posstore');

WITH catalog(category_name, product_name, sort_order) AS (
  VALUES
    ('Tailoring', 'Saree Blouse', 101),
    ('Tailoring', 'Saree Blouse + Cup', 102),
    ('Tailoring', 'Readymade Saree', 103),
    ('Tailoring', 'Punjabi Suit', 104),
    ('Tailoring', 'Punjabi Suit + Salwar', 105),
    ('Tailoring', 'Baju Kurung', 106),
    ('Tailoring', 'Baju Kebaya', 107),
    ('Tailoring', 'Baju Melaya', 108),
    ('Tailoring', 'Lehelga', 109),
    ('Tailoring', 'Alterations', 110),
    ('Tailoring', 'Pavadai Sattai', 111),
    ('Tailoring', 'Designs', 112),
    ('Tailoring', 'Add-ons', 113),
    ('Jewellery & Accessories', 'Earrings', 201),
    ('Jewellery & Accessories', 'Bridal Jewellery Rent', 202),
    ('Jewellery & Accessories', 'Choker Set', 203),
    ('Jewellery & Accessories', 'Anklet', 204),
    ('Jewellery & Accessories', 'Add-ons', 205),
    ('Posstore', 'Claim Parcel', 301),
    ('Posstore', 'Perfume', 302),
    ('Posstore', 'Add-ons', 303)
)
UPDATE public.products p
SET name = catalog.product_name,
    sort_order = catalog.sort_order,
    updated_at = NOW()
FROM catalog
JOIN public.categories c ON LOWER(c.name_en) = LOWER(catalog.category_name)
WHERE p.category_id = c.id
  AND LOWER(BTRIM(p.name)) = LOWER(BTRIM(catalog.product_name));

-- ==========================================================================
-- MIGRATION 3 of 29: 20260716_0003_order_rpc_compatibility.sql
-- ==========================================================================

-- Align the live legacy billing schema with the current Universal Look RPC payload.
-- Idempotent: safe for both upgraded and freshly migrated projects.

BEGIN;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gst_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS split_details JSONB NOT NULL DEFAULT '{}'::JSONB;

-- Keep one order-item shape that works with both the legacy and current schemas.
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_name TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'catalogue';
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS note TEXT;

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq;

-- Prevent collisions when a sequence is introduced after invoices already exist.
DO $$
DECLARE
  v_max_suffix BIGINT;
  v_sequence_value BIGINT;
BEGIN
  SELECT COALESCE(MAX((regexp_match(invoice_no, '-([0-9]+)$'))[1]::BIGINT), 0)
  INTO v_max_suffix
  FROM public.orders
  WHERE invoice_no ~ '-[0-9]+$';

  SELECT last_value INTO v_sequence_value FROM public.invoice_number_seq;
  PERFORM setval(
    'public.invoice_number_seq',
    GREATEST(v_max_suffix, v_sequence_value, 1),
    TRUE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_invoice_no()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
  SELECT 'UL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
         LPAD(nextval('public.invoice_number_seq')::TEXT, 6, '0');
$$;

CREATE OR REPLACE FUNCTION public.create_order_with_stock(
  p_customer_name TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_items JSONB,
  p_shipping NUMERIC DEFAULT 0,
  p_status TEXT DEFAULT 'pending',
  p_order_mode TEXT DEFAULT 'offline',
  p_order_type TEXT DEFAULT 'pos_sale',
  p_delivery_charge NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_manual_discount_amount NUMERIC DEFAULT 0,
  p_manual_discount_type TEXT DEFAULT 'flat',
  p_manual_discount_value NUMERIC DEFAULT 0,
  p_coupon_code TEXT DEFAULT NULL,
  p_coupon_percentage NUMERIC DEFAULT 0,
  p_total_gst NUMERIC DEFAULT 0,
  p_gst_enabled BOOLEAN DEFAULT FALSE,
  p_payment_method TEXT DEFAULT 'cash',
  p_split_details JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_no TEXT;
  v_order_id UUID;
  v_subtotal NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2);
  v_item JSONB;
  v_quantity NUMERIC(12,3);
  v_price NUMERIC(12,2);
  v_line_total NUMERIC(12,2);
  v_source TEXT;
  v_attempt INTEGER;
  v_uses_typed_item_ids BOOLEAN;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_quantity := GREATEST(COALESCE(NULLIF(v_item ->> 'quantity', '')::NUMERIC, 0), 0);
    v_price := GREATEST(COALESCE(NULLIF(v_item ->> 'base_price', '')::NUMERIC, 0), 0);
    v_line_total := GREATEST(
      COALESCE(NULLIF(v_item ->> 'line_total', '')::NUMERIC, v_quantity * v_price),
      0
    );

    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be greater than zero';
    END IF;

    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  v_total := GREATEST(
    ROUND(
      v_subtotal + GREATEST(COALESCE(p_shipping, 0), 0)
        + GREATEST(COALESCE(p_delivery_charge, 0), 0)
        + GREATEST(COALESCE(p_total_gst, 0), 0)
        - GREATEST(COALESCE(p_discount_amount, 0), 0)
        - GREATEST(COALESCE(p_manual_discount_amount, 0), 0),
      2
    ),
    0
  );

  SELECT data_type = 'bigint'
  INTO v_uses_typed_item_ids
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'product_id';

  FOR v_attempt IN 1..5 LOOP
    v_invoice_no := public.get_next_invoice_no();
    v_order_id := gen_random_uuid();

    BEGIN
      INSERT INTO public.orders (
        id, invoice_no, user_id, customer_name, phone, address, items, subtotal, shipping, total,
        status, order_mode, order_type, delivery_charge, discount_amount, manual_discount_amount,
        manual_discount_type, manual_discount_value, coupon_code, coupon_percentage, total_gst,
        gst_amount, gst_enabled, payment_method, payment_mode, split_details, created_at, updated_at
      ) VALUES (
        v_order_id, v_invoice_no, auth.uid(),
        COALESCE(NULLIF(BTRIM(p_customer_name), ''), 'Walk-in Customer'),
        COALESCE(BTRIM(p_phone), ''), COALESCE(NULLIF(BTRIM(p_address), ''), 'POS Counter'),
        p_items, v_subtotal, GREATEST(COALESCE(p_shipping, 0), 0), v_total,
        COALESCE(NULLIF(BTRIM(p_status), ''), 'pending'),
        COALESCE(NULLIF(BTRIM(p_order_mode), ''), 'offline'),
        COALESCE(NULLIF(BTRIM(p_order_type), ''), 'pos_sale'),
        GREATEST(COALESCE(p_delivery_charge, 0), 0),
        GREATEST(COALESCE(p_discount_amount, 0), 0),
        GREATEST(COALESCE(p_manual_discount_amount, 0), 0),
        COALESCE(NULLIF(BTRIM(p_manual_discount_type), ''), 'flat'),
        GREATEST(COALESCE(p_manual_discount_value, 0), 0),
        NULLIF(BTRIM(COALESCE(p_coupon_code, '')), ''),
        GREATEST(COALESCE(p_coupon_percentage, 0), 0),
        GREATEST(COALESCE(p_total_gst, 0), 0), GREATEST(COALESCE(p_total_gst, 0), 0),
        COALESCE(p_gst_enabled, FALSE),
        COALESCE(NULLIF(BTRIM(p_payment_method), ''), 'cash'),
        COALESCE(NULLIF(BTRIM(p_payment_method), ''), 'cash'),
        COALESCE(p_split_details, '{}'::JSONB), NOW(), NOW()
      );
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt = 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_quantity := GREATEST(COALESCE(NULLIF(v_item ->> 'quantity', '')::NUMERIC, 0), 0);
    v_price := GREATEST(COALESCE(NULLIF(v_item ->> 'base_price', '')::NUMERIC, 0), 0);
    v_line_total := GREATEST(
      COALESCE(NULLIF(v_item ->> 'line_total', '')::NUMERIC, v_quantity * v_price),
      0
    );
    v_source := COALESCE(NULLIF(v_item ->> 'source', ''), 'catalogue');

    IF v_uses_typed_item_ids THEN
      INSERT INTO public.order_items (
        order_id, product_id, variant_id, product_name, tamil_name, variant_name,
        quantity, unit, unit_price, line_total, is_manual, source, note
      ) VALUES (
        v_order_id, NULLIF(COALESCE(v_item ->> 'product_id', v_item ->> 'id'), '')::BIGINT,
        NULLIF(v_item ->> 'variant_id', '')::UUID, COALESCE(NULLIF(v_item ->> 'name', ''), 'Product'),
        NULLIF(v_item ->> 'tamil_name', ''), NULLIF(v_item ->> 'variant_name', ''),
        v_quantity, COALESCE(NULLIF(v_item ->> 'unit', ''), 'piece'), v_price, v_line_total,
        v_source = 'manual', v_source, NULLIF(v_item ->> 'note', '')
      );
    ELSE
      INSERT INTO public.order_items (
        order_id, product_id, variant_id, product_name, tamil_name, variant_name,
        quantity, unit, unit_price, line_total, is_manual, source, note
      ) VALUES (
        v_order_id, NULLIF(COALESCE(v_item ->> 'product_id', v_item ->> 'id'), ''),
        NULLIF(v_item ->> 'variant_id', ''), COALESCE(NULLIF(v_item ->> 'name', ''), 'Product'),
        NULLIF(v_item ->> 'tamil_name', ''), NULLIF(v_item ->> 'variant_name', ''),
        v_quantity, COALESCE(NULLIF(v_item ->> 'unit', ''), 'piece'), v_price, v_line_total,
        v_source = 'manual', v_source, NULLIF(v_item ->> 'note', '')
      );
    END IF;

    IF COALESCE(v_item ->> 'product_id', v_item ->> 'id', '') ~ '^[0-9]+$' THEN
      UPDATE public.products
      SET stock_quantity = GREATEST(stock_quantity - v_quantity, 0),
          stock = GREATEST(FLOOR(stock_quantity - v_quantity), 0)::INTEGER,
          updated_at = NOW()
      WHERE id::TEXT = COALESCE(v_item ->> 'product_id', v_item ->> 'id');
    END IF;

    IF NULLIF(v_item ->> 'variant_id', '') IS NOT NULL THEN
      UPDATE public.product_variants
      SET stock = GREATEST(stock - v_quantity, 0), updated_at = NOW()
      WHERE id::TEXT = v_item ->> 'variant_id';
    END IF;
  END LOOP;

  IF NULLIF(BTRIM(COALESCE(p_coupon_code, '')), '') IS NOT NULL THEN
    UPDATE public.coupons
    SET usage_count = usage_count + 1
    WHERE UPPER(BTRIM(code)) = UPPER(BTRIM(p_coupon_code))
      AND is_active
      AND (usage_limit IS NULL OR usage_count < usage_limit);
  END IF;

  RETURN jsonb_build_object(
    'orderId', v_order_id,
    'invoiceNo', v_invoice_no,
    'createdAt', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_with_stock(
  TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC,
  TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC, BOOLEAN, TEXT, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_order_with_stock(
  TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC,
  TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC, BOOLEAN, TEXT, JSONB
) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ==========================================================================
-- MIGRATION 4 of 29: 20260719_0004_advance_orders.sql
-- ==========================================================================

begin;

create sequence if not exists public.deposit_number_seq start 1;

alter table public.order_items add column if not exists category text;

create table if not exists public.advance_orders (
  id uuid primary key default gen_random_uuid(),
  deposit_id text not null unique,
  customer_name text not null,
  phone text not null,
  address text not null default '',
  product_name text not null,
  products jsonb not null default '[]'::jsonb,
  category text not null default '',
  description text not null default '',
  total_amount numeric(12,2) not null check (total_amount > 0),
  deposit_amount numeric(12,2) not null check (deposit_amount > 0),
  remaining_balance numeric(12,2) generated always as (total_amount - deposit_amount) stored,
  expected_delivery_date date not null,
  status text not null default 'pending_deposit' check (status in ('pending_deposit','ready_for_delivery','waiting_final_payment','completed','cancelled')),
  remarks text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_order_id uuid unique references public.orders(id),
  invoice_number text unique,
  final_payment_method text,
  constraint advance_deposit_less_than_total check (deposit_amount < total_amount)
);

alter table public.advance_orders add column if not exists products jsonb not null default '[]'::jsonb;

create table if not exists public.advance_order_timeline (
  id bigint generated always as identity primary key,
  advance_order_id uuid not null references public.advance_orders(id) on delete cascade,
  event_type text not null,
  label text not null,
  remarks text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.advance_order_payments (
  id uuid primary key default gen_random_uuid(),
  advance_order_id uuid not null references public.advance_orders(id) on delete cascade,
  payment_type text not null check (payment_type in ('deposit','remaining')),
  amount numeric(12,2) not null check (amount >= 0),
  payment_method text not null check (payment_method in ('cash','upi','card')),
  remarks text not null default '',
  received_by uuid references auth.users(id) on delete set null,
  received_at timestamptz not null default now(),
  unique (advance_order_id, payment_type)
);

create index if not exists advance_orders_created_idx on public.advance_orders(created_at desc);
create index if not exists advance_orders_status_idx on public.advance_orders(status);
create index if not exists advance_orders_delivery_idx on public.advance_orders(expected_delivery_date);
create index if not exists advance_order_timeline_order_idx on public.advance_order_timeline(advance_order_id, created_at);
create index if not exists advance_order_payments_order_idx on public.advance_order_payments(advance_order_id, received_at);

drop function if exists public.create_advance_order(text,text,text,text,text,text,numeric,numeric,date,text,text,text);
create or replace function public.create_advance_order(
  p_customer_name text, p_phone text, p_address text, p_product_name text,
  p_category text, p_description text, p_total_amount numeric, p_deposit_amount numeric,
  p_expected_delivery_date date, p_remarks text, p_payment_method text, p_created_by_name text,
  p_products jsonb default '[]'::jsonb
)
returns public.advance_orders
language plpgsql security definer set search_path = public
as $$
declare v_order public.advance_orders; v_now timestamptz := now(); v_deposit_id text;
begin
  if trim(coalesce(p_customer_name,'')) = '' then raise exception 'Customer name is required'; end if;
  if trim(coalesce(p_phone,'')) = '' then raise exception 'Phone number is required'; end if;
  if trim(coalesce(p_product_name,'')) = '' then raise exception 'Product name is required'; end if;
  if coalesce(p_total_amount,0) <= 0 then raise exception 'Total amount must be greater than zero'; end if;
  if coalesce(p_deposit_amount,0) <= 0 or p_deposit_amount >= p_total_amount then raise exception 'Deposit must be greater than zero and less than the total amount'; end if;
  if lower(coalesce(p_payment_method,'')) not in ('cash','upi','card') then raise exception 'Select a valid deposit payment method'; end if;
  v_deposit_id := 'DEP-' || to_char(v_now at time zone 'Asia/Kolkata','YYYYMMDD') || '-' || lpad(nextval('public.deposit_number_seq')::text,4,'0');
  insert into public.advance_orders(deposit_id,customer_name,phone,address,product_name,products,category,description,total_amount,deposit_amount,expected_delivery_date,remarks,created_by,created_by_name,created_at,updated_at)
  values(v_deposit_id,trim(p_customer_name),trim(p_phone),trim(coalesce(p_address,'')),trim(p_product_name),case when jsonb_typeof(coalesce(p_products,'[]'::jsonb))='array' then coalesce(p_products,'[]'::jsonb) else '[]'::jsonb end,trim(coalesce(p_category,'')),trim(coalesce(p_description,'')),round(p_total_amount,2),round(p_deposit_amount,2),p_expected_delivery_date,trim(coalesce(p_remarks,'')),auth.uid(),trim(coalesce(p_created_by_name,'')),v_now,v_now)
  returning * into v_order;
  insert into public.advance_order_payments(advance_order_id,payment_type,amount,payment_method,remarks,received_by,received_at)
  values(v_order.id,'deposit',v_order.deposit_amount,lower(p_payment_method),coalesce(p_remarks,''),auth.uid(),v_now);
  insert into public.advance_order_timeline(advance_order_id,event_type,label,created_by,created_at) values
    (v_order.id,'created','Created',auth.uid(),v_now),
    (v_order.id,'deposit_received','Deposit Received',auth.uid(),v_now);
  return v_order;
end;
$$;

create or replace function public.update_advance_order_status(p_order_id uuid, p_status text, p_remarks text default '')
returns public.advance_orders
language plpgsql security definer set search_path = public
as $$
declare v_order public.advance_orders; v_label text;
begin
  if p_status not in ('pending_deposit','ready_for_delivery','waiting_final_payment','cancelled') then raise exception 'Invalid status transition'; end if;
  select * into v_order from public.advance_orders where id=p_order_id for update;
  if not found then raise exception 'Advance order not found'; end if;
  if v_order.status='completed' then raise exception 'A completed order cannot be changed'; end if;
  v_label := case p_status when 'ready_for_delivery' then 'Tailoring Completed' when 'waiting_final_payment' then 'Customer Contacted' when 'cancelled' then 'Cancelled' else 'Pending Deposit' end;
  update public.advance_orders set status=p_status,remarks=case when trim(coalesce(p_remarks,''))='' then remarks else p_remarks end,updated_at=now() where id=p_order_id returning * into v_order;
  insert into public.advance_order_timeline(advance_order_id,event_type,label,remarks,created_by) values(p_order_id,p_status,v_label,coalesce(p_remarks,''),auth.uid());
  return v_order;
end;
$$;

create or replace function public.add_advance_order_event(p_order_id uuid, p_event_type text, p_label text, p_remarks text default '')
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists(select 1 from public.advance_orders where id=p_order_id) then raise exception 'Advance order not found'; end if;
  insert into public.advance_order_timeline(advance_order_id,event_type,label,remarks,created_by) values(p_order_id,p_event_type,p_label,coalesce(p_remarks,''),auth.uid());
end;
$$;

create or replace function public.complete_advance_order(p_order_id uuid, p_payment_method text, p_remarks text default '')
returns table(order_id uuid, invoice_no text, completed_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare v_advance public.advance_orders; v_order_id uuid := gen_random_uuid(); v_invoice text; v_now timestamptz := now(); v_items jsonb; v_item jsonb;
begin
  if lower(coalesce(p_payment_method,'')) not in ('cash','upi','card') then raise exception 'Select a valid payment method'; end if;
  select * into v_advance from public.advance_orders where id=p_order_id for update;
  if not found then raise exception 'Advance order not found'; end if;
  if v_advance.status='cancelled' then raise exception 'A cancelled order cannot be completed'; end if;
  if v_advance.completed_order_id is not null or v_advance.invoice_number is not null then raise exception 'Invoice already generated for this order'; end if;
  v_invoice := 'UL-' || to_char(v_now at time zone 'Asia/Kolkata','YYYYMMDD') || '-' || lpad(nextval('public.invoice_number_seq')::text,6,'0');
  v_items := case when jsonb_typeof(v_advance.products)='array' and jsonb_array_length(v_advance.products)>0 then v_advance.products else jsonb_build_array(jsonb_build_object('name',v_advance.product_name,'category',v_advance.category,'description',v_advance.description,'quantity',1,'base_price',v_advance.total_amount,'line_total',v_advance.total_amount,'unit','piece','unit_type','unit','source','advance_order')) end;
  insert into public.orders(id,invoice_no,customer_name,phone,address,user_id,items,subtotal,total,status,order_mode,order_type,shipping,delivery_charge,discount_amount,manual_discount_amount,payment_mode,payment_method,created_at,updated_at)
  values(v_order_id,v_invoice,v_advance.customer_name,v_advance.phone,v_advance.address,auth.uid(),v_items,v_advance.total_amount,v_advance.total_amount,'completed','offline','advance_order',0,0,0,0,lower(p_payment_method),lower(p_payment_method),v_now,v_now);
  for v_item in select value from jsonb_array_elements(v_items) loop
    insert into public.order_items(order_id,product_name,category,quantity,unit,unit_price,line_total,is_manual,source,note)
    values(v_order_id,coalesce(nullif(v_item->>'name',''),'Product'),coalesce(nullif(v_item->>'category',''),v_advance.category),greatest(coalesce(nullif(v_item->>'quantity','')::numeric,1),0),coalesce(nullif(v_item->>'unit',''),'piece'),greatest(coalesce(nullif(v_item->>'base_price','')::numeric,0),0),greatest(coalesce(nullif(v_item->>'line_total','')::numeric,0),0),false,'advance_order',coalesce(nullif(v_item->>'note',''),v_advance.description));
  end loop;
  insert into public.advance_order_payments(advance_order_id,payment_type,amount,payment_method,remarks,received_by,received_at)
  values(p_order_id,'remaining',v_advance.remaining_balance,lower(p_payment_method),coalesce(p_remarks,''),auth.uid(),v_now);
  update public.advance_orders set status='completed',completed_at=v_now,completed_order_id=v_order_id,invoice_number=v_invoice,final_payment_method=lower(p_payment_method),remarks=case when trim(coalesce(p_remarks,''))='' then remarks else p_remarks end,updated_at=v_now where id=p_order_id;
  insert into public.advance_order_timeline(advance_order_id,event_type,label,remarks,created_by,created_at) values
    (p_order_id,'remaining_payment_received','Remaining Payment Received',coalesce(p_remarks,''),auth.uid(),v_now),
    (p_order_id,'invoice_generated','Invoice Generated',v_invoice,auth.uid(),v_now);
  return query select v_order_id,v_invoice,v_now;
end;
$$;

alter table public.advance_orders enable row level security;
alter table public.advance_order_timeline enable row level security;
alter table public.advance_order_payments enable row level security;

drop policy if exists "Allow all for advance orders" on public.advance_orders;
create policy "Allow all for advance orders" on public.advance_orders for all using (true) with check (true);

drop policy if exists "Allow all for advance timeline" on public.advance_order_timeline;
create policy "Allow all for advance timeline" on public.advance_order_timeline for all using (true) with check (true);

drop policy if exists "Allow all for advance payments" on public.advance_order_payments;
create policy "Allow all for advance payments" on public.advance_order_payments for all using (true) with check (true);

grant usage, select on sequence public.deposit_number_seq to public, anon, authenticated;
grant usage, select on sequence public.invoice_number_seq to public, anon, authenticated;

grant select, insert, update, delete on public.advance_orders to public, anon, authenticated;
grant select, insert, update, delete on public.advance_order_timeline to public, anon, authenticated;
grant select, insert, update, delete on public.advance_order_payments to public, anon, authenticated;

grant execute on function public.create_advance_order(text,text,text,text,text,text,numeric,numeric,date,text,text,text,jsonb) to public, anon, authenticated;
grant execute on function public.update_advance_order_status(uuid,text,text) to public, anon, authenticated;
grant execute on function public.add_advance_order_event(uuid,text,text,text) to public, anon, authenticated;
grant execute on function public.complete_advance_order(uuid,text,text) to public, anon, authenticated;

notify pgrst, 'reload schema';
commit;

-- ==========================================================================
-- MIGRATION 5 of 29: 20260722_0005_eight_digit_invoice_numbers.sql
-- ==========================================================================

-- Migration: 8-digit Invoice Number Generation
-- Ensures invoice numbers are strictly 8 digits in total (e.g., 10000001, 10000002...)

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START WITH 10000001;

CREATE OR REPLACE FUNCTION public.get_next_invoice_no()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
  SELECT LPAD(nextval('public.invoice_number_seq')::TEXT, 8, '0');
$$;

-- ==========================================================================
-- MIGRATION 6 of 29: 20260724_0006_fix_complete_advance_order.sql
-- ==========================================================================

-- Migration: Fix complete_advance_order RPC
-- The previous version referenced columns (unit_price, source, note) that do
-- not exist in the order_items table. This patch corrects the insert to use
-- the actual column names: base_price, line_total, is_manual.

CREATE OR REPLACE FUNCTION public.complete_advance_order(
  p_order_id uuid,
  p_payment_method text,
  p_remarks text DEFAULT ''
)
RETURNS TABLE(order_id uuid, invoice_no text, completed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advance        public.advance_orders;
  v_order_id       uuid := gen_random_uuid();
  v_invoice        text;
  v_now            timestamptz := now();
  v_items          jsonb;
  v_item           jsonb;
BEGIN
  -- Validate payment method
  IF lower(coalesce(p_payment_method, '')) NOT IN ('cash', 'upi', 'card') THEN
    RAISE EXCEPTION 'Select a valid payment method';
  END IF;

  -- Lock and fetch the advance order
  SELECT * INTO v_advance FROM public.advance_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Advance order not found';
  END IF;
  IF v_advance.status = 'cancelled' THEN
    RAISE EXCEPTION 'A cancelled order cannot be completed';
  END IF;
  IF v_advance.completed_order_id IS NOT NULL OR v_advance.invoice_number IS NOT NULL THEN
    RAISE EXCEPTION 'Invoice already generated for this order';
  END IF;

  -- Generate invoice number using the existing 8-digit sequence
  v_invoice := LPAD(nextval('public.invoice_number_seq')::TEXT, 8, '0');

  -- Build items JSONB — prefer products array, fall back to single product
  v_items := CASE
    WHEN jsonb_typeof(v_advance.products) = 'array' AND jsonb_array_length(v_advance.products) > 0
      THEN v_advance.products
    ELSE jsonb_build_array(
      jsonb_build_object(
        'name',        v_advance.product_name,
        'category',    v_advance.category,
        'description', v_advance.description,
        'quantity',    1,
        'base_price',  v_advance.total_amount,
        'line_total',  v_advance.total_amount,
        'unit',        'piece',
        'unit_type',   'unit',
        'source',      'advance_order'
      )
    )
  END;

  -- Create the final sale order
  INSERT INTO public.orders (
    id, invoice_no, customer_name, phone, address, user_id,
    items, subtotal, total, status, order_mode, order_type,
    shipping, delivery_charge, discount_amount, manual_discount_amount,
    payment_mode, payment_method, created_at, updated_at
  ) VALUES (
    v_order_id, v_invoice,
    v_advance.customer_name, v_advance.phone, v_advance.address, auth.uid(),
    v_items, v_advance.total_amount, v_advance.total_amount,
    'completed', 'offline', 'advance_order',
    0, 0, 0, 0,
    lower(p_payment_method), lower(p_payment_method),
    v_now, v_now
  );

  -- Insert order_items using the CORRECT column names from the schema
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
    INSERT INTO public.order_items (
      order_id, product_name, name, quantity, unit, unit_type,
      base_price, line_total, is_manual
    ) VALUES (
      v_order_id,
      coalesce(nullif(trim(v_item->>'name'), ''), 'Product'),
      coalesce(nullif(trim(v_item->>'name'), ''), 'Product'),
      greatest(coalesce((v_item->>'quantity')::numeric, 1), 0),
      coalesce(nullif(v_item->>'unit', ''), 'piece'),
      coalesce(nullif(v_item->>'unit_type', ''), 'unit'),
      greatest(coalesce((v_item->>'base_price')::numeric, 0), 0),
      greatest(coalesce((v_item->>'line_total')::numeric, 0), 0),
      false
    );
  END LOOP;

  -- Record the final payment received
  INSERT INTO public.advance_order_payments (
    advance_order_id, payment_type, amount, payment_method, remarks, received_by, received_at
  ) VALUES (
    p_order_id, 'remaining', v_advance.remaining_balance,
    lower(p_payment_method), coalesce(p_remarks, ''), auth.uid(), v_now
  );

  -- Mark advance order as completed
  UPDATE public.advance_orders SET
    status               = 'completed',
    completed_at         = v_now,
    completed_order_id   = v_order_id,
    invoice_number       = v_invoice,
    final_payment_method = lower(p_payment_method),
    remarks              = CASE WHEN trim(coalesce(p_remarks, '')) = '' THEN remarks ELSE p_remarks END,
    updated_at           = v_now
  WHERE id = p_order_id;

  -- Timeline events
  INSERT INTO public.advance_order_timeline (
    advance_order_id, event_type, label, remarks, created_by, created_at
  ) VALUES
    (p_order_id, 'remaining_payment_received', 'Remaining Payment Received', coalesce(p_remarks, ''), auth.uid(), v_now),
    (p_order_id, 'invoice_generated',          'Invoice Generated',          v_invoice,               auth.uid(), v_now);

  RETURN QUERY SELECT v_order_id, v_invoice, v_now;
END;
$$;

-- Re-grant execute permission
GRANT EXECUTE ON FUNCTION public.complete_advance_order(uuid, text, text)
  TO public, anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ==========================================================================
-- MIGRATION 7 of 29: 20260724_0008_fix_public_invoice_rpc.sql
-- ==========================================================================

-- Migration: Fix missing get_public_invoice_by_number RPC
-- Re-creates the function and forces a schema cache reload to resolve 404 errors on the /invoice page

CREATE OR REPLACE FUNCTION public.get_public_invoice_by_number(p_invoice_no TEXT)
RETURNS SETOF public.orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.orders WHERE invoice_no = NULLIF(BTRIM(p_invoice_no), '') LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_invoice_by_number(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_by_number(TEXT) TO anon, authenticated;

-- Force PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';

-- ==========================================================================
-- MIGRATION 8 of 29: 20260724_0009_create_invoices_bucket.sql
-- ==========================================================================

-- Migration: Create invoices storage bucket
-- Creates the 'invoices' bucket and sets up public read access and upload policies

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('invoices', 'invoices', TRUE, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = TRUE, file_size_limit = 10485760, allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS invoices_public_read ON storage.objects;
CREATE POLICY invoices_public_read ON storage.objects FOR SELECT TO public USING (bucket_id = 'invoices');

DROP POLICY IF EXISTS invoices_portal_upload ON storage.objects;
CREATE POLICY invoices_portal_upload ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'invoices');

DROP POLICY IF EXISTS invoices_portal_update ON storage.objects;
CREATE POLICY invoices_portal_update ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'invoices') WITH CHECK (bucket_id = 'invoices');

-- ==========================================================================
-- MIGRATION 9 of 29: 20260726_0007_update_complete_advance_order_discount.sql
-- ==========================================================================

-- Migration: Update complete_advance_order to handle final amount, discounts, and coupons
-- This creates a new version of the RPC (v2) which is called from the frontend.

CREATE OR REPLACE FUNCTION public.complete_advance_order_v2(
  p_order_id uuid,
  p_payment_method text,
  p_final_amount numeric,
  p_coupon_code text DEFAULT NULL,
  p_coupon_percentage numeric DEFAULT 0,
  p_manual_discount numeric DEFAULT 0,
  p_remarks text DEFAULT ''
)
RETURNS TABLE(order_id uuid, invoice_no text, completed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advance        public.advance_orders;
  v_order_id       uuid := gen_random_uuid();
  v_invoice        text;
  v_now            timestamptz := now();
  v_items          jsonb;
  v_item           jsonb;
  v_total_discount numeric := 0;
BEGIN
  -- Validate payment method
  IF lower(coalesce(p_payment_method, '')) NOT IN ('cash', 'upi', 'card') THEN
    RAISE EXCEPTION 'Select a valid payment method';
  END IF;

  -- Lock and fetch the advance order
  SELECT * INTO v_advance FROM public.advance_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Advance order not found';
  END IF;
  IF v_advance.status = 'cancelled' THEN
    RAISE EXCEPTION 'A cancelled order cannot be completed';
  END IF;
  IF v_advance.completed_order_id IS NOT NULL OR v_advance.invoice_number IS NOT NULL THEN
    RAISE EXCEPTION 'Invoice already generated for this order';
  END IF;

  -- Calculate the total discount from manual discount and coupon
  v_total_discount := p_manual_discount + (v_advance.remaining_balance - p_manual_discount - p_final_amount);
  IF v_total_discount < 0 THEN
    v_total_discount := 0;
  END IF;

  -- Generate invoice number using the existing 8-digit sequence
  v_invoice := LPAD(nextval('public.invoice_number_seq')::TEXT, 8, '0');

  -- Build items JSONB - prefer products array, fall back to single product
  v_items := CASE
    WHEN jsonb_typeof(v_advance.products) = 'array' AND jsonb_array_length(v_advance.products) > 0
      THEN v_advance.products
    ELSE jsonb_build_array(
      jsonb_build_object(
        'name',        v_advance.product_name,
        'category',    v_advance.category,
        'description', v_advance.description,
        'quantity',    1,
        'base_price',  v_advance.total_amount,
        'line_total',  v_advance.total_amount,
        'unit',        'piece',
        'unit_type',   'unit',
        'source',      'advance_order'
      )
    )
  END;

  -- Create the final sale order, storing the discount information
  INSERT INTO public.orders (
    id, invoice_no, customer_name, phone, address, user_id,
    items, subtotal, total, status, order_mode, order_type,
    shipping, delivery_charge, discount_amount, manual_discount_amount,
    coupon_code, coupon_percentage, manual_discount_type, manual_discount_value,
    payment_mode, payment_method, created_at, updated_at
  ) VALUES (
    v_order_id, v_invoice,
    v_advance.customer_name, v_advance.phone, v_advance.address, auth.uid(),
    v_items, v_advance.total_amount, greatest(0, v_advance.total_amount - v_total_discount),
    'completed', 'offline', 'advance_order',
    0, 0, v_total_discount, p_manual_discount,
    p_coupon_code, p_coupon_percentage, 'flat', p_manual_discount,
    lower(p_payment_method), lower(p_payment_method),
    v_now, v_now
  );

  -- Insert order_items using the CORRECT column names from the schema
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
    INSERT INTO public.order_items (
      order_id, product_name, name, quantity, unit, unit_type,
      base_price, line_total, is_manual
    ) VALUES (
      v_order_id,
      coalesce(nullif(trim(v_item->>'name'), ''), 'Product'),
      coalesce(nullif(trim(v_item->>'name'), ''), 'Product'),
      greatest(coalesce((v_item->>'quantity')::numeric, 1), 0),
      coalesce(nullif(v_item->>'unit', ''), 'piece'),
      coalesce(nullif(v_item->>'unit_type', ''), 'unit'),
      greatest(coalesce((v_item->>'base_price')::numeric, 0), 0),
      greatest(coalesce((v_item->>'line_total')::numeric, 0), 0),
      false
    );
  END LOOP;

  -- Record the final payment received
  INSERT INTO public.advance_order_payments (
    advance_order_id, payment_type, amount, payment_method, remarks, received_by, received_at
  ) VALUES (
    p_order_id, 'remaining', p_final_amount,
    lower(p_payment_method), coalesce(p_remarks, ''), auth.uid(), v_now
  );

  -- Mark advance order as completed. Note that remaining_balance is GENERATED ALWAYS AS (total_amount - deposit_amount)
  -- so we do not update remaining_balance directly, but the UI considers it "paid".
  UPDATE public.advance_orders SET
    status               = 'completed',
    completed_at         = v_now,
    completed_order_id   = v_order_id,
    invoice_number       = v_invoice,
    final_payment_method = lower(p_payment_method),
    remarks              = CASE WHEN trim(coalesce(p_remarks, '')) = '' THEN remarks ELSE p_remarks END,
    updated_at           = v_now
  WHERE id = p_order_id;

  -- Timeline events
  INSERT INTO public.advance_order_timeline (
    advance_order_id, event_type, label, remarks, created_by, created_at
  ) VALUES
    (p_order_id, 'remaining_payment_received', 'Remaining Payment Received', coalesce(p_remarks, ''), auth.uid(), v_now),
    (p_order_id, 'invoice_generated',          'Invoice Generated',          v_invoice,               auth.uid(), v_now);

  RETURN QUERY SELECT v_order_id, v_invoice, v_now;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.complete_advance_order_v2(uuid, text, numeric, text, numeric, numeric, text)
  TO public, anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ==========================================================================
-- MIGRATION 10 of 29: 20260728_0010_final_audit_fixes.sql
-- ==========================================================================

-- ============================================================
-- Migration 0010: Final audit fixes
-- Date: 2026-07-28
-- Purpose: Fix all remaining production issues found in audit
-- ============================================================

-- 1. Create store_reviews table (used by Home.tsx but never created in any migration)
CREATE TABLE IF NOT EXISTS public.store_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    text,
  reviewer    text,
  rating      integer CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
DROP FUNCTION IF EXISTS update_advance_order_status(uuid, text, text);
ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert reviews" ON public.store_reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read reviews"  ON public.store_reviews FOR SELECT USING (true);

-- 2. Make completed_order_id FK in advance_orders ON DELETE SET NULL
--    so that deleting an order from the orders table does not require
--    manually clearing advance_orders.completed_order_id first.
--    (Our frontend now also clears it first, but this is the proper DB-level safety net)
ALTER TABLE public.advance_orders
  DROP CONSTRAINT IF EXISTS advance_orders_completed_order_id_fkey;

ALTER TABLE public.advance_orders
  ADD CONSTRAINT advance_orders_completed_order_id_fkey
  FOREIGN KEY (completed_order_id)
  REFERENCES public.orders(id)
  ON DELETE SET NULL;

-- 3. Ensure invoice_no column in advance_orders stores the INV-prefixed number
--    (already works via complete_advance_order_v2, but add index for faster lookup)
CREATE INDEX IF NOT EXISTS idx_advance_orders_invoice_number ON public.advance_orders(invoice_number);
CREATE INDEX IF NOT EXISTS idx_advance_orders_status ON public.advance_orders(status);
CREATE INDEX IF NOT EXISTS idx_advance_orders_created_at ON public.advance_orders(created_at DESC);

-- 4. Ensure orders table has index on invoice_no for fast public invoice lookups
CREATE INDEX IF NOT EXISTS idx_orders_invoice_no ON public.orders(invoice_no);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- 5. Ensure update_advance_order_status RPC is up to date and handles all statuses
CREATE OR REPLACE FUNCTION public.update_advance_order_status(
  p_order_id uuid,
  p_status   text,
  p_remarks  text DEFAULT ''
)
RETURNS SETOF public.advance_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.advance_orders;
BEGIN
  SELECT * INTO v_order FROM public.advance_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Advance order % not found', p_order_id;
  END IF;

  UPDATE public.advance_orders SET
    status     = p_status,
    remarks    = CASE WHEN trim(coalesce(p_remarks,'')) = '' THEN remarks ELSE p_remarks END,
    updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.advance_order_timeline (advance_order_id, event_type, label, remarks, created_by, created_at)
  VALUES (
    p_order_id,
    p_status,
    CASE p_status
      WHEN 'pending_deposit'      THEN 'Status: Pending Deposit'
      WHEN 'waiting_final_payment' THEN 'Status: Waiting for Final Payment'
      WHEN 'ready_for_delivery'   THEN 'Status: Ready to Collect'
      WHEN 'completed'            THEN 'Order Completed'
      WHEN 'cancelled'            THEN 'Order Cancelled'
      ELSE p_status
    END,
    coalesce(p_remarks, ''),
    auth.uid(),
    now()
  );

  RETURN QUERY SELECT * FROM public.advance_orders WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_advance_order_status(uuid, text, text) TO authenticated, anon, public;

-- 6. Ensure add_advance_order_event RPC is robust
CREATE OR REPLACE FUNCTION public.add_advance_order_event(
  p_order_id   uuid,
  p_event_type text,
  p_label      text,
  p_remarks    text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.advance_order_timeline (advance_order_id, event_type, label, remarks, created_by, created_at)
  VALUES (p_order_id, p_event_type, p_label, coalesce(p_remarks,''), auth.uid(), now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_advance_order_event(uuid, text, text, text) TO authenticated, anon, public;

-- 7. Ensure profiles RLS allows staff to update their own profile (avatar etc)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 8. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ==========================================================================
-- MIGRATION 11 of 29: 20260808_0011_billing_date_and_order_fields.sql
-- ==========================================================================

-- ============================================================
-- Migration 0011: Add billing_date and ensure order metadata columns exist
-- Date: 2026-08-08
-- Purpose:
--   1. Add optional billing_date column to orders table so admins
--      can backdate or set a custom billing date/time per sale.
--   2. Ensure remarks and reference_number columns exist (they were
--      added via the dashboard and used in existing client code).
-- ============================================================

BEGIN;

-- Ensure remarks column exists (used by Pos.tsx update call)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS remarks TEXT NOT NULL DEFAULT '';

-- Ensure reference_number column exists (used by Pos.tsx update call)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reference_number TEXT NOT NULL DEFAULT '';

-- Add optional billing_date column.
-- When NULL the UI falls back to created_at for display.
-- When set, it represents the admin-chosen billing date/time.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS billing_date TIMESTAMPTZ;

-- Index for fast lookup by billing_date in analytics
CREATE INDEX IF NOT EXISTS idx_orders_billing_date ON public.orders(billing_date);

-- Reload PostgREST schema cache so the new column is immediately accessible
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ==========================================================================
-- MIGRATION 12 of 29: 20260901_0012_inventory_barcode_addon.sql
-- ==========================================================================

-- ====================================================================
-- Migration 0012: Barcode Management & Inventory Movement Ledger Addon
-- ====================================================================

BEGIN;

-- 1. Sequences for Barcode Generation
CREATE SEQUENCE IF NOT EXISTS public.barcode_product_seq START WITH 10000001;
CREATE SEQUENCE IF NOT EXISTS public.barcode_variant_seq START WITH 10000001;

-- 2. Canonical Barcode Registry
CREATE TABLE IF NOT EXISTS public.barcode_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode_value TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'variant')),
  product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_barcode_entity_target CHECK (
    (entity_type = 'product' AND variant_id IS NULL) OR
    (entity_type = 'variant' AND variant_id IS NOT NULL)
  )
);

-- 3. Inventory Movement Ledger
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  barcode_id UUID REFERENCES public.barcode_registry(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (
    movement_type IN ('INITIAL_BARCODE_STOCK', 'RESTOCK', 'SALE', 'RETURN', 'DAMAGE', 'CORRECTION', 'VOID')
  ),
  quantity_delta NUMERIC NOT NULL,
  quantity_before NUMERIC NOT NULL,
  quantity_after NUMERIC NOT NULL,
  unit_cost NUMERIC DEFAULT NULL,
  reference_type TEXT DEFAULT NULL, -- 'order', 'adjustment', 'barcode_receipt'
  reference_id TEXT DEFAULT NULL,   -- order_id or invoice_no
  note TEXT DEFAULT '',
  created_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Indexes for Rapid POS Lookup & Audit Reports
CREATE INDEX IF NOT EXISTS idx_barcode_registry_val ON public.barcode_registry(barcode_value);
CREATE INDEX IF NOT EXISTS idx_barcode_registry_prod ON public.barcode_registry(product_id);
CREATE INDEX IF NOT EXISTS idx_barcode_registry_var ON public.barcode_registry(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_movements_prod ON public.inventory_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_movements_var ON public.inventory_movements(variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_movements_type ON public.inventory_movements(movement_type, created_at DESC);

-- 5. Enable RLS and Policies
ALTER TABLE public.barcode_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS barcode_registry_all ON public.barcode_registry;
CREATE POLICY barcode_registry_all ON public.barcode_registry FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS inventory_movements_all ON public.inventory_movements;
CREATE POLICY inventory_movements_all ON public.inventory_movements FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 6. Helper Function: Generate Unique Barcode String
CREATE OR REPLACE FUNCTION public.generate_barcode_value(p_entity_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_entity_type = 'variant' THEN
    RETURN 'ULV' || LPAD(nextval('public.barcode_variant_seq')::TEXT, 8, '0');
  ELSE
    RETURN 'ULP' || LPAD(nextval('public.barcode_product_seq')::TEXT, 8, '0');
  END IF;
END;
$$;

-- 7. Transactional RPC: Create Barcode & Receive Stock (With Barcode Reuse on Restock)
CREATE OR REPLACE FUNCTION public.create_barcode_and_receive_stock(
  p_product_id BIGINT,
  p_variant_id UUID DEFAULT NULL,
  p_quantity_received NUMERIC DEFAULT 0,
  p_unit_cost NUMERIC DEFAULT NULL,
  p_created_by_name TEXT DEFAULT '',
  p_custom_barcode TEXT DEFAULT NULL,
  p_note TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_type TEXT;
  v_barcode_id UUID;
  v_barcode_value TEXT;
  v_is_new_barcode BOOLEAN := FALSE;
  v_movement_type TEXT;
  v_qty_before NUMERIC := 0;
  v_qty_after NUMERIC := 0;
  v_prod_name TEXT;
  v_var_name TEXT := '';
BEGIN
  IF p_quantity_received < 0 THEN
    RAISE EXCEPTION 'Quantity received cannot be negative';
  END IF;

  -- 1. Check Parent Product Exists
  SELECT name INTO v_prod_name FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product with ID % not found', p_product_id;
  END IF;

  -- 2. Verify Variant Belongs to Product if Variant is Provided
  IF p_variant_id IS NOT NULL THEN
    v_entity_type := 'variant';
    SELECT variant_name, stock INTO v_var_name, v_qty_before
    FROM public.product_variants
    WHERE id = p_variant_id AND product_id = p_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant % does not belong to Product %', p_variant_id, p_product_id;
    END IF;
  ELSE
    v_entity_type := 'product';
    SELECT stock_quantity INTO v_qty_before
    FROM public.products
    WHERE id = p_product_id;
  END IF;

  -- 3. Check for Existing Active Barcode in barcode_registry (SKU Identity)
  IF v_entity_type = 'variant' THEN
    SELECT id, barcode_value INTO v_barcode_id, v_barcode_value
    FROM public.barcode_registry
    WHERE variant_id = p_variant_id AND is_active = TRUE
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    SELECT id, barcode_value INTO v_barcode_id, v_barcode_value
    FROM public.barcode_registry
    WHERE product_id = p_product_id AND variant_id IS NULL AND is_active = TRUE
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- 4. Reuse Existing or Create New Barcode
  IF v_barcode_id IS NOT NULL THEN
    v_is_new_barcode := FALSE;
    v_movement_type := CASE WHEN v_qty_before = 0 THEN 'INITIAL_BARCODE_STOCK' ELSE 'RESTOCK' END;
  ELSE
    v_is_new_barcode := TRUE;
    v_movement_type := 'INITIAL_BARCODE_STOCK';
    v_barcode_value := COALESCE(NULLIF(UPPER(BTRIM(p_custom_barcode)), ''), public.generate_barcode_value(v_entity_type));

    INSERT INTO public.barcode_registry (
      barcode_value, entity_type, product_id, variant_id, is_active, created_by_name
    )
    VALUES (
      v_barcode_value, v_entity_type, p_product_id, p_variant_id, TRUE, COALESCE(p_created_by_name, '')
    )
    RETURNING id INTO v_barcode_id;
  END IF;

  -- 5. Synchronize compatibility column on target table
  IF v_entity_type = 'variant' THEN
    UPDATE public.product_variants
    SET barcode = v_barcode_value, updated_at = NOW()
    WHERE id = p_variant_id;
  ELSE
    UPDATE public.products
    SET barcode = v_barcode_value, updated_at = NOW()
    WHERE id = p_product_id;
  END IF;

  -- 6. Apply Stock Increment & Parent Aggregate Sync
  v_qty_after := v_qty_before + p_quantity_received;

  IF p_quantity_received > 0 THEN
    IF v_entity_type = 'variant' THEN
      UPDATE public.product_variants
      SET stock = v_qty_after, updated_at = NOW()
      WHERE id = p_variant_id;

      -- Refresh parent aggregate stock cache
      UPDATE public.products
      SET stock_quantity = (
            SELECT COALESCE(SUM(stock), 0)
            FROM public.product_variants
            WHERE product_id = p_product_id AND is_active = TRUE
          ),
          stock = FLOOR((
            SELECT COALESCE(SUM(stock), 0)
            FROM public.product_variants
            WHERE product_id = p_product_id AND is_active = TRUE
          ))::INTEGER,
          updated_at = NOW()
      WHERE id = p_product_id;
    ELSE
      UPDATE public.products
      SET stock_quantity = v_qty_after,
          stock = FLOOR(v_qty_after)::INTEGER,
          updated_at = NOW()
      WHERE id = p_product_id;
    END IF;
  END IF;

  -- 7. Record Immutable Inventory Movement
  IF p_quantity_received > 0 THEN
    INSERT INTO public.inventory_movements (
      product_id, variant_id, barcode_id, movement_type,
      quantity_delta, quantity_before, quantity_after,
      unit_cost, reference_type, reference_id, note, created_by_name
    )
    VALUES (
      p_product_id, p_variant_id, v_barcode_id, v_movement_type,
      p_quantity_received, v_qty_before, v_qty_after,
      p_unit_cost, 'barcode_receipt', v_barcode_value,
      COALESCE(p_note, ''), COALESCE(p_created_by_name, '')
    );
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'barcode_id', v_barcode_id,
    'barcode_value', v_barcode_value,
    'is_new_barcode', v_is_new_barcode,
    'movement_type', v_movement_type,
    'quantity_before', v_qty_before,
    'quantity_received', p_quantity_received,
    'quantity_after', v_qty_after,
    'product_id', p_product_id,
    'variant_id', p_variant_id,
    'product_name', v_prod_name,
    'variant_name', v_var_name
  );
END;
$$;

-- 8. Transactional RPC: Adjust Stock (Restock, Damage, Correction, Return)
CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(
  p_product_id BIGINT,
  p_variant_id UUID DEFAULT NULL,
  p_new_quantity NUMERIC DEFAULT 0,
  p_reason TEXT DEFAULT 'RESTOCK',
  p_note TEXT DEFAULT '',
  p_created_by_name TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty_before NUMERIC := 0;
  v_delta NUMERIC := 0;
  v_barcode_id UUID;
BEGIN
  IF p_new_quantity < 0 THEN
    RAISE EXCEPTION 'Stock quantity cannot be negative';
  END IF;

  -- Verify variant if supplied
  IF p_variant_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = p_variant_id AND product_id = p_product_id) THEN
      RAISE EXCEPTION 'Variant does not belong to specified Product';
    END IF;

    SELECT stock INTO v_qty_before FROM public.product_variants WHERE id = p_variant_id FOR UPDATE;
    SELECT id INTO v_barcode_id FROM public.barcode_registry WHERE variant_id = p_variant_id AND is_active = TRUE LIMIT 1;

    v_delta := p_new_quantity - v_qty_before;

    UPDATE public.product_variants
    SET stock = p_new_quantity, updated_at = NOW()
    WHERE id = p_variant_id;

    -- Refresh parent aggregate
    UPDATE public.products
    SET stock_quantity = (SELECT COALESCE(SUM(stock), 0) FROM public.product_variants WHERE product_id = p_product_id AND is_active = TRUE),
        stock = FLOOR((SELECT COALESCE(SUM(stock), 0) FROM public.product_variants WHERE product_id = p_product_id AND is_active = TRUE))::INTEGER,
        updated_at = NOW()
    WHERE id = p_product_id;
  ELSE
    SELECT stock_quantity INTO v_qty_before FROM public.products WHERE id = p_product_id FOR UPDATE;
    SELECT id INTO v_barcode_id FROM public.barcode_registry WHERE product_id = p_product_id AND variant_id IS NULL AND is_active = TRUE LIMIT 1;

    v_delta := p_new_quantity - v_qty_before;

    UPDATE public.products
    SET stock_quantity = p_new_quantity,
        stock = FLOOR(p_new_quantity)::INTEGER,
        updated_at = NOW()
    WHERE id = p_product_id;
  END IF;

  -- Record Movement
  INSERT INTO public.inventory_movements (
    product_id, variant_id, barcode_id, movement_type,
    quantity_delta, quantity_before, quantity_after,
    reference_type, note, created_by_name
  )
  VALUES (
    p_product_id, p_variant_id, v_barcode_id, p_reason,
    v_delta, v_qty_before, p_new_quantity,
    'adjustment', COALESCE(p_note, ''), COALESCE(p_created_by_name, '')
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'quantity_before', v_qty_before,
    'quantity_after', p_new_quantity,
    'delta', v_delta,
    'reason', p_reason
  );
END;
$$;

-- 9. Transactional RPC: Complete POS Sale with Inventory Pre-Validation & Movement Ledger
CREATE OR REPLACE FUNCTION public.complete_pos_sale_with_inventory(
  p_customer_name TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_items JSONB,
  p_shipping NUMERIC DEFAULT 0,
  p_status TEXT DEFAULT 'completed',
  p_order_mode TEXT DEFAULT 'offline',
  p_order_type TEXT DEFAULT 'pos_sale',
  p_delivery_charge NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_manual_discount_amount NUMERIC DEFAULT 0,
  p_manual_discount_type TEXT DEFAULT 'flat',
  p_manual_discount_value NUMERIC DEFAULT 0,
  p_coupon_code TEXT DEFAULT NULL,
  p_coupon_percentage NUMERIC DEFAULT 0,
  p_payment_method TEXT DEFAULT 'cash',
  p_split_details JSONB DEFAULT '{}'::JSONB,
  p_total_gst NUMERIC DEFAULT 0,
  p_gst_enabled BOOLEAN DEFAULT FALSE,
  p_remarks TEXT DEFAULT '',
  p_reference_number TEXT DEFAULT '',
  p_billing_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invoice_no TEXT;
  v_order_id UUID;
  v_subtotal NUMERIC := 0;
  v_total NUMERIC := 0;
  v_item JSONB;
  v_product_id BIGINT;
  v_variant_id UUID;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
  v_line_total NUMERIC;
  v_product_name TEXT;
  v_name_ta TEXT;
  v_unit TEXT;
  v_unit_type TEXT;
  v_base_quantity NUMERIC;
  v_is_manual BOOLEAN;
  v_discount NUMERIC;
  v_gst_amount NUMERIC;
  v_gst_rate NUMERIC;
  v_image_url TEXT;
  v_variant_name TEXT;
  v_source TEXT;
  v_note TEXT;
  v_category TEXT;
  v_current_stock NUMERIC;
  v_barcode_id UUID;
  v_created_at TIMESTAMPTZ := COALESCE(p_billing_date, NOW());
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order items cannot be empty';
  END IF;

  -- 1. Atomic Pre-Validation of Available Stock for All Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item ->> 'product_id', '')::BIGINT;
    v_variant_id := NULLIF(v_item ->> 'variant_id', '')::UUID;
    v_quantity := COALESCE((v_item ->> 'quantity')::NUMERIC, 0);
    v_is_manual := COALESCE((v_item ->> 'is_manual')::BOOLEAN, FALSE);
    v_product_name := COALESCE(v_item ->> 'product_name', v_item ->> 'name', 'Product');

    IF NOT v_is_manual AND v_quantity > 0 THEN
      IF v_variant_id IS NOT NULL THEN
        SELECT stock INTO v_current_stock FROM public.product_variants WHERE id = v_variant_id FOR UPDATE;
        IF v_current_stock IS NULL OR v_current_stock < v_quantity THEN
          RAISE EXCEPTION 'Insufficient stock for % (Available: %, Requested: %)', v_product_name, COALESCE(v_current_stock, 0), v_quantity;
        END IF;
      ELSIF v_product_id IS NOT NULL THEN
        SELECT stock_quantity INTO v_current_stock FROM public.products WHERE id = v_product_id FOR UPDATE;
        IF v_current_stock IS NULL OR v_current_stock < v_quantity THEN
          RAISE EXCEPTION 'Insufficient stock for % (Available: %, Requested: %)', v_product_name, COALESCE(v_current_stock, 0), v_quantity;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- 2. Calculate Subtotal & Generate Invoice Number
  v_invoice_no := public.get_next_invoice_no();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := COALESCE((v_item ->> 'quantity')::NUMERIC, 0);
    v_unit_price := COALESCE(
      (v_item ->> 'unit_price')::NUMERIC,
      (v_item ->> 'base_price')::NUMERIC,
      (v_item ->> 'price')::NUMERIC,
      0
    );
    v_line_total := COALESCE((v_item ->> 'line_total')::NUMERIC, ROUND(v_quantity * v_unit_price, 2));
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  v_total := GREATEST(0, ROUND(v_subtotal + COALESCE(p_shipping, 0) + COALESCE(p_delivery_charge, 0) - COALESCE(p_discount_amount, 0), 2));

  -- 3. Insert Order Record
  INSERT INTO public.orders (
    invoice_no, user_id, customer_name, phone, address, items,
    subtotal, shipping, total, status, order_mode, order_type,
    delivery_charge, discount_amount, manual_discount_amount,
    manual_discount_type, manual_discount_value, coupon_code,
    coupon_percentage, total_gst, gst_amount, gst_enabled,
    payment_method, payment_mode, split_details, remarks,
    reference_number, billing_date, created_at, updated_at
  )
  VALUES (
    v_invoice_no, v_user_id, COALESCE(NULLIF(BTRIM(p_customer_name), ''), 'Customer'),
    COALESCE(p_phone, ''), COALESCE(p_address, ''), p_items,
    v_subtotal, COALESCE(p_shipping, 0), v_total, COALESCE(p_status, 'completed'),
    COALESCE(p_order_mode, 'offline'), COALESCE(p_order_type, 'pos_sale'),
    COALESCE(p_delivery_charge, 0), COALESCE(p_discount_amount, 0),
    COALESCE(p_manual_discount_amount, 0), COALESCE(p_manual_discount_type, 'flat'),
    COALESCE(p_manual_discount_value, 0), p_coupon_code,
    COALESCE(p_coupon_percentage, 0), COALESCE(p_total_gst, 0),
    COALESCE(p_total_gst, 0), COALESCE(p_gst_enabled, FALSE),
    COALESCE(p_payment_method, 'cash'), COALESCE(p_payment_method, 'cash'),
    COALESCE(p_split_details, '{}'::JSONB), COALESCE(p_remarks, ''),
    COALESCE(p_reference_number, ''), p_billing_date, v_created_at, NOW()
  )
  RETURNING id INTO v_order_id;

  -- 4. Insert Order Items, Deduct Stock & Record SALE Movements
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item ->> 'product_id', '')::BIGINT;
    v_variant_id := NULLIF(v_item ->> 'variant_id', '')::UUID;
    v_quantity := COALESCE((v_item ->> 'quantity')::NUMERIC, 0);
    v_unit_price := COALESCE((v_item ->> 'unit_price')::NUMERIC, (v_item ->> 'base_price')::NUMERIC, 0);
    v_line_total := COALESCE((v_item ->> 'line_total')::NUMERIC, ROUND(v_quantity * v_unit_price, 2));
    v_product_name := COALESCE(v_item ->> 'product_name', v_item ->> 'name', 'Product');
    v_name_ta := COALESCE(v_item ->> 'product_tamil_name', v_item ->> 'tamil_name', '');
    v_unit := COALESCE(v_item ->> 'unit', 'piece');
    v_unit_type := COALESCE(v_item ->> 'unit_type', 'unit');
    v_base_quantity := COALESCE((v_item ->> 'base_quantity')::NUMERIC, 1);
    v_is_manual := COALESCE((v_item ->> 'is_manual')::BOOLEAN, FALSE);
    v_discount := COALESCE((v_item ->> 'discount')::NUMERIC, 0);
    v_gst_amount := COALESCE((v_item ->> 'gst_amount')::NUMERIC, 0);
    v_gst_rate := COALESCE((v_item ->> 'gst_rate')::NUMERIC, 0);
    v_image_url := v_item ->> 'image_url';
    v_variant_name := v_item ->> 'variant_name';
    v_source := COALESCE(v_item ->> 'source', 'catalogue');
    v_note := v_item ->> 'note';
    v_category := v_item ->> 'category';

    INSERT INTO public.order_items (
      order_id, product_id, variant_id, product_name, name,
      product_tamil_name, tamil_name, quantity, unit, unit_type,
      base_quantity, base_price, unit_price, line_total, image_url,
      is_manual, discount, gst_amount, gst_rate, variant_name,
      source, note, category, created_at
    )
    VALUES (
      v_order_id, v_product_id, v_variant_id, v_product_name, v_product_name,
      v_name_ta, v_name_ta, v_quantity, v_unit, v_unit_type,
      v_base_quantity, v_unit_price, v_unit_price, v_line_total, v_image_url,
      v_is_manual, v_discount, v_gst_amount, v_gst_rate, v_variant_name,
      v_source, v_note, v_category, v_created_at
    );

    -- Deduct Stock and Insert SALE Movement
    IF NOT v_is_manual AND v_quantity > 0 THEN
      IF v_variant_id IS NOT NULL THEN
        SELECT stock INTO v_current_stock FROM public.product_variants WHERE id = v_variant_id;
        SELECT id INTO v_barcode_id FROM public.barcode_registry WHERE variant_id = v_variant_id AND is_active = TRUE LIMIT 1;

        UPDATE public.product_variants
        SET stock = GREATEST(0, stock - v_quantity), updated_at = NOW()
        WHERE id = v_variant_id;

        -- Parent aggregate update
        UPDATE public.products
        SET stock_quantity = (SELECT COALESCE(SUM(stock), 0) FROM public.product_variants WHERE product_id = v_product_id AND is_active = TRUE),
            stock = FLOOR((SELECT COALESCE(SUM(stock), 0) FROM public.product_variants WHERE product_id = v_product_id AND is_active = TRUE))::INTEGER,
            updated_at = NOW()
        WHERE id = v_product_id;

        INSERT INTO public.inventory_movements (
          product_id, variant_id, barcode_id, movement_type,
          quantity_delta, quantity_before, quantity_after,
          reference_type, reference_id, note
        )
        VALUES (
          v_product_id, v_variant_id, v_barcode_id, 'SALE',
          -v_quantity, v_current_stock, GREATEST(0, v_current_stock - v_quantity),
          'order', v_invoice_no, 'POS Sale checkout'
        );

      ELSIF v_product_id IS NOT NULL THEN
        SELECT stock_quantity INTO v_current_stock FROM public.products WHERE id = v_product_id;
        SELECT id INTO v_barcode_id FROM public.barcode_registry WHERE product_id = v_product_id AND variant_id IS NULL AND is_active = TRUE LIMIT 1;

        UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity - v_quantity),
            stock = GREATEST(0, stock - FLOOR(v_quantity)::INTEGER),
            updated_at = NOW()
        WHERE id = v_product_id;

        INSERT INTO public.inventory_movements (
          product_id, variant_id, barcode_id, movement_type,
          quantity_delta, quantity_before, quantity_after,
          reference_type, reference_id, note
        )
        VALUES (
          v_product_id, NULL, v_barcode_id, 'SALE',
          -v_quantity, v_current_stock, GREATEST(0, v_current_stock - v_quantity),
          'order', v_invoice_no, 'POS Sale checkout'
        );
      END IF;
    END IF;
  END LOOP;

  -- 5. Increment Coupon Usage Count
  IF p_coupon_code IS NOT NULL AND BTRIM(p_coupon_code) <> '' THEN
    UPDATE public.coupons
    SET usage_count = usage_count + 1, updated_at = NOW()
    WHERE UPPER(BTRIM(code)) = UPPER(BTRIM(p_coupon_code));
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'invoice_no', v_invoice_no,
    'total', v_total
  );
END;
$$;

-- 10. Update Store Settings Default to Universal Look
UPDATE public.store_settings
SET name = 'Universal Look',
    owner_name = '',
    phone = '9159600067',
    email = 'universallook600067@gmail.com',
    address = '1/46 GNT Road, Sholavaram, Chennai - 600067',
    updated_at = NOW()
WHERE id = 1;

COMMIT;

-- ==========================================================================
-- MIGRATION 13 of 29: 20260903_0013_expense_tracker_addon.sql
-- ==========================================================================

-- ====================================================================
-- Migration 0013: Expense Tracker & Category Management Addon
-- ====================================================================

BEGIN;

-- 1. Expense Categories Table
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_expense_category_name UNIQUE (name)
);

-- 2. Seed Default Expense Categories
INSERT INTO public.expense_categories (name, is_active) VALUES
  ('Maintenance', TRUE),
  ('Marketing', TRUE),
  ('Other', TRUE),
  ('Rent', TRUE),
  ('Salaries', TRUE),
  ('Supplies', TRUE)
ON CONFLICT (name) DO NOTHING;

-- 3. Store Expenses Table
-- Note: category_id has ON DELETE SET NULL to preserve historical expense records even if a category is removed
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id BIGINT REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL, -- denormalized snapshot to protect historical records
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT DEFAULT '',
  payment_mode TEXT DEFAULT 'cash', -- 'cash', 'upi', 'card', 'bank_transfer'
  recorded_by_name TEXT DEFAULT 'Staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Fast Query Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_active ON public.expense_categories(is_active);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expense_categories_all ON public.expense_categories;
CREATE POLICY expense_categories_all ON public.expense_categories FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS expenses_all ON public.expenses;
CREATE POLICY expenses_all ON public.expenses FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 6. RPC: Summary Metric Calculation (Calculates Today, Week, Month, Year, All-Time)
CREATE OR REPLACE FUNCTION public.get_expense_summary_metrics(
  p_current_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today NUMERIC(12,2) := 0;
  v_this_week NUMERIC(12,2) := 0;
  v_this_month NUMERIC(12,2) := 0;
  v_this_year NUMERIC(12,2) := 0;
  v_total_all_time NUMERIC(12,2) := 0;
  v_week_start DATE := date_trunc('week', p_current_date)::DATE;
  v_month_start DATE := date_trunc('month', p_current_date)::DATE;
  v_year_start DATE := date_trunc('year', p_current_date)::DATE;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN expense_date = p_current_date THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN expense_date >= v_week_start AND expense_date <= p_current_date THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN expense_date >= v_month_start AND expense_date <= p_current_date THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN expense_date >= v_year_start AND expense_date <= p_current_date THEN amount ELSE 0 END), 0),
    COALESCE(SUM(amount), 0)
  INTO
    v_today, v_this_week, v_this_month, v_this_year, v_total_all_time
  FROM public.expenses;

  RETURN jsonb_build_object(
    'today', v_today,
    'this_week', v_this_week,
    'this_month', v_this_month,
    'this_year', v_this_year,
    'total_all_time', v_total_all_time
  );
END;
$$;

COMMIT;

-- ==========================================================================
-- MIGRATION 14 of 29: 20260904_0015_unregistered_category.sql
-- ==========================================================================

-- ============================================================================
-- Migration: 20260904_0015_unregistered_category.sql
-- Description: Seed system category 'Unregistered' for ad-hoc POS non-inventory billing
-- ============================================================================

DO $$
BEGIN
  -- Insert into categories if not present
  IF NOT EXISTS (
    SELECT 1 FROM public.categories
    WHERE LOWER(name_en) = 'unregistered'
  ) THEN
    INSERT INTO public.categories (name_en, name_ta, is_active, sort_order)
    VALUES ('Unregistered', 'பதிவுசெய்யப்படாதது', TRUE, 999);
  END IF;
END $$;

-- ==========================================================================
-- MIGRATION 15 of 29: 20260911_0016_set_universal_look_details.sql
-- ==========================================================================

-- Migration: 20260911_0016_set_universal_look_details.sql
-- Rebrand store details to Universal Look and initialize branding storage bucket

BEGIN;

-- 1. Update or Insert Store Settings (id = 1)
INSERT INTO public.store_settings (id, name, owner_name, phone, email, address, updated_at)
VALUES (
  1,
  'Universal Look',
  '',
  '9159600067',
  'universallook600067@gmail.com',
  '1/46 GNT Road, Sholavaram, Chennai - 600067',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = 'Universal Look',
  owner_name = '',
  phone = '9159600067',
  email = 'universallook600067@gmail.com',
  address = '1/46 GNT Road, Sholavaram, Chennai - 600067',
  updated_at = NOW();

-- 2. Create public 'branding' storage bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding',
  'branding',
  TRUE,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 10485760;

-- 3. Storage Policies for branding bucket
DROP POLICY IF EXISTS branding_public_read ON storage.objects;
CREATE POLICY branding_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'branding');

DROP POLICY IF EXISTS branding_portal_upload ON storage.objects;
CREATE POLICY branding_portal_upload ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'branding');

DROP POLICY IF EXISTS branding_portal_update ON storage.objects;
CREATE POLICY branding_portal_update ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'branding')
  WITH CHECK (bucket_id = 'branding');

COMMIT;

-- ==========================================================================
-- MIGRATION 16 of 29: 20260912_0017_update_store_address.sql
-- ==========================================================================

-- Migration: 20260912_0017_update_store_address.sql
-- Update store address for Universal Look

BEGIN;

UPDATE public.store_settings
SET address = '1/46 GNT Road, Sholavaram, Chennai - 600067',
    updated_at = NOW()
WHERE id = 1;

COMMIT;

-- ==========================================================================
-- MIGRATION 17 of 29: 20260917_0001_fix_soft_delete_unique_constraints.sql
-- ==========================================================================

-- Fix for products unique constraint
DROP INDEX IF EXISTS public.products_category_name_unique;
CREATE UNIQUE INDEX products_category_name_unique
  ON public.products (category_id, LOWER(BTRIM(name)))
  WHERE is_active = true;

-- Fix for variants unique constraint
DROP INDEX IF EXISTS public.product_variants_product_name_unique;
CREATE UNIQUE INDEX product_variants_product_name_unique
  ON public.product_variants (product_id, LOWER(BTRIM(variant_name)))
  WHERE is_active = true;

-- ==========================================================================
-- MIGRATION 18 of 29: 20260918_0018_advance_order_self_heal.sql
-- ==========================================================================

-- ============================================================
-- Migration 0018: Advance order self-healing & status integrity
-- Date: 2026-09-18
-- Purpose:
-- 1. Make complete_advance_order_v2 self-heal if invoice already generated
-- 2. Prevent update_advance_order_status from changing completed invoice orders
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_advance_order_v2(
  p_order_id uuid,
  p_payment_method text,
  p_final_amount numeric,
  p_coupon_code text DEFAULT NULL,
  p_coupon_percentage numeric DEFAULT 0,
  p_manual_discount numeric DEFAULT 0,
  p_remarks text DEFAULT ''
)
RETURNS TABLE(order_id uuid, invoice_no text, completed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advance        public.advance_orders;
  v_order_id       uuid := gen_random_uuid();
  v_invoice        text;
  v_now            timestamptz := now();
  v_items          jsonb;
  v_item           jsonb;
  v_total_discount numeric := 0;
BEGIN
  -- Validate payment method
  IF lower(coalesce(p_payment_method, '')) NOT IN ('cash', 'upi', 'card') THEN
    RAISE EXCEPTION 'Select a valid payment method';
  END IF;

  -- Lock and fetch the advance order
  SELECT * INTO v_advance FROM public.advance_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Advance order not found';
  END IF;

  IF v_advance.status = 'cancelled' THEN
    RAISE EXCEPTION 'A cancelled order cannot be completed';
  END IF;

  -- Self-healing check: If invoice or completed order already exists, ensure completed status and return cleanly
  IF v_advance.completed_order_id IS NOT NULL OR v_advance.invoice_number IS NOT NULL THEN
    IF v_advance.status != 'completed' THEN
      UPDATE public.advance_orders
      SET status = 'completed',
          updated_at = v_now
      WHERE id = p_order_id;
    END IF;

    RETURN QUERY SELECT
      coalesce(v_advance.completed_order_id, gen_random_uuid()),
      coalesce(v_advance.invoice_number, 'INV00000000'),
      coalesce(v_advance.completed_at, v_now);
    RETURN;
  END IF;

  -- Calculate total discount from manual discount and coupon
  v_total_discount := p_manual_discount + (v_advance.remaining_balance - p_manual_discount - p_final_amount);
  IF v_total_discount < 0 THEN
    v_total_discount := 0;
  END IF;

  -- Generate invoice number using the existing 8-digit sequence
  v_invoice := LPAD(nextval('public.invoice_number_seq')::TEXT, 8, '0');

  -- Build items JSONB - prefer products array, fall back to single product
  v_items := CASE
    WHEN jsonb_typeof(v_advance.products) = 'array' AND jsonb_array_length(v_advance.products) > 0
      THEN v_advance.products
    ELSE jsonb_build_array(
      jsonb_build_object(
        'name',        v_advance.product_name,
        'category',    v_advance.category,
        'description', v_advance.description,
        'quantity',    1,
        'base_price',  v_advance.total_amount,
        'line_total',  v_advance.total_amount,
        'unit',        'piece',
        'unit_type',   'unit',
        'source',      'advance_order'
      )
    )
  END;

  -- Create final sale order
  INSERT INTO public.orders (
    id, invoice_no, customer_name, phone, address, user_id,
    items, subtotal, total, status, order_mode, order_type,
    shipping, delivery_charge, discount_amount, manual_discount_amount,
    coupon_code, coupon_percentage, manual_discount_type, manual_discount_value,
    payment_mode, payment_method, created_at, updated_at
  ) VALUES (
    v_order_id, v_invoice,
    v_advance.customer_name, v_advance.phone, v_advance.address, auth.uid(),
    v_items, v_advance.total_amount, greatest(0, v_advance.total_amount - v_total_discount),
    'completed', 'offline', 'advance_order',
    0, 0, v_total_discount, p_manual_discount,
    p_coupon_code, p_coupon_percentage, 'flat', p_manual_discount,
    lower(p_payment_method), lower(p_payment_method),
    v_now, v_now
  );

  -- Insert order items
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
    INSERT INTO public.order_items (
      order_id, product_name, name, quantity, unit, unit_type,
      base_price, line_total, is_manual
    ) VALUES (
      v_order_id,
      coalesce(nullif(trim(v_item->>'name'), ''), 'Product'),
      coalesce(nullif(trim(v_item->>'name'), ''), 'Product'),
      greatest(coalesce((v_item->>'quantity')::numeric, 1), 0),
      coalesce(nullif(v_item->>'unit', ''), 'piece'),
      coalesce(nullif(v_item->>'unit_type', ''), 'unit'),
      greatest(coalesce((v_item->>'base_price')::numeric, 0), 0),
      greatest(coalesce((v_item->>'line_total')::numeric, 0), 0),
      false
    );
  END LOOP;

  -- Record final payment
  INSERT INTO public.advance_order_payments (
    advance_order_id, payment_type, amount, payment_method, remarks, received_by, received_at
  ) VALUES (
    p_order_id, 'remaining', p_final_amount,
    lower(p_payment_method), coalesce(p_remarks, ''), auth.uid(), v_now
  );

  -- Mark advance order as completed
  UPDATE public.advance_orders SET
    status               = 'completed',
    completed_at         = v_now,
    completed_order_id   = v_order_id,
    invoice_number       = v_invoice,
    final_payment_method = lower(p_payment_method),
    remarks              = CASE WHEN trim(coalesce(p_remarks, '')) = '' THEN remarks ELSE p_remarks END,
    updated_at           = v_now
  WHERE id = p_order_id;

  -- Timeline events
  INSERT INTO public.advance_order_timeline (
    advance_order_id, event_type, label, remarks, created_by, created_at
  ) VALUES
    (p_order_id, 'remaining_payment_received', 'Remaining Payment Received', coalesce(p_remarks, ''), auth.uid(), v_now),
    (p_order_id, 'invoice_generated',          'Invoice Generated',          v_invoice,               auth.uid(), v_now);

  RETURN QUERY SELECT v_order_id, v_invoice, v_now;
END;
$$;

-- Prevent changing status of advance orders that already have an invoice
CREATE OR REPLACE FUNCTION public.update_advance_order_status(
  p_order_id uuid,
  p_status   text,
  p_remarks  text DEFAULT ''
)
RETURNS SETOF public.advance_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.advance_orders;
BEGIN
  SELECT * INTO v_order FROM public.advance_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Advance order % not found', p_order_id;
  END IF;

  IF (v_order.invoice_number IS NOT NULL OR v_order.completed_order_id IS NOT NULL) AND p_status != 'completed' THEN
    RAISE EXCEPTION 'Cannot change status of an order that already has an invoice generated';
  END IF;

  UPDATE public.advance_orders SET
    status     = p_status,
    remarks    = CASE WHEN trim(coalesce(p_remarks,'')) = '' THEN remarks ELSE p_remarks END,
    updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.advance_order_timeline (advance_order_id, event_type, label, remarks, created_by, created_at)
  VALUES (
    p_order_id,
    p_status,
    CASE p_status
      WHEN 'pending_deposit'       THEN 'Status: Pending Deposit'
      WHEN 'waiting_final_payment' THEN 'Status: Waiting for Final Payment'
      WHEN 'ready_for_delivery'    THEN 'Status: Ready to Collect'
      WHEN 'completed'             THEN 'Order Completed'
      WHEN 'cancelled'             THEN 'Order Cancelled'
      ELSE p_status
    END,
    coalesce(p_remarks, ''),
    auth.uid(),
    now()
  );

  RETURN QUERY SELECT * FROM public.advance_orders WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_advance_order_v2(uuid, text, numeric, text, numeric, numeric, text) TO public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_advance_order_status(uuid, text, text) TO authenticated, anon, public;

NOTIFY pgrst, 'reload schema';

-- ==========================================================================
-- MIGRATION 19 of 29: 20260918_0019_robust_public_invoice_lookup.sql
-- ==========================================================================

-- Migration: 20260918_0019_robust_public_invoice_lookup.sql
-- Enables get_public_invoice_by_number to seamlessly match invoices regardless of:
-- 1. "INV" prefix (e.g. "INV00000030" or "00000030")
-- 2. "UL-" legacy prefix (e.g. "UL-20260918-000001")
-- 3. Unpadded or stripped leading zeros (e.g. "30" matching "00000030")
-- 4. UUID order ID (e.g. from admin dashboard link)
-- 5. Case insensitivity and whitespace trimming

CREATE OR REPLACE FUNCTION public.get_public_invoice_by_number(p_invoice_no TEXT)
RETURNS SETOF public.orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.orders
  WHERE invoice_no = NULLIF(BTRIM(p_invoice_no), '')
     OR LOWER(invoice_no) = LOWER(NULLIF(BTRIM(p_invoice_no), ''))
     OR invoice_no = REGEXP_REPLACE(BTRIM(p_invoice_no), '^(INV|UL)[-_ ]*', '', 'i')
     OR (
       REGEXP_REPLACE(BTRIM(p_invoice_no), '\D', '', 'g') <> ''
       AND invoice_no = LPAD(REGEXP_REPLACE(BTRIM(p_invoice_no), '\D', '', 'g'), 8, '0')
     )
     OR (
       REGEXP_REPLACE(BTRIM(p_invoice_no), '\D', '', 'g') <> ''
       AND invoice_no = REGEXP_REPLACE(REGEXP_REPLACE(BTRIM(p_invoice_no), '\D', '', 'g'), '^0+', '')
     )
     OR (
       p_invoice_no ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       AND id = p_invoice_no::UUID
     )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_invoice_by_number(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_by_number(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ==========================================================================
-- MIGRATION 20 of 29: 20260921_0020_rebrand_to_universal_look.sql
-- ==========================================================================

-- Migration: 20260921_0020_rebrand_to_universal_look.sql
-- Rebrand store details to Universal Look, ensure categories and storage buckets

BEGIN;

-- 1. Update or Insert Store Settings (id = 1)
INSERT INTO public.store_settings (id, name, owner_name, phone, email, address, updated_at)
VALUES (
  1,
  'Universal Look',
  '',
  '9159600067',
  'universallook600067@gmail.com',
  '1/46 GNT Road, Sholavaram, Chennai - 600067',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = 'Universal Look',
  owner_name = '',
  phone = '9159600067',
  email = 'universallook600067@gmail.com',
  address = '1/46 GNT Road, Sholavaram, Chennai - 600067',
  updated_at = NOW();

-- 2. Create public 'branding' storage bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding',
  'branding',
  TRUE,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 10485760;

-- 3. Storage Policies for branding bucket
DROP POLICY IF EXISTS branding_public_read ON storage.objects;
CREATE POLICY branding_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'branding');

DROP POLICY IF EXISTS branding_portal_upload ON storage.objects;
CREATE POLICY branding_portal_upload ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'branding');

DROP POLICY IF EXISTS branding_portal_update ON storage.objects;
CREATE POLICY branding_portal_update ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'branding')
  WITH CHECK (bucket_id = 'branding');

COMMIT;

-- ==========================================================================
-- MIGRATION 21 of 29: 20260921_0021_reassign_deleted_category_to_general.sql
-- ==========================================================================

-- Migration: 20260921_0021_reassign_deleted_category_to_general.sql
-- Description: Automatically reassign products to 'General' category when any category is deleted.

BEGIN;

-- 1. Ensure 'General' category exists
INSERT INTO public.categories (name_en, name_ta, is_active, sort_order)
VALUES ('General', 'பொதுவானது', TRUE, 0)
ON CONFLICT (name_en) DO NOTHING;

-- 2. Trigger function to reassign products to 'General' upon category deletion
CREATE OR REPLACE FUNCTION public.reassign_deleted_category_products()
RETURNS TRIGGER AS $$
DECLARE
  v_general_id BIGINT;
BEGIN
  -- Find or fallback General category ID
  SELECT id INTO v_general_id
  FROM public.categories
  WHERE LOWER(name_en) = 'general'
  LIMIT 1;

  -- Update all products referencing the deleted category by ID or name
  UPDATE public.products
  SET category = 'General',
      category_id = v_general_id
  WHERE category_id = OLD.id
     OR LOWER(category) = LOWER(OLD.name_en);

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach BEFORE DELETE trigger to categories table
DROP TRIGGER IF EXISTS trg_reassign_deleted_category_products ON public.categories;
CREATE TRIGGER trg_reassign_deleted_category_products
BEFORE DELETE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.reassign_deleted_category_products();

-- 4. Immediate cleanup: Fix any currently orphaned products whose category was already deleted (e.g. 'Tailoring')
UPDATE public.products
SET category = 'General',
    category_id = (SELECT id FROM public.categories WHERE LOWER(name_en) = 'general' LIMIT 1)
WHERE category_id IS NULL
   OR category NOT IN (SELECT name_en FROM public.categories);

COMMIT;

-- ==========================================================================
-- MIGRATION 22 of 29: 20260923_0022_fix_orders_remarks_constraint.sql
-- ==========================================================================

-- ==========================================================================
-- Migration 0022: Fix orders table remarks and reference_number NOT NULL constraint
-- Date: 2026-09-23
-- Purpose:
--   1. Drop NOT NULL constraint on public.orders.remarks and reference_number,
--      ensuring safe DEFAULT '' so NULL inputs never break checkout transactions.
--   2. Update complete_pos_sale_with_inventory to safely COALESCE remarks and
--      reference_number to '' when inserting into orders.
-- ==========================================================================

BEGIN;

-- Relax NOT NULL constraint and set safe defaults
ALTER TABLE public.orders ALTER COLUMN remarks DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN remarks SET DEFAULT '';

ALTER TABLE public.orders ALTER COLUMN reference_number DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN reference_number SET DEFAULT '';

-- Update complete_pos_sale_with_inventory RPC
CREATE OR REPLACE FUNCTION public.complete_pos_sale_with_inventory(
  p_customer_name TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_items JSONB,
  p_shipping NUMERIC DEFAULT 0,
  p_status TEXT DEFAULT 'completed',
  p_order_mode TEXT DEFAULT 'offline',
  p_order_type TEXT DEFAULT 'pos_sale',
  p_delivery_charge NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_manual_discount_amount NUMERIC DEFAULT 0,
  p_manual_discount_type TEXT DEFAULT 'flat',
  p_manual_discount_value NUMERIC DEFAULT 0,
  p_coupon_code TEXT DEFAULT NULL,
  p_coupon_percentage NUMERIC DEFAULT 0,
  p_payment_method TEXT DEFAULT 'cash',
  p_split_details JSONB DEFAULT '{}'::JSONB,
  p_total_gst NUMERIC DEFAULT 0,
  p_gst_enabled BOOLEAN DEFAULT FALSE,
  p_remarks TEXT DEFAULT '',
  p_reference_number TEXT DEFAULT '',
  p_billing_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invoice_no TEXT;
  v_order_id UUID;
  v_subtotal NUMERIC := 0;
  v_total NUMERIC := 0;
  v_item JSONB;
  v_product_id BIGINT;
  v_variant_id UUID;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
  v_line_total NUMERIC;
  v_product_name TEXT;
  v_name_ta TEXT;
  v_unit TEXT;
  v_unit_type TEXT;
  v_base_quantity NUMERIC;
  v_is_manual BOOLEAN;
  v_discount NUMERIC;
  v_gst_amount NUMERIC;
  v_gst_rate NUMERIC;
  v_image_url TEXT;
  v_variant_name TEXT;
  v_source TEXT;
  v_note TEXT;
  v_category TEXT;
  v_current_stock NUMERIC;
  v_barcode_id UUID;
  v_created_at TIMESTAMPTZ := COALESCE(p_billing_date, NOW());
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order items cannot be empty';
  END IF;

  -- 1. Atomic Pre-Validation of Available Stock for All Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item ->> 'product_id', '')::BIGINT;
    v_variant_id := NULLIF(v_item ->> 'variant_id', '')::UUID;
    v_quantity := COALESCE((v_item ->> 'quantity')::NUMERIC, 0);
    v_is_manual := COALESCE((v_item ->> 'is_manual')::BOOLEAN, FALSE);
    v_product_name := COALESCE(v_item ->> 'product_name', v_item ->> 'name', 'Product');

    IF NOT v_is_manual AND v_quantity > 0 THEN
      IF v_variant_id IS NOT NULL THEN
        SELECT stock INTO v_current_stock FROM public.product_variants WHERE id = v_variant_id FOR UPDATE;
        IF v_current_stock IS NULL OR v_current_stock < v_quantity THEN
          RAISE EXCEPTION 'Insufficient stock for % (Available: %, Requested: %)', v_product_name, COALESCE(v_current_stock, 0), v_quantity;
        END IF;
      ELSIF v_product_id IS NOT NULL THEN
        SELECT stock_quantity INTO v_current_stock FROM public.products WHERE id = v_product_id FOR UPDATE;
        IF v_current_stock IS NULL OR v_current_stock < v_quantity THEN
          RAISE EXCEPTION 'Insufficient stock for % (Available: %, Requested: %)', v_product_name, COALESCE(v_current_stock, 0), v_quantity;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- 2. Calculate Subtotal & Generate Invoice Number
  v_invoice_no := public.get_next_invoice_no();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := COALESCE((v_item ->> 'quantity')::NUMERIC, 0);
    v_unit_price := COALESCE(
      (v_item ->> 'unit_price')::NUMERIC,
      (v_item ->> 'base_price')::NUMERIC,
      (v_item ->> 'price')::NUMERIC,
      0
    );
    v_line_total := COALESCE((v_item ->> 'line_total')::NUMERIC, ROUND(v_quantity * v_unit_price, 2));
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  v_total := GREATEST(0, ROUND(v_subtotal + COALESCE(p_shipping, 0) + COALESCE(p_delivery_charge, 0) - COALESCE(p_discount_amount, 0), 2));

  -- 3. Insert Order Record (safely COALESCE remarks and reference_number)
  INSERT INTO public.orders (
    invoice_no, user_id, customer_name, phone, address, items,
    subtotal, shipping, total, status, order_mode, order_type,
    delivery_charge, discount_amount, manual_discount_amount,
    manual_discount_type, manual_discount_value, coupon_code,
    coupon_percentage, total_gst, gst_amount, gst_enabled,
    payment_method, payment_mode, split_details, remarks,
    reference_number, billing_date, created_at, updated_at
  )
  VALUES (
    v_invoice_no, v_user_id, COALESCE(NULLIF(BTRIM(p_customer_name), ''), 'Customer'),
    COALESCE(p_phone, ''), COALESCE(p_address, ''), p_items,
    v_subtotal, COALESCE(p_shipping, 0), v_total, COALESCE(p_status, 'completed'),
    COALESCE(p_order_mode, 'offline'), COALESCE(p_order_type, 'pos_sale'),
    COALESCE(p_delivery_charge, 0), COALESCE(p_discount_amount, 0),
    COALESCE(p_manual_discount_amount, 0), COALESCE(p_manual_discount_type, 'flat'),
    COALESCE(p_manual_discount_value, 0), p_coupon_code,
    COALESCE(p_coupon_percentage, 0), COALESCE(p_total_gst, 0),
    COALESCE(p_total_gst, 0), COALESCE(p_gst_enabled, FALSE),
    COALESCE(p_payment_method, 'cash'), COALESCE(p_payment_method, 'cash'),
    COALESCE(p_split_details, '{}'::JSONB), COALESCE(p_remarks, ''),
    COALESCE(p_reference_number, ''), p_billing_date, v_created_at, NOW()
  )
  RETURNING id INTO v_order_id;

  -- 4. Insert Order Items, Deduct Stock & Record SALE Movements
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item ->> 'product_id', '')::BIGINT;
    v_variant_id := NULLIF(v_item ->> 'variant_id', '')::UUID;
    v_quantity := COALESCE((v_item ->> 'quantity')::NUMERIC, 0);
    v_unit_price := COALESCE((v_item ->> 'unit_price')::NUMERIC, (v_item ->> 'base_price')::NUMERIC, 0);
    v_line_total := COALESCE((v_item ->> 'line_total')::NUMERIC, ROUND(v_quantity * v_unit_price, 2));
    v_product_name := COALESCE(v_item ->> 'product_name', v_item ->> 'name', 'Product');
    v_name_ta := COALESCE(v_item ->> 'product_tamil_name', v_item ->> 'tamil_name', '');
    v_unit := COALESCE(v_item ->> 'unit', 'piece');
    v_unit_type := COALESCE(v_item ->> 'unit_type', 'unit');
    v_base_quantity := COALESCE((v_item ->> 'base_quantity')::NUMERIC, 1);
    v_is_manual := COALESCE((v_item ->> 'is_manual')::BOOLEAN, FALSE);
    v_discount := COALESCE((v_item ->> 'discount')::NUMERIC, 0);
    v_gst_amount := COALESCE((v_item ->> 'gst_amount')::NUMERIC, 0);
    v_gst_rate := COALESCE((v_item ->> 'gst_rate')::NUMERIC, 0);
    v_image_url := v_item ->> 'image_url';
    v_variant_name := v_item ->> 'variant_name';
    v_source := COALESCE(v_item ->> 'source', 'catalogue');
    v_note := v_item ->> 'note';
    v_category := v_item ->> 'category';

    INSERT INTO public.order_items (
      order_id, product_id, variant_id, product_name, name,
      product_tamil_name, tamil_name, quantity, unit, unit_type,
      base_quantity, base_price, unit_price, line_total, image_url,
      is_manual, discount, gst_amount, gst_rate, variant_name,
      source, note, category, created_at
    )
    VALUES (
      v_order_id, v_product_id, v_variant_id, v_product_name, v_product_name,
      v_name_ta, v_name_ta, v_quantity, v_unit, v_unit_type,
      v_base_quantity, v_unit_price, v_unit_price, v_line_total, v_image_url,
      v_is_manual, v_discount, v_gst_amount, v_gst_rate, v_variant_name,
      v_source, v_note, v_category, v_created_at
    );

    -- Deduct Stock and Insert SALE Movement
    IF NOT v_is_manual AND v_quantity > 0 THEN
      IF v_variant_id IS NOT NULL THEN
        SELECT stock INTO v_current_stock FROM public.product_variants WHERE id = v_variant_id;
        SELECT id INTO v_barcode_id FROM public.barcode_registry WHERE variant_id = v_variant_id AND is_active = TRUE LIMIT 1;

        UPDATE public.product_variants
        SET stock = GREATEST(0, stock - v_quantity), updated_at = NOW()
        WHERE id = v_variant_id;

        -- Parent aggregate update
        UPDATE public.products
        SET stock_quantity = (SELECT COALESCE(SUM(stock), 0) FROM public.product_variants WHERE product_id = v_product_id AND is_active = TRUE),
            stock = FLOOR((SELECT COALESCE(SUM(stock), 0) FROM public.product_variants WHERE product_id = v_product_id AND is_active = TRUE))::INTEGER,
            updated_at = NOW()
        WHERE id = v_product_id;

        INSERT INTO public.inventory_movements (
          product_id, variant_id, barcode_id, movement_type,
          quantity_delta, quantity_before, quantity_after,
          reference_type, reference_id, note
        )
        VALUES (
          v_product_id, v_variant_id, v_barcode_id, 'SALE',
          -v_quantity, v_current_stock, GREATEST(0, v_current_stock - v_quantity),
          'order', v_invoice_no, 'POS Sale checkout'
        );

      ELSIF v_product_id IS NOT NULL THEN
        SELECT stock_quantity INTO v_current_stock FROM public.products WHERE id = v_product_id;
        SELECT id INTO v_barcode_id FROM public.barcode_registry WHERE product_id = v_product_id AND variant_id IS NULL AND is_active = TRUE LIMIT 1;

        UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity - v_quantity),
            stock = GREATEST(0, stock - FLOOR(v_quantity)::INTEGER),
            updated_at = NOW()
        WHERE id = v_product_id;

        INSERT INTO public.inventory_movements (
          product_id, variant_id, barcode_id, movement_type,
          quantity_delta, quantity_before, quantity_after,
          reference_type, reference_id, note
        )
        VALUES (
          v_product_id, NULL, v_barcode_id, 'SALE',
          -v_quantity, v_current_stock, GREATEST(0, v_current_stock - v_quantity),
          'order', v_invoice_no, 'POS Sale checkout'
        );
      END IF;
    END IF;
  END LOOP;

  -- 5. Increment Coupon Usage Count
  IF p_coupon_code IS NOT NULL AND BTRIM(p_coupon_code) <> '' THEN
    UPDATE public.coupons
    SET usage_count = usage_count + 1, updated_at = NOW()
    WHERE UPPER(BTRIM(code)) = UPPER(BTRIM(p_coupon_code));
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'invoice_no', v_invoice_no,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_pos_sale_with_inventory(
  TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, TEXT, NUMERIC, TEXT, JSONB, NUMERIC, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ
) TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ==========================================================================
-- MIGRATION 23 of 29: 20260930_0023_split_payments.sql
-- ==========================================================================

-- ============================================================
-- Migration 0023: Split payments (cash / QR / card)
-- Date: 2026-09-30
-- Purpose:
-- 1. Allow advance order deposits / final payments to be split across cash, QR and card
-- 2. Store the per-channel amounts (split_details) on advance_order_payments
-- 3. Write the full collection breakdown (deposit + final) into orders.split_details
-- POS bills already use orders.split_details (no schema change needed there).
-- ============================================================

BEGIN;

ALTER TABLE public.advance_order_payments
  ADD COLUMN IF NOT EXISTS split_details jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.advance_order_payments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%payment_method%'
  LOOP
    EXECUTE format('ALTER TABLE public.advance_order_payments DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.advance_order_payments
  ADD CONSTRAINT advance_order_payments_payment_method_check
  CHECK (payment_method IN ('cash', 'upi', 'card', 'split'));

-- Amount collected per channel for one payment: {"cash": n, "qr": n, "card": n}
CREATE OR REPLACE FUNCTION public.payment_breakdown(p_method text, p_split jsonb, p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_cash numeric := coalesce((p_split->>'cash')::numeric, 0);
  v_qr   numeric := coalesce((p_split->>'qr')::numeric, (p_split->>'upi')::numeric, 0);
  v_card numeric := coalesce((p_split->>'card')::numeric, 0);
BEGIN
  IF v_cash + v_qr + v_card > 0 THEN
    RETURN jsonb_build_object('cash', v_cash, 'qr', v_qr, 'card', v_card);
  END IF;
  RETURN jsonb_build_object(
    'cash', CASE WHEN lower(coalesce(p_method, '')) = 'cash' THEN coalesce(p_amount, 0) ELSE 0 END,
    'qr',   CASE WHEN lower(coalesce(p_method, '')) IN ('upi', 'qr') THEN coalesce(p_amount, 0) ELSE 0 END,
    'card', CASE WHEN lower(coalesce(p_method, '')) = 'card' THEN coalesce(p_amount, 0) ELSE 0 END
  );
END;
$$;

DROP FUNCTION IF EXISTS public.create_advance_order(text,text,text,text,text,text,numeric,numeric,date,text,text,text,jsonb);
create or replace function public.create_advance_order(
  p_customer_name text, p_phone text, p_address text, p_product_name text,
  p_category text, p_description text, p_total_amount numeric, p_deposit_amount numeric,
  p_expected_delivery_date date, p_remarks text, p_payment_method text, p_created_by_name text,
  p_products jsonb default '[]'::jsonb,
  p_split_details jsonb default '{}'::jsonb
)
returns public.advance_orders
language plpgsql security definer set search_path = public
as $$
declare v_order public.advance_orders; v_now timestamptz := now(); v_deposit_id text;
begin
  if trim(coalesce(p_customer_name,'')) = '' then raise exception 'Customer name is required'; end if;
  if trim(coalesce(p_phone,'')) = '' then raise exception 'Phone number is required'; end if;
  if trim(coalesce(p_product_name,'')) = '' then raise exception 'Product name is required'; end if;
  if coalesce(p_total_amount,0) <= 0 then raise exception 'Total amount must be greater than zero'; end if;
  if coalesce(p_deposit_amount,0) <= 0 or p_deposit_amount >= p_total_amount then raise exception 'Deposit must be greater than zero and less than the total amount'; end if;
  if lower(coalesce(p_payment_method,'')) not in ('cash','upi','card','split') then raise exception 'Select a valid deposit payment method'; end if;
  if lower(p_payment_method) = 'split' and abs(coalesce((p_split_details->>'cash')::numeric,0) + coalesce((p_split_details->>'qr')::numeric,(p_split_details->>'upi')::numeric,0) + coalesce((p_split_details->>'card')::numeric,0) - p_deposit_amount) >= 0.01 then raise exception 'Split payment amounts must add up to the deposit amount'; end if;
  v_deposit_id := 'DEP-' || to_char(v_now at time zone 'Asia/Kolkata','YYYYMMDD') || '-' || lpad(nextval('public.deposit_number_seq')::text,4,'0');
  insert into public.advance_orders(deposit_id,customer_name,phone,address,product_name,products,category,description,total_amount,deposit_amount,expected_delivery_date,remarks,created_by,created_by_name,created_at,updated_at)
  values(v_deposit_id,trim(p_customer_name),trim(p_phone),trim(coalesce(p_address,'')),trim(p_product_name),case when jsonb_typeof(coalesce(p_products,'[]'::jsonb))='array' then coalesce(p_products,'[]'::jsonb) else '[]'::jsonb end,trim(coalesce(p_category,'')),trim(coalesce(p_description,'')),round(p_total_amount,2),round(p_deposit_amount,2),p_expected_delivery_date,trim(coalesce(p_remarks,'')),auth.uid(),trim(coalesce(p_created_by_name,'')),v_now,v_now)
  returning * into v_order;
  insert into public.advance_order_payments(advance_order_id,payment_type,amount,payment_method,split_details,remarks,received_by,received_at)
  values(v_order.id,'deposit',v_order.deposit_amount,lower(p_payment_method),case when lower(p_payment_method)='split' then coalesce(p_split_details,'{}'::jsonb) else '{}'::jsonb end,coalesce(p_remarks,''),auth.uid(),v_now);
  insert into public.advance_order_timeline(advance_order_id,event_type,label,created_by,created_at) values
    (v_order.id,'created','Created',auth.uid(),v_now),
    (v_order.id,'deposit_received','Deposit Received',auth.uid(),v_now);
  return v_order;
end;
$$;

DROP FUNCTION IF EXISTS public.complete_advance_order_v2(uuid,text,numeric,text,numeric,numeric,text);
CREATE OR REPLACE FUNCTION public.complete_advance_order_v2(
  p_order_id uuid,
  p_payment_method text,
  p_final_amount numeric,
  p_coupon_code text DEFAULT NULL,
  p_coupon_percentage numeric DEFAULT 0,
  p_manual_discount numeric DEFAULT 0,
  p_remarks text DEFAULT '',
  p_split_details jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(order_id uuid, invoice_no text, completed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advance        public.advance_orders;
  v_order_id       uuid := gen_random_uuid();
  v_invoice        text;
  v_now            timestamptz := now();
  v_items          jsonb;
  v_item           jsonb;
  v_total_discount numeric := 0;
  v_dep            record;
  v_dep_bd         jsonb := '{}'::jsonb;
  v_fin_bd         jsonb;
  v_split          jsonb;
BEGIN
  -- Validate payment method
  IF lower(coalesce(p_payment_method, '')) NOT IN ('cash', 'upi', 'card', 'split') THEN
    RAISE EXCEPTION 'Select a valid payment method';
  END IF;
  IF lower(p_payment_method) = 'split' AND abs(
       coalesce((p_split_details->>'cash')::numeric, 0)
     + coalesce((p_split_details->>'qr')::numeric, (p_split_details->>'upi')::numeric, 0)
     + coalesce((p_split_details->>'card')::numeric, 0) - p_final_amount) >= 0.01 THEN
    RAISE EXCEPTION 'Split payment amounts must add up to the final amount';
  END IF;

  -- Lock and fetch the advance order
  SELECT * INTO v_advance FROM public.advance_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Advance order not found';
  END IF;

  IF v_advance.status = 'cancelled' THEN
    RAISE EXCEPTION 'A cancelled order cannot be completed';
  END IF;

  -- Self-healing check: If invoice or completed order already exists, ensure completed status and return cleanly
  IF v_advance.completed_order_id IS NOT NULL OR v_advance.invoice_number IS NOT NULL THEN
    IF v_advance.status != 'completed' THEN
      UPDATE public.advance_orders
      SET status = 'completed',
          updated_at = v_now
      WHERE id = p_order_id;
    END IF;

    RETURN QUERY SELECT
      coalesce(v_advance.completed_order_id, gen_random_uuid()),
      coalesce(v_advance.invoice_number, 'INV00000000'),
      coalesce(v_advance.completed_at, v_now);
    RETURN;
  END IF;

  -- Calculate total discount from manual discount and coupon
  v_total_discount := p_manual_discount + (v_advance.remaining_balance - p_manual_discount - p_final_amount);
  IF v_total_discount < 0 THEN
    v_total_discount := 0;
  END IF;

  -- Generate invoice number using the existing 8-digit sequence
  v_invoice := LPAD(nextval('public.invoice_number_seq')::TEXT, 8, '0');

  -- Build items JSONB - prefer products array, fall back to single product
  v_items := CASE
    WHEN jsonb_typeof(v_advance.products) = 'array' AND jsonb_array_length(v_advance.products) > 0
      THEN v_advance.products
    ELSE jsonb_build_array(
      jsonb_build_object(
        'name',        v_advance.product_name,
        'category',    v_advance.category,
        'description', v_advance.description,
        'quantity',    1,
        'base_price',  v_advance.total_amount,
        'line_total',  v_advance.total_amount,
        'unit',        'piece',
        'unit_type',   'unit',
        'source',      'advance_order'
      )
    )
  END;

  -- Full collection breakdown for this order (deposit + final payment) by cash / qr / card
  SELECT payment_method, split_details, amount INTO v_dep
  FROM public.advance_order_payments
  WHERE advance_order_id = p_order_id AND payment_type = 'deposit'
  LIMIT 1;
  IF FOUND THEN
    v_dep_bd := public.payment_breakdown(v_dep.payment_method, v_dep.split_details, v_dep.amount);
  END IF;
  v_fin_bd := public.payment_breakdown(p_payment_method, p_split_details, p_final_amount);
  v_split := jsonb_build_object(
    'cash', coalesce((v_dep_bd->>'cash')::numeric, 0) + coalesce((v_fin_bd->>'cash')::numeric, 0),
    'qr',   coalesce((v_dep_bd->>'qr')::numeric, 0)   + coalesce((v_fin_bd->>'qr')::numeric, 0),
    'card', coalesce((v_dep_bd->>'card')::numeric, 0) + coalesce((v_fin_bd->>'card')::numeric, 0)
  );

  -- Create final sale order
  INSERT INTO public.orders (
    id, invoice_no, customer_name, phone, address, user_id,
    items, subtotal, total, status, order_mode, order_type,
    shipping, delivery_charge, discount_amount, manual_discount_amount,
    coupon_code, coupon_percentage, manual_discount_type, manual_discount_value,
    payment_mode, payment_method, split_details, created_at, updated_at
  ) VALUES (
    v_order_id, v_invoice,
    v_advance.customer_name, v_advance.phone, v_advance.address, auth.uid(),
    v_items, v_advance.total_amount, greatest(0, v_advance.total_amount - v_total_discount),
    'completed', 'offline', 'advance_order',
    0, 0, v_total_discount, p_manual_discount,
    p_coupon_code, p_coupon_percentage, 'flat', p_manual_discount,
    lower(p_payment_method), lower(p_payment_method), v_split,
    v_now, v_now
  );

  -- Insert order items
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
    INSERT INTO public.order_items (
      order_id, product_name, name, quantity, unit, unit_type,
      base_price, line_total, is_manual
    ) VALUES (
      v_order_id,
      coalesce(nullif(trim(v_item->>'name'), ''), 'Product'),
      coalesce(nullif(trim(v_item->>'name'), ''), 'Product'),
      greatest(coalesce((v_item->>'quantity')::numeric, 1), 0),
      coalesce(nullif(v_item->>'unit', ''), 'piece'),
      coalesce(nullif(v_item->>'unit_type', ''), 'unit'),
      greatest(coalesce((v_item->>'base_price')::numeric, 0), 0),
      greatest(coalesce((v_item->>'line_total')::numeric, 0), 0),
      false
    );
  END LOOP;

  -- Record final payment
  INSERT INTO public.advance_order_payments (
    advance_order_id, payment_type, amount, payment_method, split_details, remarks, received_by, received_at
  ) VALUES (
    p_order_id, 'remaining', p_final_amount,
    lower(p_payment_method),
    CASE WHEN lower(p_payment_method) = 'split' THEN coalesce(p_split_details, '{}'::jsonb) ELSE '{}'::jsonb END,
    coalesce(p_remarks, ''), auth.uid(), v_now
  );

  -- Mark advance order as completed
  UPDATE public.advance_orders SET
    status               = 'completed',
    completed_at         = v_now,
    completed_order_id   = v_order_id,
    invoice_number       = v_invoice,
    final_payment_method = lower(p_payment_method),
    remarks              = CASE WHEN trim(coalesce(p_remarks, '')) = '' THEN remarks ELSE p_remarks END,
    updated_at           = v_now
  WHERE id = p_order_id;

  -- Timeline events
  INSERT INTO public.advance_order_timeline (
    advance_order_id, event_type, label, remarks, created_by, created_at
  ) VALUES
    (p_order_id, 'remaining_payment_received', 'Remaining Payment Received', coalesce(p_remarks, ''), auth.uid(), v_now),
    (p_order_id, 'invoice_generated',          'Invoice Generated',          v_invoice,               auth.uid(), v_now);

  RETURN QUERY SELECT v_order_id, v_invoice, v_now;
END;
$$;
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ==========================================================================
-- MIGRATION 24 of 29: 20261001_0024_advance_order_reference_number.sql
-- ==========================================================================

BEGIN;

ALTER TABLE public.advance_orders
  ADD COLUMN IF NOT EXISTS reference_number text NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ==========================================================================
-- MIGRATION 25 of 29: 20261004_0025_rebrand_to_madhura_tex.sql
-- ==========================================================================

-- Migration: 20261004_0025_rebrand_to_madhura_tex.sql
-- Rebrand store details to Madhura Tex, ensure categories and storage buckets

BEGIN;

-- 1. Update or Insert Store Settings (id = 1)
INSERT INTO public.store_settings (id, name, owner_name, phone, email, address, updated_at)
VALUES (
  1,
  'Madhura Tex',
  '',
  '8682037615',
  'madhuratex1@gmail.com',
  'Malar complex, Sellipet Main Rd, Kalitheerampattu, Kandamangalam junction',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = 'Madhura Tex',
  owner_name = '',
  phone = '8682037615',
  email = 'madhuratex1@gmail.com',
  address = 'Malar complex, Sellipet Main Rd, Kalitheerampattu, Kandamangalam junction',
  updated_at = NOW();

-- 2. Create public 'branding' storage bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding',
  'branding',
  TRUE,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 10485760;

-- 3. Storage Policies for branding bucket
DROP POLICY IF EXISTS branding_public_read ON storage.objects;
CREATE POLICY branding_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'branding');

DROP POLICY IF EXISTS branding_portal_upload ON storage.objects;
CREATE POLICY branding_portal_upload ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'branding');

DROP POLICY IF EXISTS branding_portal_update ON storage.objects;
CREATE POLICY branding_portal_update ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'branding')
  WITH CHECK (bucket_id = 'branding');

COMMIT;

-- ==========================================================================
-- MIGRATION 26 of 29: 20261004_0026_grant_table_permissions.sql
-- ==========================================================================

-- ==============================================================================
-- Migration: 20261004_0026_grant_table_permissions.sql
-- Description: Grant table, sequence, and routine privileges to anon, authenticated,
--              and service_role so PostgREST API queries do not fail with 42501 permission denied.
-- ==============================================================================

-- 1. Ensure schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant table permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Grant sequence permissions
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 4. Grant routine/function permissions
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 5. Set default privileges for future tables, sequences, and routines
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- ==========================================================================
-- MIGRATION 27 of 29: 20261006_0027_advance_order_inventory_stock.sql
-- ==========================================================================

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

-- ==========================================================================
-- MIGRATION 28 of 29: 20261015_0028_customer_birthdays_and_offers.sql
-- ==========================================================================

-- Migration: 20261015_0028_customer_birthdays_and_offers.sql
-- Description: Adds customer birthday tracking and birthday promotional offers for CHERAS CLOTHING.
-- Safe, non-destructive migration.

-- 1. Ensure profiles table has birthday column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS birthday DATE;

-- 2. Customer Birthdays table for tracking both registered profiles and POS/walk-in customers
CREATE TABLE IF NOT EXISTS public.customer_birthdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  birthday DATE NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by phone
CREATE UNIQUE INDEX IF NOT EXISTS customer_birthdays_phone_idx
  ON public.customer_birthdays (phone);

-- 3. Birthday Promotional Offers table
CREATE TABLE IF NOT EXISTS public.birthday_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  discount_description TEXT NOT NULL,
  coupon_code TEXT,
  message_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default starter birthday offers
INSERT INTO public.birthday_offers (id, title, discount_description, coupon_code, message_template, is_active)
VALUES
(
  'b0000000-0000-0000-0000-000000000001',
  'Birthday Special 15% OFF',
  'Flat 15% discount on all textiles & sarees',
  'BDAY15',
  'Dear {name},

Wishing you a very Happy Birthday from all of us at {shop_name}! 🎂✨

As our special birthday treat, enjoy {offer} on your next visit to our store!

Coupon Code: {coupon_code}
📍 Visit us: {address}
📞 Call/WhatsApp: {phone}
✨ Instagram: {instagram}

Terms: Show this message at the counter to claim your birthday offer. Have a wonderful celebration! 🎉',
  TRUE
),
(
  'b0000000-0000-0000-0000-000000000002',
  'Flat ₹200 Birthday Treat',
  'Flat ₹200 OFF on purchase above ₹1,000',
  'BDAY200',
  'Happy Birthday, {name}! 💐🎉

Team {shop_name} wishes you a joyful and prosperous year ahead!

Celebrate in style with our exclusive Birthday Gift: {offer}!

Coupon Code: {coupon_code}
📍 Store: {address}
📞 Phone: {phone}
✨ Follow: {instagram}

Visit us this week to redeem your gift. Happy Shopping! 🛍️',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.customer_birthdays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.birthday_offers ENABLE ROW LEVEL SECURITY;

-- Allow authenticated staff and admins full management access
CREATE POLICY "Admins and staff can manage customer birthdays"
  ON public.customer_birthdays
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins and staff can manage birthday offers"
  ON public.birthday_offers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==========================================================================
-- MIGRATION 29 of 29: 20261016_0030_advance_order_financial_breakdown.sql
-- ==========================================================================

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


-- ==========================================================================
-- ==========================================================================
-- SECTION: PROPOSED / STAGING MIGRATIONS (supabase/proposed_migrations)
-- ==========================================================================
-- ⚠️ IMPORTANT NOTICE FOR SUPABASE SQL EDITOR USERS:
-- Migrations 1 through 29 above are the active production migrations
-- required for CHERAS CLOTHING POS (Catalog, Orders, Inventory, Barcodes, Advances,
-- Expenses, Split Payments, and Customer Birthdays & Offers).
--
-- The migration(s) below are PROPOSED DRAFTS that enforce strict least-privilege RLS
-- by revoking permissions from the anonymous ("anon") role and requiring Supabase
-- Auth JWT sessions for staff/admin actions.
-- Because the standard POS terminal operates with client-side credential verification
-- using the Supabase anonymous client key, executing these statements immediately
-- will block anonymous POS cashier checkouts (42501 permission denied).
--
-- They are preserved in full below, wrapped in a block comment /* ... */ so you
-- can safely copy and run this entire consolidated file into the Supabase SQL Editor.
-- If and when you migrate cashiers and admins to Supabase Auth users, remove the
-- block comment markers to apply these security policies.
-- ==========================================================================

/*
-- ==========================================================================
-- PROPOSED MIGRATION 1 of 1: 20261016_0029_secure_least_privilege_rls.sql
-- ==========================================================================

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
*/
