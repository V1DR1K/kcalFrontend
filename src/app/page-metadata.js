const PAGE_METADATA = [
  { mode: "nutrition", page: "dashboard", path: "/nutricion/dia", title: "Día", nav: { group: "nutrition", order: 0, id: "dashboard", label: "Día", mobileLabel: "Día", icon: "monitoring", primary: true, mobilePrimary: true } },
  { mode: "nutrition", page: "scanner", path: "/nutricion/registrar", title: "Registrar", nav: { group: "nutrition", order: 3, id: "scanner", label: "Registrar", mobileLabel: "Registrar", icon: "qr_code_scanner", primary: true, mobilePrimary: true } },
  { mode: "nutrition", page: "my-foods", path: "/nutricion/alimentos", title: "Alimentos", activeNavId: "scanner" },
  { mode: "nutrition", page: "recipes", path: "/nutricion/recetas", title: "Recetas", activeNavId: "scanner" },
  { mode: "nutrition", page: "configure", title: "Configurar alimento", activeNavId: "scanner" },
  { mode: "nutrition", page: "day-presets", path: "/nutricion/plantillas", title: "Reutilizá tu día", nav: { group: "nutrition", order: 2, id: "day-presets", label: "Reutilizá tu día", mobileLabel: "Reutilizar", icon: "bookmark", primary: true, mobilePrimary: false } },
  { mode: "nutrition", page: "plans", path: "/nutricion/planes", title: "Planes", nav: { group: "nutrition", order: 5, id: "plans", label: "Planes", icon: "view_list", secondary: true } },
  { mode: "nutrition", page: "history", path: "/nutricion/historial", title: "Calendario", nav: { group: "nutrition", order: 1, id: "history", label: "Calendario", mobileLabel: "Historial", icon: "calendar_month", primary: true, mobilePrimary: true } },
  { mode: "nutrition", page: "profile", path: "/nutricion/perfil", title: "Perfil", nav: { group: "nutrition", order: 6, id: "profile", label: "Perfil", icon: "account_circle", account: true } },
  { mode: "training", page: "training-dashboard", path: "/entrenamiento/dia", title: "Día", nav: { group: "training", order: 0, id: "training-dashboard", label: "Día", icon: "monitoring", primary: true, mobilePrimary: true } },
  { mode: "training", page: "training-calendar", path: "/entrenamiento/calendario", title: "Calendario de entrenamiento", nav: { group: "training", order: 1, id: "training-calendar", label: "Calendario", mobileLabel: "Agenda", icon: "calendar_month", primary: true, mobilePrimary: true } },
  { mode: "training", page: "training-cardio", path: "/entrenamiento/cardio", title: "Cardio", nav: { group: "training", order: 2, id: "training-cardio", label: "Cardio", mobileLabel: "Cardio", icon: "directions_run", primary: true, mobilePrimary: true } },
  { mode: "training", page: "training-profile", path: "/entrenamiento/ejercicios", title: "Ejercicios", nav: { group: "training", order: 5, id: "training-profile", label: "Ejercicios", mobileLabel: "Ejercicios", icon: "fitness_center", secondary: true } },
  { mode: "training", page: "plans", path: "/entrenamiento/planes", title: "Planes", nav: { group: "training", order: 4, id: "plans", label: "Planes", icon: "view_list", secondary: true } },
  { mode: "training", page: "profile", path: "/entrenamiento/perfil", title: "Perfil", nav: { group: "training", order: 6, id: "profile", label: "Perfil", icon: "account_circle", account: true } },
  { mode: "nutrition", nav: { group: "nutrition", order: 4, id: "training", label: "Entreno", mobileLabel: "Entreno", icon: "training_section", mode: "training", primary: true, mobilePrimary: true } },
  { mode: "training", nav: { group: "training", order: 3, id: "nutrition", label: "Nutrición", mobileLabel: "Nutrición", icon: "nutrition_section", mode: "nutrition", primary: true, mobilePrimary: true } },
];

export const APP_ROUTES = PAGE_METADATA
  .filter((entry) => entry.path)
  .map(({ mode, page, path }) => [mode, page, path]);

export function pageTitle(mode, page) {
  return PAGE_METADATA.find((entry) => entry.mode === mode && entry.page === page)?.title || "ScaleGrams";
}

function navigationFor(group) {
  return PAGE_METADATA
    .filter((entry) => entry.nav?.group === group)
    .sort((left, right) => left.nav.order - right.nav.order)
    .map((entry) => {
      const { group: _group, order: _order, ...item } = entry.nav;
      const activePages = PAGE_METADATA
        .filter((candidate) => candidate.mode === group && candidate.activeNavId === item.id)
        .map((candidate) => candidate.page);
      return activePages.length ? { ...item, activePages } : item;
    });
}

export const navItems = navigationFor("nutrition");
export const trainingNavItems = navigationFor("training");

export function isNavItemActive(item, page) {
  return item.id === page || item.activePages?.includes(page);
}
