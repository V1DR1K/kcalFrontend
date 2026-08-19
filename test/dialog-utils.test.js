import test from "node:test";
import assert from "node:assert/strict";
import { createDialogIds } from "../src/components/dialog/dialog.utils.js";

test("crea referencias ARIA independientes para cada diálogo", () => {
  assert.deepEqual(createDialogIds("dialog-7", { description: true }), {
    titleId: "dialog-7-title",
    descriptionId: "dialog-7-description",
  });
});

test("permite diálogos sin descripción", () => {
  assert.deepEqual(createDialogIds("dialog-8"), {
    titleId: "dialog-8-title",
    descriptionId: undefined,
  });
});
