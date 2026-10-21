-- Migration: 20261017_0032_universal_customer_birthdays_access.sql
-- Description: Enables universal access for customer birthdays and promotional offers across POS billing and Admin Dashboard.

DROP POLICY IF EXISTS "Admins and staff can manage customer birthdays" ON public.customer_birthdays;
DROP POLICY IF EXISTS customer_birthdays_staff_manage ON public.customer_birthdays;
DROP POLICY IF EXISTS "Allow all for customer birthdays" ON public.customer_birthdays;

CREATE POLICY "Allow all for customer birthdays"
  ON public.customer_birthdays
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_birthdays TO public, anon, authenticated;

DROP POLICY IF EXISTS "Admins and staff can manage birthday offers" ON public.birthday_offers;
DROP POLICY IF EXISTS birthday_offers_staff_manage ON public.birthday_offers;
DROP POLICY IF EXISTS "Allow all for birthday offers" ON public.birthday_offers;

CREATE POLICY "Allow all for birthday offers"
  ON public.birthday_offers
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.birthday_offers TO public, anon, authenticated;
