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
