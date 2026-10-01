function cancelled() {
  return Object.assign(new Error("Operación cancelada."), { code: "ACTION_CANCELLED", cancelled: true });
}

export async function requestWithArchivedAcknowledgement(request, confirm, getUserId, path, options = {}) {
  const userId = getUserId();
  try { return await request(path, options); }
  catch (error) {
    if (error.code !== "ARCHIVED_FOOD_ACKNOWLEDGEMENT_REQUIRED" || !["POST", "PUT", "PATCH"].includes(options.method?.toUpperCase())) throw error;
    const ids = String(error.fields?.archivedFoodIds || "").split(",").map(Number).filter(id => Number.isInteger(id) && id > 0);
    if (!ids.length || (options.body != null && typeof options.body !== "string")) throw error;
    let body;
    try { body = options.body ? JSON.parse(options.body) : {}; } catch { throw error; }
    const accepted = await confirm({ title: "Hay alimentos archivados", description: `${error.fields?.archivedFoodNames || "Estos alimentos"}. Podés reutilizarlos con este aviso. Seguirán archivados y se conservará su historial.`, confirmLabel: "Reutilizar con aviso", tone: "neutral" });
    if (!accepted || userId !== getUserId()) throw cancelled();
    return request(path, { ...options, body: JSON.stringify({ ...body, acknowledgedArchivedFoodIds: [...new Set([...(body.acknowledgedArchivedFoodIds || []), ...ids])] }) });
  }
}
