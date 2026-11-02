// Appearance is a device preference, never an archive/account setting.
export const CHIAVE_ASPETTO = 'poliedron-personal-aspetto-v1';
export const normalizzaAspetto = (valore) => valore === 'win95' ? 'win95' : 'moderno';
export function leggiAspetto(storage) {
  try { return normalizzaAspetto(storage?.getItem(CHIAVE_ASPETTO)); } catch { return 'moderno'; }
}
export function salvaAspetto(storage, valore) {
  const tema = normalizzaAspetto(valore);
  try { storage?.setItem(CHIAVE_ASPETTO, tema); } catch { /* Still usable for the current session. */ }
  return tema;
}
export function storageAspetto() {
  try { return globalThis.localStorage; } catch { return null; }
}
export function applicaAspetto(root, valore) {
  const tema = normalizzaAspetto(valore);
  if (root) root.dataset.personalTheme = tema;
  return tema;
}
