// Files are prepared BEFORE the final share tap, preserving browser user activation.
export function quotePdfFile(pdf) {
  const bytes = Uint8Array.from(atob(pdf.dataUrl.split(',')[1]), c => c.charCodeAt(0));
  return new File([bytes], pdf.filename, { type: 'application/pdf' });
}
export async function quoteJpgFiles(pdf) {
  const { renderQuoteJpgFiles } = await import('./quoteJpgRenderer.js');
  return renderQuoteJpgFiles(pdf);
}
export async function shareQuoteFiles(files, nav = navigator) {
  if (!files?.length) throw new Error('Documento non ancora pronto.');
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function' || !nav.canShare({ files })) return 'unsupported';
  try { await nav.share({ files }); return 'shared'; }
  catch (error) { if (error.name === 'AbortError') return 'cancelled'; throw error; }
}
export function downloadQuoteFiles(files) {
  for (const file of files) {
    const url = URL.createObjectURL(file), link = document.createElement('a');
    link.href = url; link.download = file.name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
