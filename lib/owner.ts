// This is one owner's studio, not a multi-user account system.
export const DEFAULT_OWNER_USERNAME = "Nick";
export function validOwnerUsername(value: unknown, expected = DEFAULT_OWNER_USERNAME) {
  return typeof value === "string" && value === expected;
}
export function validOwnerPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 200;
}
