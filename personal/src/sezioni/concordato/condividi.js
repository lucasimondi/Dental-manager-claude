// Un PDF creato nell'app: «Apri» lo mostra nel visore del telefono, «Condividi» apre il foglio di condivisione
// (WhatsApp, email, Salva su File) e, dove non c'è, lo scarica.
export function apriPdf(blob) {
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) scarica(url, 'documento.pdf');
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}
function scarica(url, nome) {
  const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
}
export async function condividiPdf(blob, nome) {
  const file = new File([blob], nome, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: nome }); return 'condiviso'; } catch (e) { if (e?.name === 'AbortError') return 'annullato'; }
  }
  const url = URL.createObjectURL(blob); scarica(url, nome); setTimeout(() => URL.revokeObjectURL(url), 120000);
  return 'scaricato';
}
export const nomeFile = (base, d = new Date()) => `${base}-${d.toISOString().slice(0, 10)}.pdf`;
