-- Room lines record whether the posted amount is already net of GST.
-- inclusive: quoted rate still includes GST (strip 5% once when posting).
-- net: comment or prior calc already removed GST (do not strip again).

alter table folio_lines
  add column if not exists tax_treatment text;

alter table folio_lines
  drop constraint if exists folio_lines_tax_treatment_check;

alter table folio_lines
  add constraint folio_lines_tax_treatment_check
  check (tax_treatment is null or tax_treatment = any (array['inclusive'::text, 'net'::text]));

comment on column folio_lines.tax_treatment is
  'inclusive = quoted rate includes GST; net = amount is already GST-removed. Print the stored line; do not strip 5% again.';
