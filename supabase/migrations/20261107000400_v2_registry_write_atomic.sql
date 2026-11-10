-- Wave E: atomic master-registry writes for desk API (service_role RPCs).
-- Idempotency: public.money_idempotency (action prefixed registry_*).

CREATE OR REPLACE FUNCTION public.registry_insert_agent_and_link(
  p_property_id uuid,
  p_idempotency_key uuid,
  p_company_name text,
  p_market text,
  p_contact_name text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_link_status text DEFAULT 'approved',
  p_link_rate_tier text DEFAULT 'agents',
  p_credit_limit numeric DEFAULT 0,
  p_credit_used numeric DEFAULT 0,
  p_open_room_cap integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text := p_idempotency_key::text;
  v_cached jsonb;
  v_agent public.agents%ROWTYPE;
  v_prop_id uuid;
  v_mk text := lower(trim(coalesce(p_market, '')));
  v_st text := lower(trim(coalesce(p_link_status, '')));
  v_tier text := trim(coalesce(p_link_rate_tier, 'agents'));
BEGIN
  IF p_property_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'property_id and idempotency_key are required';
  END IF;
  IF trim(coalesce(p_company_name, '')) = '' THEN
    RAISE EXCEPTION 'company_name is required';
  END IF;

  IF v_mk NOT IN ('bhutan', 'jaigaon', 'india') THEN
    RAISE EXCEPTION 'market must be bhutan, jaigaon, or india';
  END IF;
  IF v_st NOT IN ('invited', 'approved', 'suspended') THEN
    RAISE EXCEPTION 'link status must be invited, approved, or suspended';
  END IF;

  SELECT result INTO v_cached
  FROM public.money_idempotency
  WHERE property_id = p_property_id AND idempotency_key = v_key;
  IF FOUND THEN
    RETURN v_cached || jsonb_build_object('replay', true);
  END IF;

  SELECT id INTO v_prop_id FROM public.properties WHERE id = p_property_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'property not found';
  END IF;

  INSERT INTO public.agents (
    company_name,
    market,
    status,
    contact_name,
    contact_phone,
    contact_email,
    notes,
    credit_limit,
    credit_used,
    rate_tier
  ) VALUES (
    trim(p_company_name),
    v_mk,
    'approved',
    nullif(trim(p_contact_name), ''),
    nullif(trim(p_contact_phone), ''),
    nullif(trim(lower(p_contact_email)), ''),
    nullif(trim(p_notes), ''),
    coalesce(p_credit_limit, 0),
    coalesce(p_credit_used, 0),
    v_tier
  )
  RETURNING * INTO v_agent;

  INSERT INTO public.agent_property_links (
    agent_id,
    property_id,
    status,
    rate_tier,
    credit_limit,
    credit_used,
    open_room_cap
  ) VALUES (
    v_agent.id,
    p_property_id,
    v_st,
    v_tier,
    coalesce(p_credit_limit, 0),
    coalesce(p_credit_used, 0),
    p_open_room_cap
  )
  ON CONFLICT (agent_id, property_id) DO UPDATE SET
    status = excluded.status,
    rate_tier = excluded.rate_tier,
    credit_limit = excluded.credit_limit,
    credit_used = excluded.credit_used,
    open_room_cap = excluded.open_room_cap,
    updated_at = now();

  v_cached := jsonb_build_object(
    'ok', true,
    'agent_id', v_agent.id,
    'replay', false
  );

  INSERT INTO public.money_idempotency (property_id, idempotency_key, action, result)
  VALUES (p_property_id, v_key, 'registry_insert_agent_and_link', v_cached);

  RETURN v_cached;
END;
$$;

REVOKE ALL ON FUNCTION public.registry_insert_agent_and_link(uuid, uuid, text, text, text, text, text, text, text, text, numeric, numeric, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.registry_insert_agent_and_link(uuid, uuid, text, text, text, text, text, text, text, text, numeric, numeric, integer) TO service_role;

COMMENT ON FUNCTION public.registry_insert_agent_and_link IS
  'Create agents row + agent_property_links for desk registry (idempotent).';

-- ---------------------------------------------------------------------------
-- Update agent profile + link terms (single property)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.registry_update_agent_and_link(
  p_property_id uuid,
  p_idempotency_key uuid,
  p_agent_id uuid,
  p_company_name text DEFAULT NULL,
  p_market text DEFAULT NULL,
  p_contact_name text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_commission_pct numeric DEFAULT NULL,
  p_link_status text DEFAULT NULL,
  p_link_rate_tier text DEFAULT NULL,
  p_credit_limit numeric DEFAULT NULL,
  p_credit_used numeric DEFAULT NULL,
  p_open_room_cap integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text := p_idempotency_key::text;
  v_cached jsonb;
  v_mk text;
  v_st text;
  v_tier text;
BEGIN
  IF p_property_id IS NULL OR p_idempotency_key IS NULL OR p_agent_id IS NULL THEN
    RAISE EXCEPTION 'property_id, idempotency_key, and agent_id are required';
  END IF;

  SELECT result INTO v_cached
  FROM public.money_idempotency
  WHERE property_id = p_property_id AND idempotency_key = v_key;
  IF FOUND THEN
    RETURN v_cached || jsonb_build_object('replay', true);
  END IF;

  PERFORM 1 FROM public.agent_property_links
  WHERE property_id = p_property_id AND agent_id = p_agent_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent is not linked to this property';
  END IF;

  IF p_market IS NOT NULL THEN
    v_mk := lower(trim(p_market));
    IF v_mk NOT IN ('bhutan', 'jaigaon', 'india') THEN
      RAISE EXCEPTION 'market must be bhutan, jaigaon, or india';
    END IF;
  END IF;

  IF p_link_status IS NOT NULL THEN
    v_st := lower(trim(p_link_status));
    IF v_st NOT IN ('invited', 'approved', 'suspended') THEN
      RAISE EXCEPTION 'link status must be invited, approved, or suspended';
    END IF;
  END IF;

  IF p_link_rate_tier IS NOT NULL THEN
    v_tier := trim(p_link_rate_tier);
  END IF;

  UPDATE public.agents a
  SET
    company_name = coalesce(nullif(trim(p_company_name), ''), a.company_name),
    market = coalesce(v_mk, a.market),
    contact_name = case when p_contact_name is null then a.contact_name else nullif(trim(p_contact_name), '') end,
    contact_phone = case when p_contact_phone is null then a.contact_phone else nullif(trim(p_contact_phone), '') end,
    contact_email = case when p_contact_email is null then a.contact_email else nullif(trim(lower(p_contact_email)), '') end,
    notes = case when p_notes is null then a.notes else nullif(trim(p_notes), '') end,
    commission_pct = coalesce(p_commission_pct, a.commission_pct)
  WHERE a.id = p_agent_id;

  UPDATE public.agent_property_links l
  SET
    status = coalesce(v_st, l.status),
    rate_tier = coalesce(v_tier, l.rate_tier),
    credit_limit = coalesce(p_credit_limit, l.credit_limit),
    credit_used = coalesce(p_credit_used, l.credit_used),
    open_room_cap = case when p_open_room_cap is null then l.open_room_cap else p_open_room_cap end,
    updated_at = now()
  WHERE l.property_id = p_property_id AND l.agent_id = p_agent_id;

  v_cached := jsonb_build_object('ok', true, 'agent_id', p_agent_id, 'replay', false);

  INSERT INTO public.money_idempotency (property_id, idempotency_key, action, result)
  VALUES (p_property_id, v_key, 'registry_update_agent_and_link', v_cached);

  RETURN v_cached;
END;
$$;

REVOKE ALL ON FUNCTION public.registry_update_agent_and_link(uuid, uuid, uuid, text, text, text, text, text, text, numeric, text, text, numeric, numeric, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.registry_update_agent_and_link(uuid, uuid, uuid, text, text, text, text, text, text, numeric, text, text, numeric, numeric, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Guides upsert (per property + guide_number unique)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.registry_upsert_guide(
  p_property_id uuid,
  p_idempotency_key uuid,
  p_guide_number text,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_discount_pct numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text := p_idempotency_key::text;
  v_cached jsonb;
  v_id uuid;
  v_num text := trim(p_guide_number);
  v_disc numeric;
BEGIN
  IF p_property_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'property_id and idempotency_key are required';
  END IF;
  IF v_num = '' THEN
    RAISE EXCEPTION 'guide_number is required';
  END IF;

  SELECT result INTO v_cached
  FROM public.money_idempotency
  WHERE property_id = p_property_id AND idempotency_key = v_key;
  IF FOUND THEN
    RETURN v_cached || jsonb_build_object('replay', true);
  END IF;

  PERFORM 1 FROM public.properties WHERE id = p_property_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'property not found';
  END IF;

  IF p_discount_pct IS NOT NULL THEN
    v_disc := p_discount_pct;
    IF v_disc < 0 OR v_disc > 100 THEN
      RAISE EXCEPTION 'discount_pct must be between 0 and 100';
    END IF;
  END IF;

  INSERT INTO public.guides (
    property_id,
    guide_number,
    full_name,
    phone,
    notes,
    discount_pct
  ) VALUES (
    p_property_id,
    v_num,
    nullif(trim(p_full_name), ''),
    nullif(trim(p_phone), ''),
    nullif(trim(p_notes), ''),
    coalesce(v_disc, 0)
  )
  ON CONFLICT (property_id, guide_number) DO UPDATE SET
    full_name = coalesce(nullif(trim(excluded.full_name), ''), guides.full_name),
    phone = case when excluded.phone is null then guides.phone else nullif(trim(excluded.phone), '') end,
    notes = case when excluded.notes is null then guides.notes else nullif(trim(excluded.notes), '') end,
    discount_pct = coalesce(v_disc, guides.discount_pct)
  RETURNING id INTO v_id;

  v_cached := jsonb_build_object('ok', true, 'guide_id', v_id, 'replay', false);

  INSERT INTO public.money_idempotency (property_id, idempotency_key, action, result)
  VALUES (p_property_id, v_key, 'registry_upsert_guide', v_cached);

  RETURN v_cached;
END;
$$;

REVOKE ALL ON FUNCTION public.registry_upsert_guide(uuid, uuid, text, text, text, text, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.registry_upsert_guide(uuid, uuid, text, text, text, text, numeric) TO service_role;

-- ---------------------------------------------------------------------------
-- Staff insert / update (HR row scoped to property)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.registry_insert_staff(
  p_property_id uuid,
  p_idempotency_key uuid,
  p_employee_code text,
  p_full_name text,
  p_role_label text,
  p_department text DEFAULT NULL,
  p_desk_role text DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_access_level text DEFAULT 'employee'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text := p_idempotency_key::text;
  v_cached jsonb;
  v_id uuid;
BEGIN
  IF p_property_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'property_id and idempotency_key are required';
  END IF;
  IF trim(coalesce(p_employee_code, '')) = '' OR trim(coalesce(p_full_name, '')) = '' OR trim(coalesce(p_role_label, '')) = '' THEN
    RAISE EXCEPTION 'employee_code, full_name, and role_label are required';
  END IF;

  SELECT result INTO v_cached
  FROM public.money_idempotency
  WHERE property_id = p_property_id AND idempotency_key = v_key;
  IF FOUND THEN
    RETURN v_cached || jsonb_build_object('replay', true);
  END IF;

  PERFORM 1 FROM public.properties WHERE id = p_property_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'property not found';
  END IF;

  INSERT INTO public.staff_members (
    property_id,
    employee_code,
    full_name,
    role_label,
    department,
    desk_role,
    status,
    phone,
    email,
    access_level
  ) VALUES (
    p_property_id,
    trim(p_employee_code),
    trim(p_full_name),
    trim(p_role_label),
    nullif(trim(p_department), ''),
    nullif(trim(p_desk_role), ''),
    trim(p_status),
    nullif(trim(p_phone), ''),
    nullif(trim(p_email), ''),
    coalesce(nullif(trim(p_access_level), ''), 'employee')
  )
  RETURNING id INTO v_id;

  v_cached := jsonb_build_object('ok', true, 'staff_id', v_id, 'replay', false);

  INSERT INTO public.money_idempotency (property_id, idempotency_key, action, result)
  VALUES (p_property_id, v_key, 'registry_insert_staff', v_cached);

  RETURN v_cached;
END;
$$;

REVOKE ALL ON FUNCTION public.registry_insert_staff(uuid, uuid, text, text, text, text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.registry_insert_staff(uuid, uuid, text, text, text, text, text, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.registry_update_staff(
  p_property_id uuid,
  p_idempotency_key uuid,
  p_staff_id uuid,
  p_full_name text DEFAULT NULL,
  p_role_label text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_desk_role text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_access_level text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text := p_idempotency_key::text;
  v_cached jsonb;
BEGIN
  IF p_property_id IS NULL OR p_idempotency_key IS NULL OR p_staff_id IS NULL THEN
    RAISE EXCEPTION 'property_id, idempotency_key, and staff_id are required';
  END IF;

  SELECT result INTO v_cached
  FROM public.money_idempotency
  WHERE property_id = p_property_id AND idempotency_key = v_key;
  IF FOUND THEN
    RETURN v_cached || jsonb_build_object('replay', true);
  END IF;

  PERFORM 1 FROM public.staff_members
  WHERE id = p_staff_id AND property_id = p_property_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'staff row not found for property';
  END IF;

  UPDATE public.staff_members sm
  SET
    full_name = coalesce(nullif(trim(p_full_name), ''), sm.full_name),
    role_label = coalesce(nullif(trim(p_role_label), ''), sm.role_label),
    department = case when p_department is null then sm.department else nullif(trim(p_department), '') end,
    desk_role = case when p_desk_role is null then sm.desk_role else nullif(trim(p_desk_role), '') end,
    status = coalesce(nullif(trim(p_status), ''), sm.status),
    phone = case when p_phone is null then sm.phone else nullif(trim(p_phone), '') end,
    email = case when p_email is null then sm.email else nullif(trim(p_email), '') end,
    access_level = coalesce(nullif(trim(p_access_level), ''), sm.access_level),
    updated_at = now()
  WHERE sm.id = p_staff_id AND sm.property_id = p_property_id;

  v_cached := jsonb_build_object('ok', true, 'staff_id', p_staff_id, 'replay', false);

  INSERT INTO public.money_idempotency (property_id, idempotency_key, action, result)
  VALUES (p_property_id, v_key, 'registry_update_staff', v_cached);

  RETURN v_cached;
END;
$$;

REVOKE ALL ON FUNCTION public.registry_update_staff(uuid, uuid, uuid, text, text, text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.registry_update_staff(uuid, uuid, uuid, text, text, text, text, text, text, text, text) TO service_role;
