-- Migration: 20261019_0033_settings_and_theme_customization.sql
-- Adds columns to store_settings for brand customization, theme colors, and profile fields

BEGIN;

-- 1. Ensure required columns exist on store_settings
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#171717',
  ADD COLUMN IF NOT EXISTS tagline TEXT DEFAULT 'Wear Your Kingdom',
  ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Coimbatore, Tamil Nadu',
  ADD COLUMN IF NOT EXISTS business_hours TEXT DEFAULT 'Open Daily 9:30 AM - 9:30 PM',
  ADD COLUMN IF NOT EXISTS instagram_url TEXT DEFAULT 'https://www.instagram.com/cherasclothing_official/',
  ADD COLUMN IF NOT EXISTS catalog_headline TEXT DEFAULT 'Exclusive Sarees, Men''s Wear & Kids',
  ADD COLUMN IF NOT EXISTS gstin TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '/cheras-icon-white.png';

-- 2. Upsert initial CHERAS CLOTHING store profile record into store_settings (id = 1)
INSERT INTO public.store_settings (
  id,
  name,
  owner_name,
  phone,
  email,
  address,
  city,
  business_hours,
  tagline,
  instagram_url,
  catalog_headline,
  gstin,
  theme_color,
  logo_url,
  gst_enabled,
  updated_at
)
VALUES (
  1,
  'CHERAS CLOTHING',
  '',
  '+91 9715083947',
  'cherasclothing777@gmail.com',
  '74, Cheras Clothing, Avinashi Road, opposite to Government Medical College, Coimbatore 641014',
  'Coimbatore, Tamil Nadu',
  'Open Daily 9:30 AM - 9:30 PM',
  'Wear Your Kingdom',
  'https://www.instagram.com/cherasclothing_official/',
  'Exclusive Sarees, Men''s Wear & Kids',
  '',
  '#171717',
  '/cheras-icon-white.png',
  TRUE,
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  owner_name = CASE WHEN store_settings.owner_name = '' OR store_settings.owner_name IS NULL THEN EXCLUDED.owner_name ELSE store_settings.owner_name END,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  address = EXCLUDED.address,
  city = COALESCE(store_settings.city, EXCLUDED.city),
  business_hours = COALESCE(store_settings.business_hours, EXCLUDED.business_hours),
  tagline = COALESCE(store_settings.tagline, EXCLUDED.tagline),
  instagram_url = COALESCE(store_settings.instagram_url, EXCLUDED.instagram_url),
  catalog_headline = COALESCE(store_settings.catalog_headline, EXCLUDED.catalog_headline),
  gstin = COALESCE(store_settings.gstin, EXCLUDED.gstin),
  theme_color = COALESCE(store_settings.theme_color, EXCLUDED.theme_color),
  logo_url = COALESCE(store_settings.logo_url, EXCLUDED.logo_url),
  updated_at = NOW();

-- 3. Ensure public 'branding' storage bucket exists for shop logo uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding',
  'branding',
  TRUE,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable RLS and grant read/write policies for store_settings
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS store_settings_portal_manage ON public.store_settings;
CREATE POLICY store_settings_portal_manage ON public.store_settings
  FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);

COMMIT;
