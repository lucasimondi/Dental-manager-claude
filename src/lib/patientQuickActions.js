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
