// SCAN-APP: le pagine di Scan caricate solo quando servono (scan/pagineScan.jsx).
import { PAGINE_SCAN } from '../../scan/pagineScan.jsx';
export function PaginaScan({ tipo, p, a }) { return PAGINE_SCAN[tipo]?.render(p, a) ?? null; }
