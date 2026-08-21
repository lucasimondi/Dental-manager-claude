import React, { useState } from 'react';
import { Btn, Modal, Ic } from './ui';
import { C } from '../lib/utils';
import { parseCSV, splitNomeKanino, cleanTelefono } from '../lib/csvImport';

export default function ImportCsvModal({ onClose, onImport }) {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');

  const handleFiles = async (fileList) => {
    setError('');
    const newFiles = [];
    for (const file of fileList) {
      try {
        const text = await file.text();
        const rows = parseCSV(text);
        if (rows.length < 2) continue;
        const header = rows[0].map((h) => h.trim().toLowerCase());
        const idxNome = header.findIndex((h) => h.includes('nome'));
        const idxCf = header.findIndex((h) => h.includes('fiscale'));
        const idxTel = header.findIndex((h) => h.includes('telefono'));
        const idxEmail = header.findIndex((h) => h.includes('email'));
        const parsed = rows.slice(1).filter((r) => r[idxNome] && r[idxNome].trim()).map((r) => {
          const { cognome, nome } = splitNomeKanino(r[idxNome] || '');
          return {
            cognome, nome,
            cf: (r[idxCf] || '').trim().toUpperCase(),
            telefono: cleanTelefono(r[idxTel] || ''),
            email: (r[idxEmail] || '').trim(),
            _raw: r[idxNome],
          };
        });
        newFiles.push({ name: file.name, rows: parsed });
      } catch (e) { setError('Errore lettura file: ' + file.name); }
    }
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const totRows = files.reduce((s, f) => s + f.rows.length, 0);
  const allRows = files.flatMap((f) => f.rows);
  const removeFile = (name) => setFiles((prev) => prev.filter((f) => f.name !== name));
  const removeRow = (fileName, idx) => setFiles((prev) => prev.map((f) => (f.name === fileName ? { ...f, rows: f.rows.filter((_, i) => i !== idx) } : f)));

  const confirmImport = () => {
    onImport(allRows.map((r) => ({
      nome: r.nome, cognome: r.cognome, cf: r.cf, telefono: r.telefono, email: r.email,
      dataNascita: '', indirizzo: '', note: '',
    })));
  };

  return (
    <Modal title="Importa pazienti da CSV" icon="upload" onClose={onClose} wide>
      <div style={{ fontSize: 12, color: C.txm, marginBottom: 12, lineHeight: 1.5 }}>
        Carica uno o più file CSV esportati da altri gestionali. Il nome viene separato automaticamente in Cognome/Nome.
      </div>

      <label style={{ display: 'block', border: `2px dashed ${C.brd}`, borderRadius: 10, padding: '22px 14px', textAlign: 'center', cursor: 'pointer', marginBottom: 14, background: C.bg }}>
        <input type="file" accept=".csv" multiple onChange={(e) => handleFiles(e.target.files)} style={{ display: 'none' }} />
        <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}><Ic n="file" s={28} c={C.pri} /></div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.pri }}>Tocca per scegliere uno o più file CSV</div>
        <div style={{ fontSize: 11, color: C.txl, marginTop: 3 }}>Puoi selezionare più file insieme</div>
      </label>

      {error && <div style={{ background: C.danL, color: C.dan, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>{error}</div>}

      {files.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.txm }}>{files.length} file · {totRows} pazienti trovati</span>
          </div>
          {files.map((f) => (
            <div key={f.name} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.pri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.name} ({f.rows.length})</span>
                <button onClick={() => removeFile(f.name)} style={{ background: C.danL, border: 'none', borderRadius: 6, padding: '3px 8px', color: C.dan, fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0, marginLeft: 8, display: 'flex', alignItems: 'center', gap: 3 }}><Ic n="x" s={9} c={C.dan} />rimuovi file</button>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${C.brd}`, borderRadius: 8 }}>
                {f.rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: i < f.rows.length - 1 ? `1px solid ${C.brd}` : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{r.cognome} {r.nome}</div>
                      <div style={{ fontSize: 10, color: C.txl }}>{r.telefono || '—'}{r.cf ? ' · ' + r.cf : ''}{r.email ? ' · ' + r.email : ''}</div>
                    </div>
                    <button onClick={() => removeRow(f.name, i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, flexShrink: 0 }}><Ic n="x" s={12} c={C.dan} /></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={onClose} full />
            <Btn ch={`Importa ${totRows} pazienti`} onClick={confirmImport} dis={totRows === 0} full />
          </div>
        </>
      )}
    </Modal>
  );
}
