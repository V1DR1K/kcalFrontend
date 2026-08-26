export const APP_NAME = "ScaleGrams";
export const TOKEN_KEY = "scalegrams.token";
export const REFRESH_KEY = "scalegrams.refreshToken";
export const USER_KEY = "scalegrams.user";
const LEGACY_TOKEN_KEY = "kazaFitness.token";
const LEGACY_USER_KEY = "kazaFitness.user";

export function migrateStoredSession() {
  // Legacy local-auth JWTs are not valid central-auth access tokens. Do not
  // silently restore them after the Auth migration; the user must log in again.
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  if (!localStorage.getItem(USER_KEY) && localStorage.getItem(LEGACY_USER_KEY)) {
    localStorage.setItem(USER_KEY, localStorage.getItem(LEGACY_USER_KEY));
  }
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith("kazaFitness.recents.")) continue;
    const nextKey = key.replace("kazaFitness.recents.", "scalegrams.recents.");
    if (!localStorage.getItem(nextKey)) localStorage.setItem(nextKey, localStorage.getItem(key));
  }
}
const viteEnv = import.meta.env || {};
export const REGISTRATION_ENABLED = viteEnv.VITE_REGISTRATION_ENABLED === "true";
export const DEFAULT_MEALS = [
  { code: "BREAKFAST", label: "Desayuno" }, { code: "LUNCH", label: "Almuerzo" },
  { code: "AFTERNOON_SNACK", label: "Merienda" }, { code: "DINNER", label: "Cena" },
];
export const navItems = [
  { id: "dashboard", label: "Mi día", mobileLabel: "Mi día", icon: "monitoring" },
  { id: "history", label: "Historial", icon: "calendar_month" }, { id: "profile", label: "Mi perfil", icon: "account_circle" },
  { id: "scanner", label: "Registrar", mobileLabel: "Registrar", icon: "qr_code_scanner", activePages: ["my-foods", "recipes", "configure"] },
  { id: "training", label: "Entrenamiento", mobileLabel: "Entreno", icon: "fitness_center", mode: "training" },
];
export const trainingNavItems = [
  { id: "training-dashboard", label: "Dashboard", icon: "monitoring" },
  { id: "training-calendar", label: "Calendario", icon: "calendar_month" },
  { id: "profile", label: "Perfil", icon: "account_circle" },
  { id: "training-profile", label: "Perfil de entrenamiento", mobileLabel: "Perfil", icon: "fitness_center" },
];
export function isNavItemActive(item, page) {
  return item.id === page || item.activePages?.includes(page);
}
export const CATEGORY_OPTIONS = [
  { value: "PROTEIN", label: "Proteínas" }, { value: "MEAT", label: "Carnes" }, { value: "DAIRY", label: "Lácteos" }, { value: "FRUIT", label: "Frutas" },
  { value: "VEGETABLE", label: "Verduras" }, { value: "LEGUME", label: "Legumbres" }, { value: "CEREAL", label: "Cereales" }, { value: "BAKERY", label: "Panificados" },
  { value: "BEVERAGE", label: "Bebidas" }, { value: "SWEET", label: "Golosinas" }, { value: "SNACK", label: "Snacks" }, { value: "FAT", label: "Grasas" }, { value: "OTHER", label: "Otros" },
];
export const PREPARATION_OPTIONS = [
  { value: "RAW", label: "Crudo/a" }, { value: "COOKED", label: "Cocido/a" },
  { value: "AS_SOLD", label: "Según envase / como se vende" }, { value: "UNSPECIFIED", label: "Sin especificar" },
];
export const CATEGORY_ART = {
  PROTEIN: "/category-assets/protein.webp", MEAT: "/category-assets/protein.webp", DAIRY: "/category-assets/dairy.webp",
  FRUIT: "/category-assets/fruit.webp", VEGETABLE: "/category-assets/vegetable.webp", LEGUME: "/category-assets/cereal.webp",
  CEREAL: "/category-assets/cereal.webp", BAKERY: "/category-assets/cereal.webp", BEVERAGE: "/category-assets/other.webp",
  SWEET: "/category-assets/other.webp", SNACK: "/category-assets/fat.webp", FAT: "/category-assets/fat.webp", OTHER: "/category-assets/other.webp",
};
export const RECIPE_ART = "/category-assets/recipe.webp";
export const UNIT_OPTIONS = [
  { value: "GRAM", label: "Gramos" }, { value: "MILLILITER", label: "Mililitros" },
  { value: "UNIT", label: "Unidad" }, { value: "PORTION", label: "Porción" },
];
