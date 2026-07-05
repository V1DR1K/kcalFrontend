export function buildCatalogQuery({ page, pageSize, query = "", category = "" }) {
  const params = new URLSearchParams({ page: String(Math.max(0, page)), size: String(pageSize) });
  if (query.trim()) params.set("q", query.trim());
  if (category) params.set("category", category);
  return params.toString();
}

export function mergeCatalogItems(current, incoming, replace = false) {
  const merged = replace ? incoming : [...current, ...incoming];
  return [...new Map(merged.map((item) => [item.id, item])).values()];
}
