export function patientWithNote(patient, note) {
  return { ...patient, noteGenerale: note };
}

export function patientWithRecall(patient, text, date, id = Date.now(), createdOn) {
  const testo = text.trim();
  return {
    ...patient,
    annotazioni: [...(patient.annotazioni || []), {
      id, data: createdOn, testo,
      richiamo: date ? { testo, data: date, fatto: false } : null,
    }],
  };
}

export function formatClinicalHistoryNote(data, date) {
  const positive = data.risposte.filter((r) => r.valore !== 'no').map((r) => `${r.titolo}: ${r.valore === 'si' ? 'Sì' : 'Non so'}${r.note ? ` (${r.note})` : ''}`);
  const lines = [`ANAMNESI ${date}`];
  if (positive.length) lines.push(...positive);
  if (data.farmaci.length) lines.push(`Farmaci: ${data.farmaci.map((f) => f.nome).join(', ')}`);
  if (data.allergie.length) lines.push(`Allergie: ${data.allergie.map((a) => a.sostanza).join(', ')}`);
  if (lines.length === 1) lines.push('Nessuna condizione riferita.');
  return lines.join('\n');
}

// POL-UI-020: Product Owner — la croce anamnesi in header deve diventare
// rossa lampeggiante "nel caso di allarmi anamnesi" (allergie, malattie
// cardiache, oncologiche ecc, tutte le controindicazioni). Ogni risposta
// "Sì" a una voce di anamnesi è per definizione una controindicazione
// riferita dal paziente, così come ogni allergia — nessuna lista fissa di
// "voci pericolose" da mantenere a mano (funziona anche con le voci
// personalizzate che uno studio non-medico definisce da Impostazioni).
export function computeAnamnesiAlert(data) {
  const dettagli = [];
  for (const r of data.risposte) {
    if (r.valore === 'si') dettagli.push({ chiave: r.chiave, titolo: r.titolo, nota: r.note || '' });
  }
  for (const a of data.allergie) {
    dettagli.push({ chiave: `allergia:${a.sostanza}`, titolo: `Allergia: ${a.sostanza}`, nota: '' });
  }
  return { allarme: dettagli.length > 0, dettagli };
}
