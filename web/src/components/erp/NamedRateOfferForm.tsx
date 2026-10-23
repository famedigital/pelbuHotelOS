"use client";

import { addNamedRateOffer, type ErpRatesState } from "@/app/actions/erp-rates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";

const initial: ErpRatesState = { ok: false };

export function NamedRateOfferForm({
  roomTypes,
  agents,
}: {
  roomTypes: { id: string; name: string }[];
  agents: { id: string; company_name: string }[];
}) {
  const [state, action, pending] = useActionState(addNamedRateOffer, initial);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1">
        <Label htmlFor="offer_label">Name</Label>
        <select
          id="offer_label"
          name="label"
          className="h-11 w-full rounded-md border bg-background px-2 text-sm"
          defaultValue="Fill-up"
        >
          <option>Contract</option>
          <option>Fill-up</option>
          <option>Festival</option>
          <option>Personal</option>
          <option>Standard</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="offer_tier">Who</Label>
        <select
          id="offer_tier"
          name="rate_tier"
          className="h-11 w-full rounded-md border bg-background px-2 text-sm"
          defaultValue="agents"
        >
          <option value="public">Public</option>
          <option value="agents">Agents</option>
          <option value="mou_agents">Contract agents</option>
          <option value="friends">Friends</option>
          <option value="family">Family</option>
          <option value="mutual_friends">Mutual</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="offer_agent">Agent</Label>
        <select
          id="offer_agent"
          name="agent_id"
          className="h-11 w-full rounded-md border bg-background px-2 text-sm"
          defaultValue=""
        >
          <option value="">All in this tier</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.company_name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="offer_guest">Guest name</Label>
        <Input id="offer_guest" name="guest_label" placeholder="Optional" className="h-11" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="offer_room">Room type</Label>
        <select
          id="offer_room"
          name="room_type_id"
          required
          className="h-11 w-full rounded-md border bg-background px-2 text-sm"
        >
          {roomTypes.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="offer_season">Season</Label>
        <select
          id="offer_season"
          name="season_kind"
          className="h-11 w-full rounded-md border bg-background px-2 text-sm"
          defaultValue="lean"
        >
          <option value="peak">Peak</option>
          <option value="lean">Lean</option>
          <option value="off">Off</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="offer_double">Double Nu</Label>
        <Input id="offer_double" name="amount_btn" inputMode="decimal" required className="h-11" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="offer_single">Single Nu</Label>
        <Input id="offer_single" name="amount_single_btn" inputMode="decimal" className="h-11" />
      </div>
      <div className="flex items-end sm:col-span-2 lg:col-span-4">
        <Button type="submit" disabled={pending} className="h-11">
          {pending ? "Saving…" : "Add to rate book"}
        </Button>
        {state.error ? (
          <p className="ml-3 text-sm text-destructive">{state.error}</p>
        ) : state.message ? (
          <p className="ml-3 text-sm text-muted-foreground">{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
