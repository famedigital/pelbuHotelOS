# Handoff brief for z.ai

Paste this into a **new chat** with model `GLM-*` (z.ai). Attach `@AGENTS.md` and `@.cursor/rules/zai-implementer.mdc`.

## Task
<!-- one sentence -->

## Goal
<!-- user-visible outcome -->

## Allowed files
-

## Do not touch
- `supabase/migrations/**`
- Auth / RLS / payments / credit / POS core
- `.env*`

## Patterns to copy
- Forms: `web/src/components/book/BookingForm.tsx`, `web/src/components/order/OrderForm.tsx`
- Actions: `web/src/app/actions/`
- Shell: `web/src/components/site/ConversionShell.tsx`
- Tokens: `web/src/app/globals.css`

## Acceptance checks
- [ ] `npm run build` in `web/` passes
- [ ] No secrets committed
- [ ] Matches brand tokens (ivory/espresso/maroon/gold)
- [ ] Brief “what changed / how to test”

## Done means
Cursor reviews the diff; z.ai does not merge or push unless asked.
