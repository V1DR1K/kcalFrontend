export const APP_NAME = "KazaFitness";
export const TOKEN_KEY = "kazaFitness.token";
export const USER_KEY = "kazaFitness.user";
export const REGISTRATION_ENABLED = import.meta.env.VITE_REGISTRATION_ENABLED === "true";
export const DEFAULT_MEALS = [
  { code: "BREAKFAST", label: "Desayuno" }, { code: "LUNCH", label: "Almuerzo" },
  { code: "AFTERNOON_SNACK", label: "Merienda" }, { code: "DINNER", label: "Cena" },
];
export const navItems = [
  { id: "dashboard", label: "Dashboard", mobileLabel: "Inicio", icon: "monitoring" }, { id: "foods", label: "Alimentos", mobileLabel: "Buscar", icon: "nutrition" },
  { id: "create", label: "Crear", icon: "add_box" }, { id: "history", label: "Historial", icon: "calendar_month" },
  { id: "profile", label: "Perfil", icon: "account_circle" }, { id: "scanner", label: "Escaner", icon: "qr_code_scanner" },
];
export const CATEGORY_OPTIONS = [
  { value: "PROTEIN", label: "Proteinas" }, { value: "MEAT", label: "Carnes" }, { value: "DAIRY", label: "Lacteos" }, { value: "FRUIT", label: "Frutas" },
  { value: "VEGETABLE", label: "Verduras" }, { value: "LEGUME", label: "Legumbres" }, { value: "CEREAL", label: "Cereales" }, { value: "BAKERY", label: "Panificados" },
  { value: "BEVERAGE", label: "Bebidas" }, { value: "SWEET", label: "Golosinas" }, { value: "SNACK", label: "Snacks" }, { value: "FAT", label: "Grasas" }, { value: "OTHER", label: "Otros" },
];
export const PREPARATION_OPTIONS = [
  { value: "RAW", label: "Crudo/a" }, { value: "COOKED", label: "Cocido/a" },
  { value: "AS_SOLD", label: "Segun envase / como se vende" }, { value: "UNSPECIFIED", label: "Sin especificar" },
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
  { value: "UNIT", label: "Unidad" }, { value: "PORTION", label: "Porcion" },
];
