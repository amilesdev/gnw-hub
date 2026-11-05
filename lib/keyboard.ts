/** Input types that don't raise the on-screen keyboard (toggles, pickers, buttons). */
const NON_TYPING_INPUTS = new Set([
  'button', 'checkbox', 'color', 'date', 'datetime-local', 'file', 'hidden',
  'image', 'month', 'radio', 'range', 'reset', 'submit', 'time', 'week',
]);

/**
 * Whether focus is on something you type into — the thing that brings up the
 * phone keyboard. The visual viewport alone can't say: iOS doesn't always
 * report the keyboard closing (leaving the app with it up, a dismiss
 * mid-animation), so keyboard-aware layout trusts this first.
 */
export function isTypingTarget(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return !NON_TYPING_INPUTS.has(el.type) && !el.readOnly && !el.disabled;
  return false;
}
