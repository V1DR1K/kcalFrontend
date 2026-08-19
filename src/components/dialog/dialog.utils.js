export function createDialogIds(id, { title = true, description = false } = {}) {
  return {
    titleId: title ? `${id}-title` : undefined,
    descriptionId: description ? `${id}-description` : undefined,
  };
}

export function stopDialogPropagation(event) {
  event.stopPropagation();
}
