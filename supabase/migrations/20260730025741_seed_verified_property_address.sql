-- This location is consistently identified by the owned site and public
-- listings. Phone/email/WhatsApp remain unset until the Pelbu brand verifies
-- them; a Seven Suites directory number must not be silently reused.
update properties
set address = coalesce(nullif(trim(address), ''), 'Olakha, Thimphu, Bhutan')
where slug = 'pelbu-suites-olakha';
