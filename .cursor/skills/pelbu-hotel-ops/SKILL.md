---
name: pelbu-hotel-ops
description: >-
  Bhutan hotel operations for Pelbu Suites. Use when building booking, check-in,
  folio, GST, agent credit, guide/driver beds, POS/KOT, or rates.
---

# Pelbu hotel ops

## Fast booking

One screen: dates → rooms → pax → agent → **guide no** → guest/guide/driver beds → save.
Actors: owner, reservation, agent, mou_agent, client.

## Check-in

1. Find booking 2. Mandatory guide number 3. SDF guest docs 4. Driver details
5. Assign guest + guide/driver beds 6. Folio credit vs cash 7. Confirm

## Inventory types

`sellable_guest` | `guide_comp` | `driver_comp` | `staff`

Comp beds must not distort ADR reports.

## Rates

Seasons: peak | lean | off  
Tiers: public | friends | family | mutual_friends | agents | mou_agents

## Agents

Markets: bhutan | jaigaon | india  
Credit limit + payment history; signup needs license, phone verify, owner approve. Demo accounts allowed.

## Folio / GST

Room folio + F&B + spa + guest services (taxi/shop). Per-line `gst_applicable`.
