export function isPoliedronAppPath(pathname = '') {
  return /^\/poliedron(?:\/|\/index\.html)?$/.test(pathname);
}

// Ignore pinch zoom: shrinking the app when zooming makes the content jump.
export function phoneViewport(viewport) {
  if (!viewport || Math.abs((viewport.scale ?? 1) - 1) > 0.02) return null;
  if (!Number.isFinite(viewport.height) || viewport.height <= 0) return null;
  return { height: Math.round(viewport.height), top: Math.max(0, Math.round(viewport.offsetTop || 0)) };
}

export function joinDictation(draft, transcript) {
  return [draft.trimEnd(), transcript.trim()].filter(Boolean).join(' ').slice(0, 16000);
}

export function speechErrorMessage(code) {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'Microfono non autorizzato. Puoi usare la dettatura della tastiera.';
  if (code === 'no-speech') return 'Non ho sentito parole. Tocca il microfono e riprova.';
  if (code === 'network') return 'Dettatura non disponibile con questa connessione. Puoi scrivere il messaggio.';
  if (code === 'aborted') return '';
  return 'Dettatura non disponibile. Puoi usare il microfono della tastiera.';
}

// Clear immediately, serialize rapid taps and preserve text typed while waiting.
// The existing controller remains the only executor; no queued/offline writes.
export async function submitChatDraft({ text, lock, send, clear, restore, pending, done, fail }) {
  const value = text.trim();
  if (!value || lock.current) return false;
  lock.current = true;
  clear();
  pending(value);
  try {
    const accepted = await send(value);
    if (accepted === false) restore(value);
    return accepted !== false;
  } catch {
    restore(value);
    fail();
    return false;
  } finally {
    lock.current = false;
    done();
  }
}
