import React, { Suspense, lazy, useState } from 'react';

const PdfViewerModal = lazy(() => import('../ui/PdfViewerModal.jsx'));

/* La ricetta preparata da Poliedron, già in PDF, dentro la chat. Nulla esce
   dallo studio finché il medico non conferma l'invio (Master Context: il
   clinico resta responsabile dell'atto). "Invia" apre la condivisione del
   telefono con il PDF (WhatsApp → contatto del paziente, numero già copiato);
   l'invio automatico arriverà con WhatsApp Business collegato. */
export default function PoliedronPreparedDocument({ prepared, busy, onSend, onSave, onEdit, onDiscard }) {
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState(false);
  if (!prepared) return null;
  const { patient, farmaci, pdf, status, notice } = prepared;
  const name = [patient?.nome, patient?.cognome].filter(Boolean).join(' ');
  const done = status === 'sent' || status === 'saved';
  const btn = { minHeight: 44, padding: '10px 16px', borderRadius: 10, fontWeight: 600 };
  const primary = { ...btn, background: '#4338ca', color: 'white', border: 0 };
  return (
    <section aria-label="Ricetta pronta" className="poliedron-prepared-doc" style={{ padding: 16, border: '1px solid #c7d2fe', borderRadius: 16, background: '#f5f7ff', overflowWrap: 'anywhere' }}>
      <h3 style={{ marginTop: 0, marginBottom: 6 }}>Ricetta medica · {name}</h3>
      <ol style={{ margin: '0 0 10px', paddingLeft: 20 }}>
        {farmaci.map((f, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            <strong>{f.farmaco}</strong>
            {[f.dosaggio, f.posologia, f.durata].filter(Boolean).length > 0 && <div style={{ fontSize: 13, opacity: 0.8 }}>{[f.dosaggio, f.posologia, f.durata].filter(Boolean).join(' · ')}</div>}
            {!f.posologia && <div style={{ fontSize: 13, color: '#b45309' }}>Posologia da completare: usa “Modifica”.</div>}
          </li>
        ))}
      </ol>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <button type="button" onClick={() => setPreview(true)} style={btn}>Apri il PDF</button>
        {!done && <button type="button" disabled={busy} onClick={onEdit} style={btn}>Modifica</button>}
      </div>
      {!done && !confirming && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" disabled={busy} onClick={() => setConfirming(true)} style={primary}>Invia a {patient?.nome || 'paziente'}</button>
          <button type="button" disabled={busy} onClick={onSave} style={btn}>Salva senza inviare</button>
          <button type="button" disabled={busy} onClick={onDiscard} style={btn}>Scarta</button>
        </div>
      )}
      {!done && confirming && (
        <div role="group" aria-label="Conferma invio">
          <p style={{ margin: '4px 0 8px' }}>Hai controllato la ricetta? La salvo in archivio e la invio a <strong>{name}</strong>{patient?.telefono ? ` (${patient.telefono})` : ''}.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" disabled={busy} onClick={() => { setConfirming(false); onSend?.(); }} style={primary}>Sì, invia</button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)} style={btn}>Annulla</button>
          </div>
        </div>
      )}
      {notice && <p role="status" style={{ margin: '10px 0 0', fontSize: 13 }}>{notice}</p>}
      {preview && (
        <Suspense fallback={null}>
          <PdfViewerModal titolo={pdf.titolo} dataUrl={pdf.dataUrl} filename={pdf.filename} onClose={() => setPreview(false)} />
        </Suspense>
      )}
    </section>
  );
}
