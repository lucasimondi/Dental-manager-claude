import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { fmt, fmtD } from '../lib/utils';
import { loadPatientDocumentMetadata, loadPatientDocumentPdf } from '../lib/patientWorkspaceDocuments';

// POL-DOC-ARCHIVE-MOBILE-OPEN-FIX: archived-document "Apri"/"Stampa" used to
// open a new browser tab for the fetched PDF after an async round-trip.
// Mobile browsers only allow that kind of tab open synchronously inside the
// original tap's call stack; once that gap is an await away, it is silently
// blocked with no fallback (desktop is far more lenient, so this only
// reproduced on phones). PdfViewerModal is the in-app viewer ArchivioDocs and
// PannelloInvioDocumento already rely on for the exact same reason — it
// never opens a new tab, so it works identically on mobile and desktop.
const PdfViewerModal = React.lazy(() => import('./ui/PdfViewerModal.jsx'));

const SECTIONS = [
  ['clinical', 'Documenti clinici'],
  ['prescriptions', 'Ricette'],
  ['consents', 'Consensi'],
  ['fiscal', 'Documenti fiscali'],
];
const EMPTY_DOCUMENTS_CHANGE = () => {};

const fileNameFor = (document) => `${document.type || 'documento'}_${document.date || 'senza-data'}.pdf`.replace(/\s+/g, '_').toLowerCase();

export default function PatientWorkspaceDocuments({ patientId, client = supabase, reloadToken = 0, onDocumentsChange = EMPTY_DOCUMENTS_CHANGE }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState('');
  const [viewer, setViewer] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    loadPatientDocumentMetadata(client, patientId)
      .then((items) => { if (active) { setDocuments(items); onDocumentsChange(items); } })
      .catch(() => { if (active) setError('Documenti non disponibili. Verifica accesso e connessione.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, patientId, reloadToken, onDocumentsChange]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('it-IT');
    return needle ? documents.filter((item) => `${item.title} ${item.type}`.toLocaleLowerCase('it-IT').includes(needle)) : documents;
  }, [documents, query]);

  const withPdf = async (document, action) => {
    setBusyId(`${document.source}:${document.sourceId}`);
    setError('');
    try { await action(await loadPatientDocumentPdf(client, document)); }
    catch (reason) { setError(reason?.message || 'PDF non disponibile'); }
    finally { setBusyId(null); }
  };

  const viewPdf = (document) => withPdf(document, (dataUrl) => setViewer({ titolo: document.title, dataUrl, filename: fileNameFor(document) }));

  if (loading) return <section className="pw2-doc-state" aria-live="polite">Caricamento metadati documenti…</section>;
  return <section className="pw2-documents" data-lazy-source="patient-document-metadata">
    <div className="pw2-doc-toolbar"><div><strong>Documenti paziente</strong><small>Il PDF viene caricato solo quando lo apri.</small></div>{documents.length > 4 && <input aria-label="Cerca documenti" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca documento…" />}</div>
    {error && <div className="pw2-doc-error" role="alert">{error}</div>}
    {!documents.length && !error && <div className="pw2-doc-state"><strong>Nessun documento</strong><span>I documenti generati per il paziente appariranno qui.</span></div>}
    {SECTIONS.map(([category, label]) => {
      const items = visible.filter((item) => item.category === category);
      if (!items.length) return null;
      return <section className="pw2-doc-section" key={category}><h3>{label}<span>{items.length}</span></h3><div className="pw2-doc-list">{items.map((document) => {
        const key = `${document.source}:${document.sourceId}`;
        const busy = busyId === key;
        return <article key={key}><div><strong>{document.title}</strong><span>{document.type} · {fmtD(document.date)}{document.amount != null ? ` · ${fmt(document.amount)}` : ''}</span></div><div><button disabled={busy} onClick={() => viewPdf(document)}>{busy ? 'Caricamento…' : 'Apri'}</button><button disabled={busy} onClick={() => viewPdf(document)}>Stampa / PDF</button></div></article>;
      })}</div></section>;
    })}
    {viewer && (
      <Suspense fallback={<div className="pw2-doc-state" aria-live="polite">Caricamento anteprima…</div>}>
        <PdfViewerModal titolo={viewer.titolo} dataUrl={viewer.dataUrl} filename={viewer.filename} onClose={() => setViewer(null)} />
      </Suspense>
    )}
  </section>;
}

export function PatientWorkspaceConsentFlow({ patient, client = supabase, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    client.auth.getSession().then(async ({ data: { session } }) => {
      const studioId = session?.user?.app_metadata?.studio_id;
      if (!studioId) throw new Error('Sessione studio non disponibile');
      const result = await client.from('consenso_modelli').select('id, titolo, testo, tipo, attivo').eq('studio_id', studioId).eq('attivo', true).order('created_at', { ascending: false });
      if (result.error) throw result.error;
      if (active) setTemplates(result.data || []);
    }).catch(() => { if (active) setError('Modelli consenso non disponibili.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client]);

  return <div className="pw2-real-modal" role="dialog" aria-modal="true" aria-label="Crea consenso"><div className="pw2-consent-flow"><header><div><small>Consenso · {patient?.nome} {patient?.cognome}</small><h2>{selected ? selected.titolo : 'Seleziona un modello'}</h2></div><button onClick={onClose} aria-label="Chiudi">×</button></header>{loading && <div className="pw2-doc-state">Caricamento modelli…</div>}{error && <div className="pw2-doc-error">{error}</div>}{!loading && !selected && <div className="pw2-consent-templates">{templates.map((template) => <button key={template.id} onClick={() => setSelected(template)}><strong>{template.titolo}</strong><span>{template.tipo || 'Altro'}</span></button>)}{!templates.length && !error && <div className="pw2-doc-state">Nessun modello consenso attivo.</div>}</div>}{selected && <><div className="pw2-consent-patient"><strong>Paziente preassegnato</strong><span>{patient?.nome} {patient?.cognome}</span></div><div className="pw2-consent-preview">{selected.testo}</div><div className="pw2-consent-gap" role="note"><strong>Firma non avviabile da questa preview</strong><span>Il repository espone la firma remota solo dopo la creazione di un token, ma non contiene il contratto autenticato per generarlo. Nessun record o backend parallelo è stato creato.</span></div><footer><button onClick={() => setSelected(null)}>Cambia modello</button><button disabled>Invia alla firma</button></footer></>}</div></div>;
}
