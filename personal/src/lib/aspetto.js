// PO 2026-11-08: "tema win togliamo". Resta un solo stile (moderno); una vecchia scelta
// "win95" salvata sul dispositivo viene ignorata e riscritta come moderno.
export const CHIAVE_ASPETTO = 'poliedron-personal-aspetto-v1';
export const normalizzaAspetto = () => 'moderno';
export function leggiAspetto() { return 'moderno'; }
export function salvaAspetto(storage) {
  try { storage?.setItem(CHIAVE_ASPETTO, 'moderno'); } catch { /* facoltativo */ }
  return 'moderno';
}
export function storageAspetto() {
  try { return globalThis.localStorage; } catch { return null; }
}
export function applicaAspetto(root) {
  if (root) root.dataset.personalTheme = 'moderno';
  return 'moderno';
}
