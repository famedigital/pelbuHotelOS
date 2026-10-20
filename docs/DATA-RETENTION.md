# Money history retention

Settled folio lines and payments older than **36 months** (default) can move to archive tables without dropping tenant isolation.

## Tables

- `folio_line_archives` — cold folio lines from closed/settled folios
- `payment_archives` — cold payments tied to those folios (or orphan settled)

Live desk queries keep using `folio_lines` / `payments`. Archives are service-role only (same pattern as other money tables).

## Operator run (per property)

```sql
select public.archive_settled_money_history('<property_uuid>', 36);
```

Returns JSON with cutoff date and counts moved. Minimum window enforced in SQL is 12 months.

## Related

- Night audit remains idempotent per `(property_id, business_date)`.
- Desk money actions fence with `assertDeskProperty` + `property_id` filters.
- Health probe: `GET /api/health` (app + optional DB ping) for Coolify/DR cutover checks.
