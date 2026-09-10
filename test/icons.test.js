import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(absolute) : /\.(jsx|js)$/.test(entry.name) ? [absolute] : [];
  });
}

test("todos los Icon name estaticos existen en el mapa", () => {
  const iconSource = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src/components/Icon.jsx"), "utf8");
  const defined = new Set([...iconSource.matchAll(/^  ([a-z0-9_]+):/gm)].map((match) => match[1]));
  const used = sourceFiles(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src")).flatMap((file) => [...fs.readFileSync(file, "utf8").matchAll(/Icon name="([a-z0-9_]+)"/g)].map((match) => match[1]));
  assert.deepEqual(used.filter((name) => !defined.has(name)), []);
  assert.equal(defined.has("bookmark"), true);
  assert.equal(defined.has("visibility"), true);
  assert.equal(defined.has("swap_vert"), true);
});
