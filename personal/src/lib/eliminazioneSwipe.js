// Drive deve confermare ogni file prima di rimuovere i record locali.
export async function eliminaConDrive(docs, { cestina, elimina }) {
  if (docs.some((d) => d.fascicolo === 'clinico_pazienti')) throw new Error('I documenti clinici non si eliminano da qui.');
  const ids = [...new Set(docs.map((d) => d.drive_file_id).filter(Boolean))];
  const drive = await cestina(ids);
  if (drive.non_trovati.length || ids.some((id) => !drive.cestinati.includes(id))) throw new Error('Alcuni file non sono stati cestinati su Drive. Archivio conservato: riprova dopo aver verificato Drive.');
  await elimina(docs.map((d) => d.id));
}
