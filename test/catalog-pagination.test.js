import test from "node:test";
import assert from "node:assert/strict";
import { buildCatalogQuery, mergeCatalogItems } from "../src/features/catalog/pagination.js";

test("builds bounded catalog query parameters", () => {
  assert.equal(buildCatalogQuery({ page: -1, pageSize: 20, query: "  arroz  ", category: "CEREAL" }), "page=0&size=20&q=arroz&category=CEREAL");
});

test("merges pages without duplicate ids", () => {
  assert.deepEqual(mergeCatalogItems([{ id: 1 }, { id: 2, name: "old" }], [{ id: 2, name: "new" }, { id: 3 }]), [{ id: 1 }, { id: 2, name: "new" }, { id: 3 }]);
});
