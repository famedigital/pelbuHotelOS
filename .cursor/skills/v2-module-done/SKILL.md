---
name: v2-module-done
description: >-
  Eight-point done gate for Hotel OS v2 modules. Use before declaring any
  v2 module or wave complete.
---

# v2 module-done gate

A module is **not done** until all apply:

1. Write flows (commands)
2. Permission keys
3. Audit entries
4. Emits + handles events from `docs/v2/MODULES.md`
5. Live updates
6. Tablet/phone layout
7. Domain tests on money paths (if money)
8. Journey segment in `docs/v2/OPERATIONS-FLOW.md` passes

**Reject:** route + title + placeholder/mock table; read-only when MODULES lists writes; TODO on money/inventory.
