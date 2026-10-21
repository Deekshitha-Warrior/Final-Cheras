-- Apply the supplied Cheras profile after the inherited template migrations.
BEGIN;
UPDATE public.store_settings SET
  name = 'CHERAS CLOTHING',
  owner_name = '',
  phone = '+91 9715083947',
  email = 'cherasclothing777@gmail.com',
  address = '74, Cheras Clothing, Avinashi Road, opposite to Government Medical College, Coimbatore 641014',
  city = 'Coimbatore, Tamil Nadu',
  tagline = 'Wear Your Kingdom',
  instagram_url = 'https://www.instagram.com/cherasclothing_official/',
  catalog_headline = 'Explore the Cheras Clothing Collection',
  gstin = '',
  gst_enabled = FALSE,
  theme_color = '#171717',
  logo_url = '/cheras-logo.png',
  updated_at = NOW()
WHERE id = 1;
COMMIT;
