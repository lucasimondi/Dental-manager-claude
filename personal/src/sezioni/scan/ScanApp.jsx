// SCAN-APP (PO 2026-11-24): Poliedron Scan aperto come app dentro Personal (barra e Start), come una
// finestra di Windows: la Home di Scan con scanner, strumenti e Recenti; ogni strumento apre la sua
// pagina sopra. Stesse pagine dell'app Scan installata (scan/pagineScan.jsx), nessun dato nuovo.
import { ScanHome } from '../../scan/ScanHome.jsx';
import { apriStrumentoScan } from '../../scan/strumenti.js';
import { indirizzoScan } from '../../lib/scan.js';

export function ScanApp({ ctx, versioneRecenti = 0 }) {
  return (
    <div className="pp-scan-in-personal">
      <ScanHome ctx={ctx} versioneRecenti={versioneRecenti} coperta
        onStrumento={(id) => apriStrumentoScan(id, ctx)}
        onFiles={(files) => files.length && ctx.apri({ tipo: 'scanner', files })} />
      <a className="pp-testo-link pp-scan-installa" href={indirizzoScan()} target="_blank" rel="noreferrer">Apri Scan da solo (per metterlo sulla schermata Home)</a>
    </div>
  );
}
