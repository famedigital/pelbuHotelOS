# Module pack template

Copy this folder pattern:

```
modules/Mnn-slug/
  01-requirement.md
  02-design.md
  03-implement-notes.md
  04-test-evidence.md
  05-production.md
```

Mark status at the top of each file: `DRAFT` · `READY_FOR_IMPLEMENT` · `IN_PROGRESS` · `DONE`.

---

## 01-requirement.md checklist

- [ ] Module ID, name, layer (L0–L3)
- [ ] Actors / roles
- [ ] User stories (Given/When/Then or numbered)
- [ ] In scope / out of scope
- [ ] Entities owned (names)
- [ ] Commands / queries exposed
- [ ] Privacy / never-leak list
- [ ] Edge cases & failure modes
- [ ] Acceptance criteria (testable bullets)
- [ ] Dependencies (other modules)

## 02-design.md checklist

- [ ] Tables: columns, types, nulls, FKs
- [ ] Indexes (exact SQL names)
- [ ] RLS / app asserts
- [ ] Zod / TypeScript contracts
- [ ] UI routes + every control + empty/loading/error/success
- [ ] Sequence diagrams (happy + deny)
- [ ] Idempotency (if money/hold)
- [ ] Migration file name
- [ ] Unit test names (write before code)
- [ ] Integration / e2e cases for this module only

## 03-implement-notes.md (fill during I)

- Files touched, migration applied locally, deviations from design (must be justified)

## 04-test-evidence.md (fill during T)

- Commands run, pass/fail counts, report paths — no invented greens

## 05-production.md (fill during P)

- Droplet migrate, Coolify deploy id/time, smoke URL, rollback note
