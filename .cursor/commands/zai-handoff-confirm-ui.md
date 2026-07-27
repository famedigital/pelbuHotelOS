# Handoff brief for z.ai — confirmation UI polish

Paste into a **new chat** with model `GLM-5.2`. Attach `@AGENTS.md` and `@.cursor/rules/zai-implementer.mdc`.

## Task
Polish Book and Order success screens so guests clearly understand the desk was notified and what happens next.

## Goal
Stronger post-submit confidence without changing server actions or notify logic.

## Allowed files
- `web/src/components/book/BookingForm.tsx` (success block only)
- `web/src/components/order/OrderForm.tsx` (success block only)

## Do not touch
- `web/src/app/actions/**`
- `web/src/lib/notify.ts`
- `supabase/**`
- `.env*`

## Patterns to copy
- Brand tokens: ivory / espresso / maroon / gold in `web/src/app/globals.css`
- Existing success layout already in those two files

## Acceptance checks
- [ ] Keep reference ID visible and copy-friendly
- [ ] Mention desk alert + next step (confirm stay / prepare order)
- [ ] Mobile readable; no new card clutter / purple defaults
- [ ] `npm run build` in `web/` passes
- [ ] Brief “what changed / how to test”

## Done means
Cursor reviews the diff; do not merge or push unless asked.
