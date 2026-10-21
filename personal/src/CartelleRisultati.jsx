export function CartelleRisultati({ documenti = [], ctx }) {
  const nomi = [...new Set(documenti.filter((d) => d.fascicolo !== 'clinico_pazienti').map((d) => d.ente).filter(Boolean))];
  if (!nomi.length) return null;
  return <section className="pp-fascicolo-risultati" aria-label="Cartelle dei risultati">
    <strong>Apri la cartella completa</strong>
    <div className="pp-filtri">{nomi.map((ente) => <button key={ente} className="pp-filtro" onClick={() => ctx.apri({ tipo: 'cartella', ente, titolo: ente })}>📁 {ente}</button>)}</div>
  </section>;
}
