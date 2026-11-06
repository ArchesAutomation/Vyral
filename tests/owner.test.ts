import test from "node:test";
import assert from "node:assert/strict";
import { validOwnerPassword, validOwnerUsername } from "../lib/owner.ts";
test("owner login uses the requested name and accepts 8–200 character passwords", () => {
  assert.equal(validOwnerUsername("Nick"), true);
  for (const value of [null, undefined, "", "Other", "nick"]) assert.equal(validOwnerUsername(value), false);
  assert.equal(validOwnerPassword("qa-test1"), true);
  assert.equal(validOwnerPassword("x".repeat(200)), true);
  for (const value of [null, undefined, "short", "x".repeat(201)]) assert.equal(validOwnerPassword(value), false);
});
