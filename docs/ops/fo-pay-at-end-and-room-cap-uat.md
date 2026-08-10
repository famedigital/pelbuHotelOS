# FO soft pay-at-end + agent room-cap — train / UAT

**Audience:** Front desk + Owner  
**Related:** [FO hang-card](fo-ezee-to-pelbu-hang-card.md) · [FO-AGENT-COMMERCE-CHECKLIST](../FO-AGENT-COMMERCE-CHECKLIST.md)

---

## Soft pay-at-end (local guests)

Most Olakha locals settle **on leave**, not on confirm.

1. Book / walk-in with soft confirm (no deposit required by system).  
2. Check-in opens folio (day-1 room may post per Settings).  
3. During stay: F&B posts to folio.  
4. Checkout with open Due → StayHub primary is **Collect payment first** → Folio Collect.  
5. When Due clear → Checkout leave.

### Soft 30% (international / agent paper)

System may show **advance / soft 30% badges** when policy set — **not a hard wall**.  
Staff may still keep soft book and collect paper 30% outside; post deposit payment when cash hits.

### UAT ticks

- [ ] 3 local stays: pay only at Checkout Collect  
- [ ] Footer on Checkout with Due = “Collect payment first”  
- [ ] QR/bank/cash all post and zero Due  

---

## Agent open-room cap

Primary agent control is **concurrent open rooms**, not Nu 50k.

| Place | What to do |
|-------|------------|
| Agents → agent dossier | `open_room_cap` (default 15) |
| Check-in | Blocks when agent open rooms ≥ cap |
| Override | Manager tick + note on CI form |

### UAT ticks

- [ ] Agent at cap fails second party CI without override  
- [ ] Override with note succeeds and audits  
- [ ] Dossier shows open rooms / cap  

---

## Guide settlement pack (agent leave)

1. Print pack → ink signature  
2. Camera **or** file upload → status photo / waived  
3. Guests leave when evidence ok  
4. Seal + email agent; dossier Money tab shows pack  

### UAT ticks

- [ ] One live agent CO with photo  
- [ ] Email agent after seal  
- [ ] Dossier lists pack open link  
