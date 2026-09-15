import React from "react";
import { FoodEditorForm } from "../../foods/components/FoodEditorForm";
import { RecipeEditorForm } from "../../recipes/components/RecipeEditorForm";

// Compatibility exports for existing catalog entry points. The implementation lives with its feature.
export function CreateFoodForm(props) {
  return <FoodEditorForm {...props} />;
}

export function CreateRecipeForm(props) {
  return <RecipeEditorForm {...props} />;
}
