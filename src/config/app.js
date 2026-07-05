export const APP_NAME = "KazaFitness";
export const TOKEN_KEY = "kazaFitness.token";
export const USER_KEY = "kazaFitness.user";
export const REGISTRATION_ENABLED = import.meta.env.VITE_REGISTRATION_ENABLED === "true";
export const DEFAULT_MEALS = [
  { code: "BREAKFAST", label: "Desayuno" }, { code: "LUNCH", label: "Almuerzo" },
  { code: "AFTERNOON_SNACK", label: "Merienda" }, { code: "DINNER", label: "Cena" },
];
export const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "monitoring" }, { id: "foods", label: "Alimentos", icon: "nutrition" },
  { id: "create", label: "Crear", icon: "add_box" }, { id: "history", label: "Historial", icon: "calendar_month" },
  { id: "profile", label: "Perfil", icon: "account_circle" }, { id: "scanner", label: "Escaner", icon: "qr_code_scanner" },
];
export const CATEGORY_OPTIONS = [
  { value: "PROTEIN", label: "Proteinas" }, { value: "DAIRY", label: "Lacteos" }, { value: "FRUIT", label: "Frutas" },
  { value: "VEGETABLE", label: "Verduras" }, { value: "CEREAL", label: "Cereales" }, { value: "FAT", label: "Grasas" }, { value: "OTHER", label: "Otros" },
];
export const PREPARATION_OPTIONS = [
  { value: "RAW", label: "Crudo/a" }, { value: "COOKED", label: "Cocido/a" },
  { value: "AS_SOLD", label: "Segun envase / como se vende" }, { value: "UNSPECIFIED", label: "Sin especificar" },
];
export const CATEGORY_ART = Object.fromEntries(["PROTEIN", "DAIRY", "FRUIT", "VEGETABLE", "CEREAL", "FAT", "OTHER"].map((key) => [key, `/category-assets/${key.toLowerCase()}.webp`]));
export const RECIPE_ART = "/category-assets/recipe.webp";
export const UNIT_OPTIONS = [
  { value: "GRAM", label: "Gramos" }, { value: "MILLILITER", label: "Mililitros" },
  { value: "UNIT", label: "Unidad" }, { value: "PORTION", label: "Porcion" },
];
