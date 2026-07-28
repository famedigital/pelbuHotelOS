"use client";

import type { FastBookAgent } from "./FastBookForm";

type Props = {
  agents: FastBookAgent[];
  pending: boolean;
  open: boolean;
  onClose: () => void;
  hasQty: boolean;
};

function fieldClassName() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20";
}

export function FastBookDrawer({
  agents,
  pending,
  open,
  onClose,
  hasQty,
}: Props) {
  return (
    <aside
      aria-label="Booking details"
      aria-hidden={!open}
      className={[
        // Mobile: bottom sheet
        "fixed inset-x-0 bottom-0 z-30 max-h-[80vh] overflow-y-auto border-t border-espresso/15 bg-ivory shadow-[0_-8px_24px_rgba(28,22,18,0.12)] transition-transform duration-200",
        // Desktop: right rail ~360px
        "md:static md:inset-auto md:z-auto md:max-h-none md:w-[360px] md:flex-shrink-0 md:self-start md:overflow-visible md:rounded-sm md:border md:border-espresso/10 md:bg-white md:shadow-none",
        open ? "translate-y-0" : "translate-y-full md:translate-y-0 md:hidden",
      ].join(" ")}
    >
      <div className="sticky top-0 flex items-center justify-between border-b border-espresso/10 bg-inherit px-5 py-3 md:hidden">
        <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Booking details
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-espresso/15 text-espresso hover:bg-espresso/[0.04]"
        >
          ✕
        </button>
      </div>

      <div className="space-y-6 px-5 py-5 md:px-6 md:py-6">
        {!hasQty ? (
          <p className="border border-gold/40 bg-gold/5 px-3 py-2 text-xs text-espresso">
            Pick a room above to enable saving.
          </p>
        ) : null}

        <fieldset className="space-y-3" disabled={pending}>
          <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
            Guest contact
          </legend>
          <label className="block text-sm text-espresso">
            Guest / lead name
            <input
              type="text"
              name="contact_name"
              required
              autoComplete="off"
              className={fieldClassName()}
            />
          </label>
          <div className="grid grid-cols-1 gap-3">
            <label className="block text-sm text-espresso">
              Phone
              <input
                type="tel"
                name="contact_phone"
                required
                inputMode="tel"
                className={fieldClassName()}
              />
            </label>
            <label className="block text-sm text-espresso">
              Email
              <input
                type="email"
                name="contact_email"
                inputMode="email"
                className={fieldClassName()}
              />
            </label>
          </div>
          <label className="block text-sm text-espresso">
            Notes
            <textarea name="notes" rows={2} className={fieldClassName()} />
          </label>
        </fieldset>

        <fieldset className="space-y-3" disabled={pending}>
          <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
            Booked by
          </legend>
          <div className="grid grid-cols-1 gap-3">
            <label className="block text-sm text-espresso">
              Role
              <select
                name="source"
                required
                defaultValue="reservation"
                className={fieldClassName()}
              >
                <option value="owner">Owner</option>
                <option value="reservation">Reservation</option>
                <option value="agent">Agent</option>
                <option value="mou_agent">MoU agent</option>
              </select>
            </label>
            <label className="block text-sm text-espresso">
              Guest origin
              <select
                name="guest_origin"
                required
                defaultValue="international"
                className={fieldClassName()}
              >
                <option value="international">International tourist</option>
                <option value="regional">Regional (Indian / etc.)</option>
                <option value="official">Official / diplomatic</option>
                <option value="local">Local (Bhutanese)</option>
              </select>
              <span className="mt-1 block text-[11px] text-muted">
                Drives whether a guide is required.
              </span>
            </label>
            <label className="block text-sm text-espresso">
              Agent
              <select name="agent_id" className={fieldClassName()} defaultValue="">
                <option value="">— Walk-in / none —</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.company_name} ({a.market}
                    {a.status === "demo" ? ", demo" : ""})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-espresso">
              Guide number
              <input
                type="text"
                name="guide_number"
                placeholder="Required for international tourists"
                className={fieldClassName()}
              />
              <span className="mt-1 block text-[11px] text-muted">
                Required for international tourists only.
              </span>
            </label>
            <label className="block text-sm text-espresso">
              Payment
              <select name="payment_mode" defaultValue="cash" className={fieldClassName()}>
                <option value="cash">Cash</option>
                <option value="prepaid">Prepaid</option>
                <option value="partial">Partial</option>
                <option value="on_credit">On credit</option>
              </select>
            </label>
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={pending || !hasQty}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-espresso px-6 text-sm font-medium text-ivory transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save booking"}
        </button>
      </div>
    </aside>
  );
}
