import { test } from "node:test";
import assert from "node:assert/strict";
import { requestWithArchivedAcknowledgement } from "../src/services/archived-foods.js";
const archived = () => Object.assign(new Error("Aviso"), { code: "ARCHIVED_FOOD_ACKNOWLEDGEMENT_REQUIRED", fields: { archivedFoodIds: "2,3", archivedFoodNames: "Avena, Pollo" } });
test("archived reuse retries once with explicit acknowledgement and preserves the payload", async () => {
  const calls = []; const request = async (_path, options) => { calls.push(options); if (calls.length === 1) throw archived(); return { id: 4 }; };
  assert.deepEqual(await requestWithArchivedAcknowledgement(request, async () => true, () => 1, "/api/recipes", { method: "POST", body: JSON.stringify({ name: "Comida" }) }), { id: 4 });
  assert.deepEqual(JSON.parse(calls[1].body), { name: "Comida", acknowledgedArchivedFoodIds: [2, 3] });
});
test("cancel and session changes never repeat the rejected write", async () => {
  for (const changed of [false, true]) {
    let calls = 0, user = 1;
    await assert.rejects(requestWithArchivedAcknowledgement(async () => { calls++; throw archived(); }, async () => { if (changed) user = 2; return changed; }, () => user, "/api/logs", { method: "POST" }), error => error.cancelled);
    assert.equal(calls, 1);
  }
});
test("unrelated conflicts are not retried or presented as archived reuse", async () => {
  await assert.rejects(requestWithArchivedAcknowledgement(async () => { throw Object.assign(new Error("Conflicto"), { code: "VERSION_CONFLICT" }); }, async () => { assert.fail("unexpected confirmation"); }, () => 1, "/api/logs", { method: "POST" }), /Conflicto/);
});
