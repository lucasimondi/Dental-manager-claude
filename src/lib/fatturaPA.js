// Generatore XML FatturaPA — formato FPR12 (fattura elettronica verso privato).
// Schema stabile dalla versione 1.2.2, confermato valido anche con l'aggiornamento
// specifiche tecniche 1.9.1 (15 maggio 2026): la struttura base Header/Body non è
// cambiata, solo regole di accreditamento canali e casi particolari (gruppi IVA,
// sportivi dilettanti) qui non rilevanti per un libero professionista.
//
// IMPORTANTE: questo modulo genera l'XML pronto per l'upload MANUALE sul portale
// gratuito "Fatture e Corrispettivi" dell'Agenzia delle Entrate. Non effettua la
// trasmissione automatica via SdI (richiederebbe un canale accreditato/intermediario
// a pagamento) — è "predisposizione", non invio.
//
// NON usare per il regime 'sanitario_esente_art10': dal 2026 la fattura elettronica
// via SdI è VIETATA in modo permanente per le prestazioni sanitarie verso privati
// (DLgs 81/2025, Ris. AdE 9/2026) — quelle restano PDF/cartacee (vedi DocFiscale.jsx).

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// RF01 = ordinario, RF19 = forfettario (L. 190/2014)
const REGIME_CODICE = { ordinario: 'RF01', forfettario: 'RF19' };

export function speseFatturaPAValida(studio, cliente) {
  const mancanti = [];
  if (!studio?.piva) mancanti.push('Partita IVA studio');
  if (!studio?.cap || !studio?.comune || !studio?.provincia || !studio?.via) mancanti.push('Indirizzo completo studio (via, CAP, comune, provincia)');
  if (!cliente?.cf) mancanti.push('Codice fiscale paziente');
  if (!cliente?.cap || !cliente?.comune || !cliente?.provincia) mancanti.push('Indirizzo completo paziente (CAP, comune, provincia)');
  return mancanti;
}

/**
 * @param {object} studio - { piva, cf, nome, nome_cognome_titolare, via, cap, comune, provincia, regime_fiscale, aliquota_iva, progressivo_invio_sdi }
 * @param {object} cliente - { nome, cognome, cf, comune, cap, provincia }
 * @param {object} fattura - { numero, data (YYYY-MM-DD), righe: [{descrizione, importo}], totale }
 * @returns {{ xml: string, nomeFile: string }}
 */
export function generaXmlFatturaPA(studio, cliente, fattura) {
  const regime = studio.regime_fiscale === 'ordinario' ? 'ordinario' : 'forfettario';
  const aliquota = regime === 'ordinario' ? Number(studio.aliquota_iva || 22) : 0;
  const imponibile = fattura.righe.reduce((s, r) => s + Number(r.importo), 0);
  const imposta = regime === 'ordinario' ? Math.round(imponibile * aliquota) / 100 : 0;
  const totale = imponibile + imposta;
  const bollo = regime === 'forfettario' && imponibile > 77.47 ? 2.0 : 0;

  const progressivo = String((studio.progressivo_invio_sdi || 0) + 1).padStart(5, '0');
  const numeroFattura = fattura.numero;
  const idPaese = 'IT';
  const idCodice = studio.piva;

  const anagraficaCedente = studio.nome_cognome_titolare
    ? `<Nome>${esc(studio.nome_cognome_titolare.split(' ')[0] || '')}</Nome><Cognome>${esc(studio.nome_cognome_titolare.split(' ').slice(1).join(' ') || '')}</Cognome>`
    : `<Denominazione>${esc(studio.nome)}</Denominazione>`;

  const righeXml = fattura.righe.map((r, i) => `
      <DettaglioLinee>
        <NumeroLinea>${i + 1}</NumeroLinea>
        <Descrizione>${esc(r.descrizione)}</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>${Number(r.importo).toFixed(2)}</PrezzoUnitario>
        <PrezzoTotale>${Number(r.importo).toFixed(2)}</PrezzoTotale>
        <AliquotaIVA>${aliquota.toFixed(2)}</AliquotaIVA>
        ${regime === 'forfettario' ? '<Natura>N2.2</Natura>' : ''}
      </DettaglioLinee>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://www.fatturapa.gov.it/sdi/fatturapa/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>${idPaese}</IdPaese>
        <IdCodice>${esc(idCodice)}</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${progressivo}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>${idPaese}</IdPaese>
          <IdCodice>${esc(idCodice)}</IdCodice>
        </IdFiscaleIVA>
        ${studio.cf ? `<CodiceFiscale>${esc(studio.cf)}</CodiceFiscale>` : ''}
        <Anagrafica>${anagraficaCedente}</Anagrafica>
        <RegimeFiscale>${REGIME_CODICE[regime]}</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${esc(studio.via)}</Indirizzo>
        <CAP>${esc(studio.cap)}</CAP>
        <Comune>${esc(studio.comune)}</Comune>
        <Provincia>${esc(studio.provincia)}</Provincia>
        <Nazione>${idPaese}</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <CodiceFiscale>${esc(cliente.cf)}</CodiceFiscale>
        <Anagrafica>
          <Nome>${esc(cliente.nome)}</Nome>
          <Cognome>${esc(cliente.cognome)}</Cognome>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${esc(cliente.indirizzo || studio.via)}</Indirizzo>
        <CAP>${esc(cliente.cap)}</CAP>
        <Comune>${esc(cliente.comune)}</Comune>
        <Provincia>${esc(cliente.provincia)}</Provincia>
        <Nazione>${idPaese}</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${fattura.data}</Data>
        <Numero>${esc(numeroFattura)}</Numero>
        <ImportoTotaleDocumento>${totale.toFixed(2)}</ImportoTotaleDocumento>
        ${regime === 'forfettario' ? '<Causale>Operazione effettuata ai sensi dell\'art. 1, commi 54-89, Legge n. 190/2014 (regime forfettario)</Causale>' : ''}
        ${bollo > 0 ? `<DatiBollo><BolloVirtuale>SI</BolloVirtuale><ImportoBollo>${bollo.toFixed(2)}</ImportoBollo></DatiBollo>` : ''}
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>${righeXml}
      <DatiRiepilogo>
        <AliquotaIVA>${aliquota.toFixed(2)}</AliquotaIVA>
        ${regime === 'forfettario' ? '<Natura>N2.2</Natura>' : ''}
        <ImponibileImporto>${imponibile.toFixed(2)}</ImponibileImporto>
        <Imposta>${imposta.toFixed(2)}</Imposta>
        <EsigibilitaIVA>I</EsigibilitaIVA>
      </DatiRiepilogo>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

  const nomeFile = `IT${idCodice}_${progressivo}.xml`;
  return { xml, nomeFile };
}

export function scaricaXml(xml, nomeFile) {
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
