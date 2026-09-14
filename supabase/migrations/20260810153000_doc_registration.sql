-- Guest arrival registration card design (logo/header/footer + house policies).

alter table public.properties
  add column if not exists doc_registration jsonb not null default '{
    "preset": "classic",
    "brand_color": "#0c4a6e",
    "accent_color": "#0ea5e9",
    "header_text": "Guest arrival registration",
    "title": "Guest registration card",
    "intro_text": "Please verify all details carefully and sign below. This hotel copy is kept with your folio for the stay.",
    "policies_text": "• Standard check-in 14:00 · check-out 12:00 (or as agreed on the booking).\n• Valid photo ID (CID / passport) required for every adult on the room.\n• Room key cards remain hotel property; lost keys may be charged.\n• Settlements: room, F&B, minibar, laundry and guest services are charged to the guest folio unless charged to an approved agent.\n• Damages, missing items and excessive cleaning are posted to the folio at replacement cost.\n• Early check-in / late check-out is subject to availability and may attract a half- or full-day charge.\n• Valuables: use the in-room safe; the hotel is not liable for unsecured items.\n• Fire safety: locate exits; do not block corridors or stairwells.",
    "dos_text": "• Keep noise respectful after 22:00.\n• Smoke only in designated outdoor areas.\n• Report maintenance or security concerns to reception immediately.\n• Wear appropriate attire in shared spaces and restaurant.\n• Register all accompanying guests and vehicles at the desk.\n• Carry your room key and ID when leaving the property.",
    "donts_text": "• No smoking, incense or open flame in guest rooms or balconies.\n• No cooking / high-power appliances not issued by the hotel.\n• No illicit substances; weapons are not permitted on the property.\n• Do not re-assign or share rooms without informing reception.\n• Do not hang laundry or drapery over balconies or indoor heaters.\n• Do not leave children unattended in public areas or pools.",
    "terms_text": "I confirm that the particulars above are true and that I have read the house policies and guests’ dos & don’ts. I (or my sponsoring agent) accept liability for all charges incurred by my party during the stay.",
    "footer_text": "Pelbu Suites · Olakha, Thimphu · Guest registration · Hotel copy",
    "show_phone": true,
    "show_email": true,
    "show_tax_id": false,
    "show_address": true,
    "show_logo": true,
    "paper_size": "a4"
  }'::jsonb;

comment on column public.properties.doc_registration is
  'Printable guest arrival registration card design + house policies for FO print.';
