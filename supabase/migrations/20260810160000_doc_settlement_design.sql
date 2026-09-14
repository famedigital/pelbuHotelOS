-- Agent settlement / checkout pack design (editable from ERP documents).

alter table public.properties
  add column if not exists doc_settlement jsonb not null default '{
    "preset": "classic",
    "brand_color": "#0c4a6e",
    "accent_color": "#0ea5e9",
    "title": "Checkout · agent settlement",
    "header_text": "Guide signs in ink at desk",
    "intro_text": "Live folio snapshot for guide acknowledgment before guests leave. Seal & email the agent after departure.",
    "notes_text": "• Not a fiscal tax invoice — GST INV is issued from the folio only.\\n• Amounts may change if desk posts further charges before seal.\\n• After ink sign: camera / scan on StayHub Checkout, then seal & email agent.\\n• Agent AR lines appear under “On agent AR / package”.",
    "terms_text": "I confirm the stay dates, guest name, and folio amounts shown (including any agent AR) and accept settlement under our commercial terms with the hotel.",
    "footer_text": "Pelbu Suites · Olakha, Thimphu · Desk evidence · not a room voucher",
    "show_phone": true,
    "show_email": true,
    "show_tax_id": true,
    "show_address": true,
    "show_logo": true,
    "paper_size": "a4"
  }'::jsonb;

comment on column public.properties.doc_settlement is
  'Agent settlement / checkout guide-sign pack print design (StayHub Checkout).';
