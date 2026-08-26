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
