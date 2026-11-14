# Travel Agent OS — documentation home

**Status:** Documentation gate (no full product coding until module R+D packs are approved).  
**Master plan:** [file:///C:/Users/rajiv/.cursor/plans/travel_agent_os_vision_4b498dfd.plan.md](file:///C:/Users/rajiv/.cursor/plans/travel_agent_os_vision_4b498dfd.plan.md)  
**ADR:** [`../adr/002-travel-agent-os.md`](../adr/002-travel-agent-os.md)  
**Catalog:** [`CATALOG.md`](./CATALOG.md)  
**Pack template:** [`MODULE-PACK-TEMPLATE.md`](./MODULE-PACK-TEMPLATE.md)

## What this is

Innora **Travel Agent OS** is the agency-side product: trips, guides, drivers, budget/margin, docs, privacy-tier shares. It plugs into **Hotel OS** for rooms/holds/folios. Guide and Driver companions consume assignments. Public site opens the four doors.

## Build doctrine (short)

Every module finishes **Requirement → Design → Implement → Test → Production** before the next organ starts. Then wire layers upward:

`Atom → Cell → Molecule → Organ → Tissue → Organism → Community → Society → Country (Hotel OS) → Network`

See plan file §3 for the full layer map. **Do not** implement UI for M12 before M01–M02 R+D exist and M01–M05 are not still inventing schema.

## Module packs

| ID | Pack folder | R+D ready? |
|----|-------------|------------|
| M01 | [`modules/M01-agency-org/`](./modules/M01-agency-org/) | Yes (this drop) |
| M02 | [`modules/M02-share-projector/`](./modules/M02-share-projector/) | Yes (this drop) |
| M03–M12 | Create from template when prior module hits Production | No |

## Stale docs

[`../AGENT-PORTAL.md`](../AGENT-PORTAL.md) describes an older Partner tab model and aspirational Supabase RLS. Prefer this tree + ADR 002 until AGENT-PORTAL is rewritten as an index pointing here.

## AI coding unlock

An implementer may start **Implement** for module `Mn` only when:

1. `01-requirement.md` and `02-design.md` exist and are marked **Ready for implement**
2. Dependencies in CATALOG are Production or at least Design-complete where noted
3. Human said **implement Mn** (not “build everything”)
