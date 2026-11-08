// Dedicated Personal worker, same script/scope as notifications. Never register at '/'.
export const SHARE_CACHE = 'personal-pdf-incoming-v1';
export function ambitoPersonal(path = globalThis.location?.pathname || '/personal/') {
  return path.startsWith('/poliedron/personal') ? '/poliedron/personal/' : '/personal/';
}
export async function registraIngresso(nav = globalThis.navigator, path) {
  if (!nav?.serviceWorker) return null;
  const scope = ambitoPersonal(path);
  return nav.serviceWorker.register(`${scope}sw-notifiche.js`, { scope });
}
export async function leggiCondivisione(id, cacheStorage = globalThis.caches) {
  if (!/^[a-f0-9-]{36}$/.test(id || '')) throw new Error('Condivisione non valida.');
  const cache = await cacheStorage.open(SHARE_CACHE);
  const key = new URL(`/personal/pdf-incoming/${id}`, location.origin).href;
  const manifest = await cache.match(key);
  if (!manifest) throw new Error('File condiviso non disponibile o scaduto. Condividilo di nuovo.');
  const meta = await manifest.json();
  if (Date.now() - meta.created > 24 * 60 * 60 * 1000) throw new Error('File condiviso scaduto. Condividilo di nuovo.');
  const files = [];
  for (let i=0; i<meta.names.length; i++) { const response=await cache.match(`${key}/${i}`); if(!response) throw new Error('Condivisione incompleta. Riprova dal file originale.'); const blob=await response.blob(); files.push(new File([blob],meta.names[i],{type:blob.type})); }
  // Consume only after every file is available. No document is uploaded automatically.
  await Promise.all(meta.names.map((_,i)=>cache.delete(`${key}/${i}`))); await cache.delete(key);
  return files;
}
