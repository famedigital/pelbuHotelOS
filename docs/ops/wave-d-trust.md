# Trust wave (D) — Pay.bt, agent AR void, support

**Audience:** Owner / GM  
**Scope:** Why eZee still “feels safer” — close with merchant + process, not code only.

---

## Pay.bt / bank QR

| Status | Action |
|--------|--------|
| Desk-confirm path | Live today — FO posts bank_qr / pay_bt with proof when guest paid offline |
| Live webhook | Turn on when merchant credentials ready (`PAYBT_*` / bank HMAC on `/api/payments/webhook`) |
| UAT | Process one real Pay.bt / mBoB deposit through desk confirm → wallet/ledger matches |

Do **not** force guest auto-capture until merchant ID is production.

---

## Agent credit void integrity

| Step | Accept |
|------|--------|
| Charge agent AR on Folio Collect | Guest due drops; `agents.credit_used` up; ledger `charge` row |
| Void from Agent dossier → Money → payment row | **Void AR** with reason |
| After void | Payment gone, ledger `adjustment` reduces used, guest due restored if folio line rolled back |
| Audit | `payment.void_agent_credit` + ledger note |

Run once live or sandbox; tick Finance UAT residual.

---

## Support SLA (business moat)

eZee advertises 24×7. Olakha model:

| Window | Who answers | Channel |
|--------|-------------|---------|
| 07:00–22:00 FO | Duty FO + this runbook | Desk + CallMeBot staff |
| 22:00–07:00 | Owner WhatsApp rota | CallMeBot phone + Owner |
| Critical NA / payment fail | Owner | See [OPS-RUNBOOK](../OPS-RUNBOOK.md) Support |

Set names on paper next to hang-card. Code does not replace people.

---

## SEC-01 residual

Staff-scoped Supabase clients — finish per [ERP-AUDIT](../ERP-AUDIT.md) when free (not launch blocker).

## GST e-invoice

Stub until DRC mandates — [GST-EINVOICE](../GST-EINVOICE.md).
