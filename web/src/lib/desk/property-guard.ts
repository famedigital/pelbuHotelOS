/**
 * Fail closed when a loaded row's property_id does not match the active desk property.
 * Primary fence while desk still uses the service-role admin client for writes.
 */
export function assertDeskProperty(
  expectedPropertyId: string,
  rowPropertyId: string | null | undefined,
  entityLabel = "Record",
): void {
  const expected = expectedPropertyId?.trim();
  const actual = rowPropertyId?.trim();
  if (!expected) {
    throw new Error("Active property is not resolved.");
  }
  if (!actual || actual !== expected) {
    throw new Error(`${entityLabel} is not in the active property.`);
  }
}
