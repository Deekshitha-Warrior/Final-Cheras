-- Migration: 20261017_0031_sync_advance_order_breakdown_on_completion.sql
-- Description: Ensures complete_advance_order_v2 copies subtotal, delivery_charge, coupon_code,
-- discount_amount, manual_discount_amount, total_gst, gst_amount, gst_enabled, reference_number,
-- and remarks from the advance_order to the created orders table record.

DROP FUNCTION IF EXISTS public.complete_advance_order_v2(uuid,text,numeric,text,numeric,numeric,text);
DROP FUNCTION IF EXISTS public.complete_advance_order_v2(uuid,text,numeric,text,numeric,numeric,text,jsonb);

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
  v_coupon_code    text;
  v_coupon_disc    numeric := 0;
  v_manual_disc    numeric := 0;
  v_delivery       numeric := 0;
  v_total_gst      numeric := 0;
  v_subtotal       numeric := 0;
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

  -- Financial breakdown calculation from the advance order
  v_delivery := coalesce(v_advance.delivery_charge, 0);
  v_coupon_code := coalesce(nullif(trim(p_coupon_code), ''), v_advance.coupon_code);
  v_coupon_disc := coalesce(
    v_advance.coupon_discount,
    CASE WHEN v_coupon_code IS NOT NULL AND v_coupon_code <> '' THEN coalesce(v_advance.discount_amount, 0) ELSE 0 END,
    0
  );
  v_manual_disc := greatest(coalesce(nullif(p_manual_discount, 0), v_advance.manual_discount, 0), 0);
  v_total_gst := coalesce(
    v_advance.total_gst,
    coalesce(v_advance.cgst_amount, 0) + coalesce(v_advance.sgst_amount, 0),
    0
  );
  v_subtotal := coalesce(
    v_advance.subtotal,
    greatest(0, v_advance.total_amount - v_delivery - v_total_gst + v_coupon_disc + v_manual_disc)
  );

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

  -- Create final sale order with full financial breakdown transferred
  INSERT INTO public.orders (
    id, invoice_no, customer_name, phone, address, user_id,
    items, subtotal, total, status, order_mode, order_type,
    shipping, delivery_charge, discount_amount, manual_discount_amount,
    coupon_code, coupon_percentage, manual_discount_type, manual_discount_value,
    total_gst, gst_amount, gst_enabled, remarks, reference_number,
    payment_mode, payment_method, split_details, created_at, updated_at
  ) VALUES (
    v_order_id, v_invoice,
    v_advance.customer_name, v_advance.phone, v_advance.address, auth.uid(),
    v_items, v_subtotal, v_advance.total_amount,
    'completed', 'offline', 'advance_order',
    v_delivery, v_delivery, v_coupon_disc, v_manual_disc,
    v_coupon_code, coalesce(p_coupon_percentage, 0), 'flat', v_manual_disc,
    v_total_gst, v_total_gst, coalesce(v_advance.gst_enabled, v_total_gst > 0),
    coalesce(nullif(trim(p_remarks), ''), v_advance.remarks, ''),
    coalesce(v_advance.reference_number, ''),
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

GRANT EXECUTE ON FUNCTION public.complete_advance_order_v2(uuid, text, numeric, text, numeric, numeric, text, jsonb) TO public, anon, authenticated;
NOTIFY pgrst, 'reload schema';
