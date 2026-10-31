// Documenti — archivia un file (foto, PDF, scansione): da qui vanno anche bollette e foto degli album.
import { useEffect, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { caricaDocumento, pagamentoDaDocumento } from '../../lib/archivio.js';
import { catalogaFoto } from '../../lib/foto.js';
import { preparaFile as preparaCaricamento } from '../../lib/file.js';
import { tokenSessione } from '../../ui.jsx';
import { IconaFotocamera, IconaFile, IconaScansiona } from '../../Icone.jsx';

export function PaginaCarica({ opzioni, file: fileIniziale, ctx, sostituisci }) {
  const { aggiorna, mostra, impostazioni, fascicoli } = ctx;
  const [file, setFile] = useState(fileIniziale || null);
  const [anteprima, setAnteprima] = useState(() => (fileIniziale?.type?.startsWith('image/') ? URL.createObjectURL(fileIniziale) : null));
  const [descrizione, setDescrizione] = useState(opzioni.descrizione || '');
  const [fascicolo, setFascicolo] = useState(opzioni.fascicolo || '');
  const [persona, setPersona] = useState(opzioni.persona || '');
  const [categoria, setCategoria] = useState(opzioni.categoria || '');
  const [tieni, setTieni] = useState(!!opzioni.portafoglio);
  const [nonAnalizzare, setNonAnalizzare] = useState(false);
  const [stato, setStato] = useState(null);
  const fotocamera = useRef(null);
  const archivio = useRef(null);
  const autoAvviato = useRef(false);

  useEffect(() => () => anteprima && URL.revokeObjectURL(anteprima), [anteprima]);
  const scegli = (f) => {
    if (!f) return;
    setFile(f); setStato(null);
    setAnteprima(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
  };
  const invia = async () => {
    setStato({ invio: true, testo: 'Preparo il file…' });
    try {
      const pronto = await preparaCaricamento(file);
      setStato({ invio: true, testo: nonAnalizzare ? 'Salvo su Drive…' : 'Salvo su Drive e leggo il documento…' });
      const r = await caricaDocumento({ token: await tokenSessione(), ...pronto, descrizione, fascicolo, portafoglio: tieni, nonAnalizzare, persona, categoria });
      setStato({ invio: true, testo: 'Verifico il documento nell’archivio…' });
      const verifica = await archivioDb.from('documenti').select('id').eq('id', r.id).maybeSingle();
      if (verifica.error || !verifica.data) {
        throw new Error('Il file potrebbe essere stato salvato su Drive, ma non risulta nell’archivio. Non ripetere il caricamento: verifica prima per evitare duplicati.');
      }
      aggiorna();
      // Da Conti: il documento diventa (o si collega a) un pagamento da fare.
      if (r.id && (opzioni.pagamento || opzioni.pagamentoId)) {
        const [primo] = await pagamentoDaDocumento(archivioDb, r.id, { categoria: opzioni.categoriaPagamento || null, pagamentoId: opzioni.pagamentoId || null });
        aggiorna();
        mostra(opzioni.pagamentoId ? 'Documento allegato al pagamento' : 'Letto: controlla importo e scadenza');
        if (primo) { sostituisci({ tipo: 'pagamento', s: primo }); return; }
      }
      // Da Foto e video: la foto o il video va nell'album scelto.
      if (r.id && fascicolo === 'foto_video') {
        if (opzioni.album) await catalogaFoto(archivioDb, r.id, { album: opzioni.album }).catch(() => {});
        aggiorna(); mostra(r.duplicato ? 'Era già in archivio' : `Aggiunto a Foto e video${opzioni.album ? ` · ${opzioni.album}` : ''}`);
        sostituisci({ tipo: 'fotovideo', album: opzioni.album || null }); return;
      }
      mostra(r.duplicato ? 'Era già in archivio' : `Archiviato: ${r.titolo}`);
      if (r.id) sostituisci({ tipo: 'documento', id: r.id });
    } catch (e) {
      setStato({ errore: true, testo: e.message });
    }
  };

  // Le foto scelte dalle azioni rapide vengono archiviate senza ulteriori tocchi.
  // Il ref impedisce invii duplicati anche con effetti React rieseguiti.
  useEffect(() => {
    if (!opzioni.autoInvia || !file || autoAvviato.current) return;
    autoAvviato.current = true;
    void invia();
  }, []); // Solo al montaggio: il file iniziale è già disponibile.

  return (
    <>
      <input ref={fotocamera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => scegli(e.target.files[0])} />
      <input ref={archivio} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.txt,.rtf,.heic,.heif" hidden onChange={(e) => scegli(e.target.files[0])} />
      {!file ? (
        <div className="pp-sorgenti">
          <button className="pp-sorgente" onClick={() => sostituisci({ tipo: 'scansione', opzioni })}><IconaScansiona size={28} /><span>Scansiona</span></button>
          <button className="pp-sorgente" onClick={() => fotocamera.current.click()}><IconaFotocamera size={28} /><span>Scatta una foto</span></button>
          <button className="pp-sorgente pp-sorgente-larga" onClick={() => archivio.current.click()}><IconaFile size={28} /><span>Foto, PDF o file da iCloud, Drive e altre app</span></button>
        </div>
      ) : (
        <div className="pp-scelto">
          {anteprima ? <img src={anteprima} alt="" /> : <span className="pp-scelto-icona"><IconaFile size={28} /></span>}
          <div><strong>{file.name}</strong><span className="pp-riga-meta">{file.size < 1048576 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1048576).toFixed(1)} MB`}</span></div>
          <button className="pp-testo-link" onClick={() => { setFile(null); setAnteprima(null); }}>Cambia</button>
        </div>
      )}
      <label className="pp-campo"><span>Cos'è (facoltativo)</span>
        <input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Es. Carta d'identità, fronte e retro" />
      </label>
      <div className="pp-due">
        <label className="pp-campo"><span>Persona</span>
          <select className="pp-select" value={persona} onChange={(e) => setPersona(e.target.value)}>
            <option value="">Nessuna</option>
            {impostazioni.persone.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="pp-campo"><span>Tipo</span>
          <select className="pp-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Nessuno</option>
            {impostazioni.categorie.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      </div>
      <label className="pp-campo"><span>Fascicolo</span>
        <select className="pp-select" value={fascicolo} onChange={(e) => setFascicolo(e.target.value)}>
          <option value="">Scegli in automatico</option>
          {fascicoli.map((f) => <option key={f.codice} value={f.codice}>{f.nome}</option>)}
        </select>
      </label>
      <label className="pp-interruttore"><input type="checkbox" checked={tieni} onChange={(e) => setTieni(e.target.checked)} /><span>Tieni a portata di mano (Personali)</span></label>
      <label className="pp-interruttore"><input type="checkbox" checked={nonAnalizzare} onChange={(e) => setNonAnalizzare(e.target.checked)} /><span>Non leggere il contenuto (solo archiviazione)</span></label>
      <p className="pp-riga-meta">Il file va nel tuo Google Drive, cartella "Archivio personale/Caricati". I documenti dei pazienti non vengono mai letti.</p>
      <button className="pp-bottone pp-bottone-largo" disabled={!file || stato?.invio} onClick={invia}>{stato?.invio ? stato.testo : 'Archivia'}</button>
      {stato?.errore && <p className="pp-messaggio pp-messaggio-errore">{stato.testo}</p>}
    </>
  );
}
