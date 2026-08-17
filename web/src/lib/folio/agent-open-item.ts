/** Walk-in F&B billed to a travel agent with no room stay (POS open item). */
export function isAgentOpenItemFolio(folio: {
  agent_id?: string | null;
  booking_id?: string | null;
}): boolean {
  return Boolean(folio.agent_id) && !folio.booking_id;
}
