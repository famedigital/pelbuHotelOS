/**
 * Hotel desk PIN pad must never treat department PINs as field-portal shortcuts.
 * FO default is 1111; partner demo historically used the same digits and hijacked unlock.
 */
export type FieldPinShortcut = {
  pin: string;
  route: string;
};

export function resolveHotelPinPadTarget(input: {
  /** True after hotel email/code gate — PinGateway always runs in this mode. */
  hotelGateActive: boolean;
  pin: string;
  fieldShortcuts: ReadonlyArray<FieldPinShortcut>;
}): "desk" | { kind: "field"; route: string } {
  if (input.hotelGateActive) return "desk";
  const hit = input.fieldShortcuts.find((s) => s.pin === input.pin);
  if (hit) return { kind: "field", route: hit.route };
  return "desk";
}
