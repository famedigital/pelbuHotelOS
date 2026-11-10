-- Allow v2_app to resolve multi-hotel agent email login against public.agents.
GRANT SELECT ON TABLE public.agents TO v2_app;
DO $$
BEGIN
  IF to_regclass('public.agent_property_links') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.agent_property_links TO v2_app;
  END IF;
  IF to_regclass('public.agent_mou_links') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.agent_mou_links TO v2_app;
  END IF;
END $$;
