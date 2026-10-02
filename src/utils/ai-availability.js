export function aiAvailability(usage, now = Date.now()) {
  if (!usage) return { canCapture:false, headline:"No pudimos consultar la disponibilidad de IA.", detail:"Podés registrar alimentos manualmente." };
  if (!usage.available) return { canCapture:false, headline:"La estimación por foto no está disponible.", detail:"Podés buscar y registrar alimentos manualmente." };
  const blocked = usage.blockedUntil && new Date(usage.blockedUntil).getTime() > now;
  const remaining = Number(usage.dailyLimit) > 0 ? Math.max(0, Number(usage.dailyLimit) - Number(usage.used || 0)) : null;
  if (blocked) return { canCapture:false, headline:"La IA agotó su cuota temporal.", detail:`Probá nuevamente desde ${new Intl.DateTimeFormat("es-AR", {hour:"2-digit",minute:"2-digit",day:"2-digit",month:"short"}).format(new Date(usage.blockedUntil))}. Podés registrar manualmente.` };
  if (remaining === 0) return { canCapture:false, headline:"Agotaste las estimaciones disponibles hoy.", detail:"Podés registrar alimentos manualmente." };
  return { canCapture:true, headline:remaining == null ? "Estimación por foto disponible" : `${remaining} estimaciones disponibles hoy`, detail:"Vas a revisar el resultado antes de guardarlo." };
}
