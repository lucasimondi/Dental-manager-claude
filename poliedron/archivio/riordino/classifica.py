#!/usr/bin/env python3
"""POL-VITA-ORDINA fase 2 — classificazione dei file dell'archivio nella tassonomia (TASSONOMIA.md).

Fatto da Claude Code in sessione, senza API (richiesta del PO del 2026-11-22: «Fallo tu senza api»).
Legge i dati già estratti (metadati del catalogo, testo estratto, elenco reale di Drive) e propone, per ogni
file NON clinico, cartella, nome, tipo, soggetto, data, confidenza e motivo. Non sposta niente: il risultato
va nella tabella `piano_riordino` e Luca decide.

Uso: classifica.py <docs.json> <drive.json> <pratiche.json> <uscita.json>
"""
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict

# ---------------------------------------------------------------- elenchi (bozza da confermare in TASSONOMIA.md)
PERSONE = [
    ('Luca Simondi', r'\bluca\s+simondi\b|\bsimondi\s+luca\b'),
    ('Martina Simondi', r'\bmartina\b'),
    ('Giulia Simondi', r'\bgiulia\b'),
    ('Anna Simondi', r'\banna\s+simondi\b|\bsimondi\s+anna\b'),
    ('Roberto Simondi', r'\broberto\s+simondi\b|\bsimondi\s+roberto\b'),
    ('Anna Bruna Levrone', r'\blevrone\b'),
]
FAMIGLIA = {p for p, _ in PERSONE}
DIPENDENTI = r'ganzino|zhulberta'

IMMOBILI = [  # (nome cartella, regex, confermato dalle visure)
    ('Cuneo – via Piccona 36', r'piccona\s*(n\.?\s*)?36|via\s+piccona(?!\s*33)(?!.*cascina)', True),
    ('Cuneo – Cascina Piccona', r'cascina\s+piccona', True),
    ('Cuneo – piazza Boves 13', r'p(iazz|\.?z)za\s+boves|garage\s+piazza\s+boves', True),
    ('Cuneo – corso Galileo Ferraris 6', r'galileo\s+ferraris', True),
    ('Pradleves – via IV Novembre 17-19', r'(iv|4)\s+novembre.*pradleves|pradleves.*(iv|4)\s+novembre', True),
    ('Pradleves – via Castello 3', r'via\s+castello.*pradleves|pradleves.*via\s+castello', True),
    ('Pradleves – Borgata Riosecco', r'riosecco', True),
    ('Pradleves – terreni', r'pradleves', True),
    ('Beinette – via Mario Rosso 59-A', r'beinette|mario\s+rosso', True),
    ('Golfo Aranci', r'golfo\s+aranci', False),
    ('Dronero – Pratavecchia 44', r'pratavecchia|dronero', False),
    ('Pietra Ligure – Condominio Armida', r'armida|pietra\s+ligure', False),
    ('Cuneo – via del Pilone 38', r'via\s+del\s+pilone', False),
    ('Cuneo – via Piccona 33', r'piccona\s*(n\.?\s*)?33', False),
]
BANCHE = [
    ('Banca Alpi Marittime', r'alpi\s+marittime', True),
    ('BCC Pianfei', r'pianfei', False),
    ('Banca Azzoaglio', r'azzoaglio', True),
    ('Intesa Sanpaolo', r'intesa\s*san\s*paolo|intesasanpaolo|\bubi\s*banca\b|ubibanca|\bubi\b', True),
    ('Revolut', r'revolut', True),
    ('Wise', r'transferwise|wise\s+europe|\bwise\.com', True),
    ('Sella Personal Credit', r'sella\s+personal', True),
    ('Fiditalia', r'fiditalia', True),
    ('Kerdos SPV', r'kerdos', True),
    ('UniCredit', r'unicredit', False),
    ('Poste Italiane', r'bancoposta|poste\s+italiane', False),
    ('PayPal', r'paypal', False),
    ('Klarna', r'klarna', False),
    ('Banca di Caraglio', r'banca\s+di\s+caraglio', False),
]
VEICOLI = {'CM396HK': 'Fiat Punto CM396HK', 'FN862HS': 'Auto FN862HS', 'EJ621TT': 'Auto EJ621TT', 'ER572DF': 'Auto ER572DF', 'EH207VW': 'Auto EH207VW'}
NOLEGGI = r'share\s*now|free2move|bipicar|flexauto|car\s*sharing|\btier\b|enjoy\b|leasys|ayvens|noleggio\s+(auto|veicol)|mgb\s+motori'
BARCA = r'sealine|imbarcazion|patente\s+nautica|yacht|barca\b|natante'
UTENZE = [  # (tipo, fornitore, regex)
    ('Luce', 'Edison', r'edison'), ('Luce', 'Union Energia', r'union\s+energia'), ('Luce', 'Enel', r'\benel\b'),
    ('Luce e gas', 'Sorgenia', r'sorgenia'), ('Gas', 'UnoEnergy', r'uno\s*energy'), ('Luce e gas', 'Iren', r'\biren\b'),
    ('Gas', 'Eni Plenitude', r'plenitude|eni\s+gas'), ('Telefono', 'TIM', r'\btim\b|telecom'), ('Internet', 'Fastweb', r'fastweb'),
    ('Telefono', 'Vodafone', r'vodafone'), ('Telefono', 'WindTre', r'wind\s*tre|windtre'), ('Telefono', 'Iliad', r'iliad'),
    ('Acqua', 'Acquedotto', r'acquedott|acda\b|servizio\s+idrico'), ('Rifiuti', 'Rifiuti', r'\btari\b|rifiuti\s+urbani|cec\s+cuneo'),
    ('Riscaldamento', 'Combustibili', r'pellet|gasolio|gpl\b|legna|caldaia|stufa'),
]
ASSICURAZIONI = [('Prima', r'prima\s+assicurazion|primassicurazion|\bprima\.it\b|polizza\s+prima'), ('ITAS Mutua', r'\bitas\b'),
    ('Generali', r'generali'), ('Assimedici', r'assimedici'), ('Sigma Studi Assicurativi', r'sigma\s+studi'), ('Revo', r'\brevo\b|asme'),
    ('Quixa', r'quixa'), ('Allianz', r'allianz'), ('UnipolSai', r'unipol'), ('Reale Mutua', r'reale\s+mutua'), ('AXA', r'\baxa\b'),
    ('Cattolica', r'cattolica'), ('Zurich', r'zurich'), ('Groupama', r'groupama'), ('Vittoria', r'vittoria\s+assicurazion'),
    ('Linear', r'\blinear\b'), ('Genertel', r'genertel'), ('AmTrust', r'amtrust'), ('Lloyd\'s', r'lloyd')]

# ---------------------------------------------------------------- assegnazioni lette da Claude Code (2026-11-22)
# Enti e parole ricorrenti in «Altro» e nei «Dubbi», assegnati leggendo titoli ed esempi. (percorso, confidenza, motivo, regex)
# {an} = anno del documento. «Società e progetti» e le case non di proprietà sono proposte nuove (da confermare).
SP = '12 Lavoro e professione/Società e progetti'
ASSEGNAZIONI = [
    (f'{SP}/One Apple', 0.8, 'società One Apple (poliambulatorio via Pacini 22, Milano)', r'one\s*apple|via\s+pacini|lineadirettamed|cutrupi|laboratorio\s+cso|gattarello|sabbatini'),
    (f'{SP}/Mall-e', 0.8, 'progetto Mall-e / Ycare', r'mall.?e\b|mall_e|busoni|edoardo\s+landi|luca\s+barrile|movilli|ycare|davinci\s+salute|zelaschi|mekacher|t-share'),
    (f"{SP}/Immobiliare La – L'Arabi", 0.8, "società Immobiliare La / L'Arabi Sas", r"l.?arabi|immobiliare\s+la\b|bruno\s+luciano|bignami|disciplinare\s+6024|tergas"),
    (f'{SP}/Centraline idroelettriche', 0.8, 'centraline idroelettriche', r'idroelettric|centralin|turbin|hydro\b|salvagno|torrente\s+grana|pantidro|sprae\s+solare|canale\s+marchisa'),
    (f'{SP}/Ridentemente', 0.75, 'società Ridentemente', r'ridentemente'),
    (f'{SP}/LL Medical', 0.75, 'LL Medical', r'll\s+medical|simitecno'),
    (f'{SP}/Tamponi e screening COVID', 0.75, 'attività di tamponi e screening COVID', r'tampon[ei]|sierologic|screening\s+(covid|tamponi)|coronadiag|covid-?19.*test|test\s+antigenic'),
    (f'{SP}/Storie per tessere', 0.7, 'progetto «Storie per tessere» (documenti di persone accolte)', r'storie\s+per\s+tessere|caritas|progetto\s+sai\b|rimpatrio\s+assistito'),
    (f'{SP}/Fit and Go', 0.7, 'franchising Fit and Go', r'fit\s*and\s*go'),
    (f'{SP}/Investimenti e cripto', 0.7, 'investimenti (CAM.TV, LKSCOIN, ICO)', r'cam\.?tv|lkscoin|\bico\b|token\s+sale|graneris'),
    ('04 Banche e conti/Fideuram/Contratti', 0.75, 'Fideuram (Piero Carlini)', r'fideuram|carlini|pictet|portafoglio\s+omnia'),
    ('04 Banche e conti/N26/Contratti', 0.8, 'conto N26', r'\bn26\b'),
    ('05 Fisco e tasse/{an}/F24 e pagamenti', 0.85, 'F24 dello studio', r'\bf\s?24\b'),
    ('05 Fisco e tasse/{an}/Dichiarazioni', 0.75, 'commercialista (Ramero, Giordano, Pagani, Fedeli, Blengio)', r'nadia\s+ramero|giordano\s+commercialist|mauro\s+pagani|studio\s*fedeli|luca\s+fedeli|studi\s+di\s+settore|ritenute\s+da\s+versare|\bisa\s+20|quadro\s+[a-z]\b|certificazioni?\s+unic'),
    ('11 Legale e pratiche/Altre questioni legali/Corrispondenza', 0.75, 'avvocato, atto giudiziario o recupero crediti', r'\bavv\.|avvocat|citazione|pignorament|precetto|decreto\s+ingiuntivo|recupero\s+crediti|ge\.?\s?ri\b|blengio|parcella'),
    ('12 Lavoro e professione/Seminari', 0.75, 'formazione professionale', r'magister\s+formazione|medicina\s+estetica|master\s+di\s+ii|corso\s+ecm'),
    ('12 Lavoro e professione/Studio Cuneo/{an}', 0.7, 'collaborazioni professionali (compensi e affiliazioni)', r'\bclinn\b|you\s+medical|affiliazione\s+referente|compensi\s+e\s+contratto'),
    ('12 Lavoro e professione/Studio Cuneo/{an}', 0.8, 'buste paga dello studio', r'cedolin|busta\s+paga|\blul\b'),
    ('12 Lavoro e professione/Studio Cuneo/{an}', 0.8, 'cessione o gestione dello studio', r'cessione\s+(dello\s+)?studio|direttore\s+sanitario|bruno\s+di\s+clarafond|elve\s+group|gruppo\s+san\s+michele|biaggini|betapharm|hunova|iero\b|sbiancament|tealab|bongiovanni|hello\s+i\s+consulting|voucher\s+digitale'),
    ('11 Legale e pratiche/Altre questioni legali/Corrispondenza', 0.7, 'avvocato o atto legale', r'francesco\s+martini|avv\.?\s+piras|negoziazione\s+assistita|invito\s+a\s+negoziazione|istanza\s+di\s+annullamento|samantha\s+suvilla'),
    ('02 Casa e catasto/Milano – via Boccaccio 14/Atti e rogiti', 0.7, 'casa in affitto a Milano, via Boccaccio 14 (da confermare)', r'via\s+boccaccio'),
    ('02 Casa e catasto/Finale Ligure – via Santuario 41/Atti e rogiti', 0.7, 'seconda casa in affitto a Finale (da confermare)', r'via\s+santuario|finale\s+vacanze'),
    ('02 Casa e catasto/Cervasca – San Defendente/Atti e rogiti', 0.7, 'immobile di San Defendente di Cervasca (da confermare)', r'san\s+defendente'),
    ('02 Casa e catasto/Golfo Aranci/Condominio', 0.7, 'casa a Golfo Aranci, Condominio Eucalyptus (da confermare)', r'eucalyptus|marinella'),
    ('02 Casa e catasto/Ricerca e progetti di case/Lavori e preventivi', 0.65, 'ricerca casa, progetti e preventivi edilizi (da confermare)', r'appartamento\s+disponibile|proposta\s+immobiliare|cambio\s+casa|x-?lam|isolarelacasa|laib\s*architettura|di\s+nicuolo|render|albergo\s+con\s+giardino|moreno\s+vairo|acquaform'),
    ('07 Salute/Roberto Simondi/Referti', 0.85, 'cure di Roberto Simondi (tumore cerebrale)', r'glioblastom|burzynski|ucsf|cedars|st\.?\s*george|tumore\s+cerebrale|antineoplast|mgmt|craniotomia'),
    ('07 Salute/Isa Bergese/Referti', 0.7, 'salute di Isa Bergese (persona da confermare)', r'bergese'),
    ('07 Salute/Luca Simondi/Spese mediche/{an}', 0.65, 'spese di salute (naturopata, visite)', r'naturopat|consulenza\s+nutrizional'),
    ('12 Lavoro e professione/Seminari', 0.75, 'corsi e seminari', r'joosten|favaretto|noosoma|frusi|corso\s+.vendere|practitioner|webinar|masterclass|corso\s+filler'),
    ('08 Famiglia e scuola/Anna Simondi/Attività', 0.7, 'documenti di Anna Simondi', r'\banna\s+simondi\b'),
    ('08 Famiglia e scuola/Famiglia/Sport e certificati', 0.7, 'sport e attività dei figli', r'katakl|nuvole\s+asd|promosport|acrobatic|scacchi|danza'),
    ('06 Auto e veicoli/Noleggi e car sharing/Multe', 0.8, 'multa su un veicolo a noleggio', r'(share\s*now|free2move|bipicar|flexauto|leasys|noleggio).*(verbale|multa|sanzion|identificazione\s+del\s+conducente)|(verbale|multa|sanzion|identificazione\s+del\s+conducente).*(share\s*now|free2move|bipicar|flexauto|leasys|noleggio)'),
    ('06 Auto e veicoli/Noleggi e car sharing/Fatture e contratti', 0.8, 'car sharing e noleggi', r'share\s*now|free2move|bipicar|flexauto|\btier\b|leasys'),
    ('06 Auto e veicoli/Telepass/Contratti', 0.7, 'Telepass', r'telepass'),
    ('06 Auto e veicoli/Barca Sealine F37/Proprietà e libretto', 0.75, 'imbarcazione e patente nautica', r'sealine|patente\s+nautica|ziggurmare|union\s+yachts|blu\s+yachting|marine\s+services|imbarcazion|mano\s+marine|sailcharter|errepi'),
    ('13 Acquisti e garanzie/{an}', 0.75, 'vacanze, ristoranti, annunci e acquisti', r'subito\.it|via\s+subito|camping|hotel|albergo\s+trieste|ristorante|menù|menu\s+|case\s+vacanza|beautiful\s+houses|chalet|mallorca|maiorca|booking|airbnb|volo\b|traghett|moby|biglietto|amazon|ebay|aliexpress|garmin|scontrino|damilano|experience\s+car|libreria|brioschi'),
    ('12 Lavoro e professione/Studio Cuneo/{an}', 0.7, 'fornitori e servizi dello studio', r'centro\s+dentistico\s+simondi|studio\s+dentistico|marketing\s+studio|biglietti\s+visita|logo\b|sito\s+web|software\s+gestionale|xdent|dilapay|yorapp|ticket\s+restaurant|btomail|database\s+farmacie'),
]

# Materie precise che vincono sul solo nome dello studio (letto nei campioni: pignoramenti, banche, affitti, notai).
MATERIA_PRECISA = r'pignorament|precetto|decreto\s+ingiuntivo|tribunale|estratto\s+(di\s+)?conto|moratoria|\bmutuo\b|affitt|locazion|notai|procura|visura\s+catast|rogito|recupero\s+crediti|cartella\s+di\s+pagamento|agenzia\s+(delle\s+)?entrate|riscossione'
GENERICHE = {'fornitori e servizi dello studio', 'cessione o gestione dello studio'}

def assegnato(d, s, h, an):
    for perc, c, motivo, rx in ASSEGNAZIONI:
        if motivo in GENERICHE and re.search(MATERIA_PRECISA, h):
            continue
        if re.search(rx, h) or (c >= 0.75 and re.search(rx, s)):
            return (perc.replace('{an}', an), d.get('e') or '', c if re.search(rx, h) else c - 0.05, motivo, [])
    return None

# ---------------------------------------------------------------- utilità
def norm(s):
    return unicodedata.normalize('NFKC', str(s or '')).lower()

def testo(d):
    return norm(' '.join(str(d.get(k) or '') for k in ('t', 'ti', 'e', 'o', 'm', 'n', 'x', 'p')))

def intestazione(d):  # titolo, tipo, ente, oggetto, nome: le cose scritte per il documento
    return norm(' '.join(str(d.get(k) or '') for k in ('t', 'ti', 'e', 'o', 'n', 'p')))

def primo(lista, s):
    for voce in lista:
        if re.search(voce[-1] if isinstance(voce[-1], str) else voce[1], s):
            return voce
    return None

def cerca(lista, s):
    for voce in lista:
        nome, rx = voce[0], voce[1]
        if re.search(rx, s):
            return voce
    return None

def anno(d):
    for k in ('dd', 'ed'):
        v = str(d.get(k) or '')
        if re.match(r'^(19[89]\d|20[0-3]\d)', v):
            return v[:4]
    return None

def data(d):
    v = str(d.get('dd') or '')
    if re.match(r'^\d{4}-\d{2}-\d{2}$', v) and '1980' <= v[:4] <= '2031':
        return v
    v = str(d.get('ed') or '')
    if re.match(r'^\d{4}-\d{2}-\d{2}$', v):
        return v
    return None

def pulito(s, n=40):
    s = re.sub(r'[/\\:*?"<>|]', '-', str(s or ''))
    s = re.sub(r'\s+', ' ', s).strip(' .-–')
    return s[:n].rstrip(' .-–')

def token(s, parole=3, n=28):
    """«Banca Alpi Marittime» → «Banca-Alpi-Marittime» (accenti tenuti, niente caratteri vietati)."""
    s = re.sub(r'[/\\:*?"<>|_.,;()\[\]{}\'’`]', ' ', str(s or ''))
    w = [x for x in re.split(r'[\s–—-]+', s) if x]
    out = '-'.join(x[:1].upper() + x[1:] for x in w[:parole])
    return out[:n].rstrip('-') or 'Documento'

# ---------------------------------------------------------------- tipo di documento (vocabolario chiuso)
TIPI = [
    ('CartaIdentita', r"carta\s+d.?identit|\bc\.?i\.?e\b|documento\s+d.?identit|documenti\s+d.?identit"), ('Passaporto', r'passaport'),
    ('Patente', r'\bpatente\b(?!\s+d.?impresa)'), ('TesseraSanitaria', r'tessera\s+sanitaria'), ('CodiceFiscale', r'codice\s+fiscale'),
    ('F24', r'\bf\s?24\b|modello\s+f24|delega\s+f24'), ('CU', r'certificazione\s+unica|\bcu\s?20\d\d\b'),
    ('Dichiarazione', r'dichiarazione|\b730\b|modello\s+redditi|unico\s+20|\bisa\b'), ('Visura', r'visura'), ('Planimetria', r'planimetri'),
    ('Rogito', r'rogito|compravendita'), ('DecretoIngiuntivo', r'decreto\s+ingiuntivo|\bd\.\s?i\.\s?\d|\bdi\s+\d+/20'),
    ('Precetto', r'precetto'), ('Pignoramento', r'pignorament'), ('Ricorso', r'ricorso'), ('Sentenza', r'sentenza|ordinanza'),
    ('Diffida', r'diffida|messa\s+in\s+mora'), ('Sollecito', r'sollecit'), ('Cartella', r'cartella\s+(di\s+)?pagamento|intimazione'),
    ('Avviso', r'avviso|preavviso|accertamento'), ('Multa', r'verbale.*(violazion|codice\s+della\s+strada)|multa|contravvenzion|polizia\s+(municipale|locale)'),
    ('Verbale', r'verbale'), ('Bollo', r'bollo\s+auto|tassa\s+automobilistica'), ('Revisione', r'revisione\s+(auto|veicolo)|\brevisione\b'),
    ('Libretto', r'libretto|carta\s+di\s+circolazione'), ('Polizza', r'polizza|certificato\s+(di\s+)?assicurazion'), ('Quietanza', r'quietanza'),
    ('Sinistro', r'sinistro|denuncia\s+danni'), ('Referto', r'referto|esito\s+esame|risonanza|\btac\b|ecografia'),
    ('Prescrizione', r'prescrizione|piano\s+terapeutico'), ('Ricetta', r'ricetta|\bnre\b'), ('Bolletta', r'bolletta|fattura\s+(luce|gas|energia|telefon)'),
    ('Estratto', r'estratto\s+(di\s+)?conto|rendiconto|account.?statement'), ('Mutuo', r'mutuo'), ('Finanziamento', r'finanziament|prestito'),
    ('Carta', r'carta\s+di\s+credito|carta\s+prepagata'), ('Bonifico', r'bonific'), ('Contratto', r'contratto|accordo|condizioni\s+generali'),
    ('Preventivo', r'preventivo|offerta|proposta'), ('Fattura', r'fattura|nota\s+di\s+credito|parcella'), ('Ricevuta', r'ricevuta|scontrino|conferma\s+(d.?ordine|di\s+pagamento|pagamento)|biglietto'),
    ('Certificato', r'certificat|attestat'), ('Perizia', r'perizia|stima'), ('Relazione', r'relazione'), ('Iscrizione', r'iscrizion'),
    ('Pagella', r'pagella|scheda\s+di\s+valutazione'), ('Garanzia', r'garanzia'), ('Manuale', r'manuale|istruzioni'), ('Foto', r'\bfoto|fotografi|immagine'),
    ('Lettera', r'lettera'), ('Comunicazione', r'comunicazion|circolare|newsletter|informativ'), ('Modulo', r'modulo|modello'),
]
TIPO_DA_CATALOGO = {'fattura': 'Fattura', 'contratto': 'Contratto', 'preventivo': 'Preventivo', 'atto': 'Atto', 'certificato': 'Certificato',
    'estratto conto': 'Estratto', 'ricevuta': 'Ricevuta', 'sollecito': 'Sollecito', 'dichiarazione': 'Dichiarazione', 'avviso di pagamento': 'Avviso',
    'f24': 'F24', 'visura': 'Visura', 'diffida': 'Diffida', 'foto': 'Foto', 'prescrizione': 'Prescrizione', 'comunicazione': 'Comunicazione',
    'modulo': 'Modulo', 'offerta': 'Preventivo', 'pubblicità': 'Comunicazione', 'documento di identità': 'CartaIdentita'}

def tipo_di(d):
    s = intestazione(d)
    for t, rx in TIPI:
        if re.search(rx, s):
            return t
    t = TIPO_DA_CATALOGO.get(norm(d.get('ti')))
    if t:
        return t
    mi = norm(d.get('mi'))
    if mi.startswith('image/') or mi.startswith('video/'):
        return 'Foto'
    return 'Documento'

# ---------------------------------------------------------------- categorie
def categoria(d, pratiche):
    r = _categoria(d, pratiche)
    if r[0].startswith('99 ') or r[2] < 0.6:
        s, h = testo(d), intestazione(d)
        x = assegnato(d, s, h, anno(d) or 'Senza anno')
        if x and x[2] >= r[2]:
            return x
    return r

def _categoria(d, pratiche):
    """→ (percorso sotto Archivio personale, soggetto, confidenza, motivo, scorciatoie)"""
    fa = d['fa']
    s = testo(d)
    h = intestazione(d)
    a = anno(d)
    an = a or 'Senza anno'
    t = tipo_di(d)
    conf = 0.9 if not d.get('da') else 0.8  # catalogato solo a regole: un po' meno sicuro
    persona_doc = d.get('p') if d.get('p') in FAMIGLIA else None

    def persona():
        if persona_doc:
            return persona_doc
        p = cerca(PERSONE, h) or cerca(PERSONE, s)
        return p[0] if p else None

    pr = pratiche.get(d.get('pr') or '')
    # --- 11 Legale e pratiche: pratica del catalogo, se legale
    def legale(ctx):
        nome = pr['t'] if pr and pr['f'] == 'legale' else None
        if not nome:
            for pp in pratiche.values():
                if pp['f'] == 'legale' and pp.get('chiave') and re.search(pp['chiave'], s):
                    nome = pp['t']; break
        sub = 'Atti' if re.search(r'decreto|ricorso|precetto|pignorament|sentenza|ordinanza|citazione|comparsa|memoria|opposizion|atto\b|udienza|ruolo|r\.?g\.?e?\s*\d', h) else \
              'Pagamenti' if re.search(r'bonific|pagament|ricevuta|fattura|parcella|quietanza|f24', h) else \
              'Consulenti' if re.search(r'avv\.|avvocat|studio\s+legale|consulent|perito|ctu|ctp|commercialist|mandato|procura', h) else 'Corrispondenza'
        if nome:
            return (f'11 Legale e pratiche/{pulito(nome, 48)}/{sub}', nome, conf, f'pratica legale «{nome}»' + ctx, [])
        return (f'11 Legale e pratiche/Altre questioni legali/{sub}', d.get('e') or 'Legale', min(conf, 0.7), 'documento legale senza pratica riconosciuta' + ctx, [])

    # --- assegnazioni lette a mano: valgono per i fascicoli generici (altro, corrispondenza, pubblicità, foto)
    if fa in ('altro', 'corrispondenza', 'pubblicita', 'foto_video'):
        x = assegnato(d, s, h, an)
        if x:
            return x
    # --- regole per fascicolo
    if fa == 'identita':
        if re.search(DIPENDENTI, s):
            return ('12 Lavoro e professione/Studio Cuneo', d.get('p') or 'Dipendente', 0.8, 'documento di un dipendente dello studio', [])
        if re.search(r'cartella\s+di\s+pagamento|avviso\s+di\s+addebito|rateazione|inps', h):
            return (f'05 Fisco e tasse/{an}/Avvisi e cartelle', 'Agenzia Riscossione', 0.8, 'cartella o avviso, non un documento d\'identità', [])
        p = persona()
        if p:
            return (f'01 Identità e documenti/{p}', p, conf if t in ('CartaIdentita', 'Passaporto', 'Patente', 'TesseraSanitaria', 'CodiceFiscale') else conf - 0.1, f'documento d\'identità di {p}', [])
        if re.search(r'storie\s+per\s+tessere|storia\s+personale|accoglienza|\bsai\b|oim\b|rimpatrio', s) or t in ('CartaIdentita', 'Foto'):
            return ('99 Da verificare/Dubbi', d.get('p') or 'Persona', 0.55, 'documento d\'identità di una persona non della famiglia (progetto «Storie per tessere»?)', [])
        return ('99 Da verificare/Dubbi', 'Identità', 0.5, 'documento d\'identità senza persona riconosciuta', [])

    if fa == 'successione':
        defunto = 'Anna Bruna Levrone' if re.search(r'levrone|mamma|madre', s) else 'Roberto Simondi' if re.search(r'roberto|padre|papà', s) else None
        sub = 'Dichiarazione' if re.search(r'dichiarazione|successione', h) else 'Atti notarili' if re.search(r'notai|atto|divisione|notorietà', h) else \
              'Volture' if re.search(r'voltur|catast', h) else 'Banche e rapporti' if re.search(r'banca|conto|inps|pensione|enel|indebito', h) else 'Dichiarazione'
        if defunto:
            return (f'03 Successione/{defunto}/{sub}', defunto, conf, f'successione di {defunto}', [])
        return ('99 Da verificare/Dubbi', 'Successione', 0.55, 'successione senza defunto riconosciuto', [])

    if fa == 'immobili':
        im = cerca(IMMOBILI, h) or cerca(IMMOBILI, s)
        sub = 'Atti e rogiti' if re.search(r'rogito|compravendita|atto|notai|donazion|ipotec|divisione', h) else \
              'Catasto e visure' if re.search(r'visura|catast|planimetri|mappa|ispezion|docfa|voltura|accatast', h) else \
              'Condominio' if re.search(r'condomin|assemblea|amministrator|millesim|consuntivo|preventivo\s+condomin', h) else \
              'Lavori e preventivi'
        if im:
            c = conf if im[2] else min(conf, 0.75)
            return (f'02 Casa e catasto/{im[0]}/{sub}', im[0], c, f'immobile {im[0]}' + ('' if im[2] else ' (da confermare)'), [])
        if re.search(r'studio|centro\s+dentistico|corso\s+brunet|quintino\s+sella', s):
            return ('12 Lavoro e professione/Studio Cuneo', 'Studio', 0.7, 'lavori o locali dello studio', [])
        if re.search(r'centralina|idroelettric|torrente|canale', s):
            return ('02 Casa e catasto/Centraline idroelettriche/' + sub, 'Centraline', 0.7, 'centralina idroelettrica (da confermare come immobile)', [])
        return ('99 Da verificare/Dubbi', d.get('e') or 'Immobile', 0.55, 'immobile non riconosciuto negli elenchi', [])

    if fa == 'conti':
        if re.search(r'\bavv\.|avvocat|parcella|decreto\s+ingiuntivo|pignorament|precetto|citazione', h):
            return legale(' (banca)')
        b = cerca(BANCHE, h) or cerca(BANCHE, s)
        sub = 'Mutui e finanziamenti' if re.search(r'mutuo|finanziament|prestito|piano\s+di\s+ammortamento|rata', h) else \
              'Carte' if re.search(r'carta\s+di\s+credito|carta\s+prepagata|\bcarta\b', h) else \
              'Contratti' if re.search(r'contratto|condizioni|apertura\s+conto|foglio\s+informativo|estinzione', h) else \
              f'Estratti conto/{an}'
        if b:
            return (f'04 Banche e conti/{b[0]}/{sub}', b[0], conf if b[2] else min(conf, 0.75), f'banca {b[0]}' + ('' if b[2] else ' (da confermare)'), [])
        if re.search(r'centro\s+dentistico|fornitor|straumann|neomed|biologitech|ridentemente', s):
            return ('12 Lavoro e professione/Studio Cuneo/' + an, d.get('e') or 'Studio', 0.7, 'estratto conto di un fornitore dello studio', [])
        return ('99 Da verificare/Dubbi', d.get('e') or 'Banca', 0.55, 'conto o banca non riconosciuti', [])

    if fa == 'fiscale':
        if re.search(r'\bavv\.|avvocat|citazione|decreto\s+ingiuntivo|pignorament', h):
            return legale(' (fisco)')
        sub = 'F24 e pagamenti' if re.search(r'\bf\s?24|delega|pagamento|quietanza', h) else \
              'IMU e tributi locali' if re.search(r'\bimu\b|\btari\b|\btasi\b|tributi\s+locali|cosap|canone\s+unico', h) else \
              'Avvisi e cartelle' if re.search(r'avviso|cartella|accertamento|riscossione|intimazione|rottamazione|sollecito|comunicazione\s+di\s+irregolarit', h) else \
              'Spese detraibili' if re.search(r'detraibil|spese\s+mediche|scontrin|ricevute\s+fiscal', h) else 'Dichiarazioni'
        return (f'05 Fisco e tasse/{an}/{sub}', 'Fisco', conf if a else conf - 0.15, 'fisco: ' + sub.lower(), [])

    if fa == 'veicoli':
        targa = re.search(r'\b([A-Z]{2})\s?(\d{3})\s?([A-Z]{2})\b', ' '.join(str(d.get(k) or '') for k in ('t', 'o', 'x')))
        tg = ''.join(targa.groups()) if targa else None
        sub = 'Multe' if re.search(r'verbale|multa|sanzion|contravvenz|polizia|pedagg|ztl', h) else 'Bollo' if re.search(r'bollo|tassa\s+auto', h) else \
              'Revisione' if re.search(r'revisione', h) else 'Manutenzione' if re.search(r'tagliando|manutenz|officina|gomm|riparaz|carrozz', h) else 'Proprietà e libretto'
        if re.search(r'polizza|rca|assicuraz|certificato\s+di\s+assicuraz|quietanza', h):
            comp = cerca(ASSICURAZIONI, s)
            v = VEICOLI.get(tg)
            return (f'09 Assicurazioni/Auto/{token((comp[0] if comp else "Compagnia") + " " + (tg or ""), 4, 40)}', comp[0] if comp else 'Assicurazione', conf,
                    'polizza auto (cartella principale Assicurazioni, scorciatoia nel veicolo)', [f'06 Auto e veicoli/{v}/Proprietà e libretto'] if v else [])
        if re.search(BARCA, s):
            return (f'06 Auto e veicoli/Barca Sealine F37/{sub if sub != "Proprietà e libretto" else "Proprietà e libretto"}', 'Barca', 0.75, 'imbarcazione o patente nautica (da confermare)', [])
        if tg in VEICOLI:
            return (f'06 Auto e veicoli/{VEICOLI[tg]}/{sub}', VEICOLI[tg], conf, f'veicolo {tg}', [])
        if re.search(NOLEGGI, s) or tg:
            return (f'06 Auto e veicoli/Noleggi e car sharing/{sub}', d.get('e') or 'Noleggio', 0.75, 'noleggio o car sharing (veicolo non di proprietà)', [])
        return ('99 Da verificare/Dubbi', d.get('e') or 'Veicolo', 0.55, 'veicolo non riconosciuto', [])

    if fa == 'sanitario_famiglia':
        p = persona()
        sub = 'Referti' if re.search(r'referto|esame|risonanza|\btac\b|pet|relazione|istolog|ecograf', h) else \
              'Prescrizioni' if re.search(r'ricett|prescri|nre\b|piano\s+terapeutico|terapia', h) else \
              f'Spese mediche/{an}' if re.search(r'fattura|ricevuta|bonific|preventivo|pagament', h) else 'Referti'
        if p:
            return (f'07 Salute/{p}/{sub}', p, conf, f'salute di {p}', [])
        if re.search(r'bergese', s):
            return (f'07 Salute/Isa Bergese/{sub}', 'Isa Bergese', 0.7, 'salute di Isa Bergese (persona da confermare)', [])
        return ('99 Da verificare/Dubbi', 'Salute', 0.55, 'documento sanitario senza persona della famiglia', [])

    if fa == 'famiglia_scuola':
        if re.search(r'universit|laurea|esame\s+di\s+stato|ordine\s+dei\s+medici|omceo|\btesi\b|odontoiatri|\becm\b|corso\s+di\s+(laurea|perfezionamento)|congresso|curriculum|candidat', h) and not re.search(r'junior|bambin|scacchi|castelletto|scuola\s+(primaria|media)', h):
            return ('12 Lavoro e professione/Docenza e candidature', 'Luca Simondi', 0.75, 'formazione o carriera di Luca', [])
        if re.search(r'mult|identificazione\s+del\s+conducente|veicolo|targa', h):
            return ('06 Auto e veicoli/Noleggi e car sharing/Multe', 'Noleggio', 0.7, 'multa di un veicolo', [])
        p = persona()
        sub = 'Scuola' if re.search(r'scuol|istitut|mensa|classe|primaria|secondaria|leopardi|soleri|libri|homeschool|nulla\s+osta|iscrizione', h) else \
              'Sport e certificati' if re.search(r'sport|promosport|pallavolo|basket|danza|sci\b|skipass|tesseramento|certificat|katakl|scacchi|camp', h) else 'Attività'
        if p in ('Martina Simondi', 'Giulia Simondi', 'Anna Simondi', 'Luca Simondi'):
            return (f'08 Famiglia e scuola/{p}/{sub}', p, conf, f'famiglia: {p}', [])
        return (f'08 Famiglia e scuola/Famiglia/{sub}', 'Famiglia', 0.65, 'famiglia, persona non indicata nel documento', [])

    if fa == 'assicurazioni':
        comp = cerca(ASSICURAZIONI, h) or cerca(ASSICURAZIONI, s)
        ramo = 'RC professionale' if re.search(r'rc\s+profession|responsabilit.\s+civile\s+profession|colpa\s+grave|odontoiatr|assimedici|tutela\s*unica|tutelunica|tutela\s+legale|professioni\b', s) else \
               'Auto' if re.search(r'\brca\b|\bauto(mobile|veicol)?\b|veicol|targa|\b[a-z]{2}\d{3}[a-z]{2}\b', s) else \
               'RC professionale' if re.search(r'medic|sigma|\brevo\b|asme', s) else \
               'Casa' if re.search(r'casa|abitazion|fabbricat|incendio|furto|condomin', s) else \
               'Vita' if re.search(r'\bvita\b|\btcm\b|caso\s+morte', s) else \
               'Salute' if re.search(r'salute|sanitari|infortun|malattia', s) else None
        if re.search(r'sinistro|danni|perizia|risarciment', h) and re.search(r'avv|legale|causa', s):
            return legale(' (sinistro)')
        if ramo and comp:
            num = re.search(r'polizza\s*(n\.?|nr\.?|numero)?\s*([A-Z0-9]{5,})', ' '.join(str(d.get(k) or '') for k in ('t', 'o', 'x')), re.I)
            nome = comp[0] + (' ' + num.group(2) if num else '')
            sc = []
            if ramo == 'Auto':
                tg = re.search(r'\b([A-Z]{2}\d{3}[A-Z]{2})\b', ' '.join(str(d.get(k) or '') for k in ('t', 'o', 'x')))
                if tg and tg.group(1) in VEICOLI:
                    sc = [f'06 Auto e veicoli/{VEICOLI[tg.group(1)]}/Proprietà e libretto']
            return (f'09 Assicurazioni/{ramo}/{comp[0]}', comp[0], conf, f'polizza {ramo.lower()} {comp[0]}' + (f' n. {num.group(2)}' if num else ''), sc)
        if ramo:
            return (f'09 Assicurazioni/{ramo}/Altre compagnie', d.get('e') or 'Assicurazione', min(conf, 0.75), f'assicurazione {ramo.lower()}, compagnia non riconosciuta', [])
        return ('99 Da verificare/Dubbi', d.get('e') or 'Assicurazione', 0.55, 'assicurazione: ramo non riconosciuto', [])

    if fa in ('utenze', 'riscaldamento'):
        u = cerca([(f'{x[0]} – {x[1]}', x[2]) for x in UTENZE], h) or cerca([(f'{x[0]} – {x[1]}', x[2]) for x in UTENZE], s)
        if u:
            return (f'10 Utenze/{u[0]}/{an}', u[0].split(' – ')[1], conf, f'utenza {u[0]}', [])
        return (f'10 Utenze/{token(d.get("e") or "Altro fornitore", 3, 40)}/{an}', d.get('e') or 'Utenza', min(conf, 0.7), 'utenza, fornitore non in elenco', [])

    if fa == 'legale':
        return legale('')

    if fa == 'previdenza':
        return ('12 Lavoro e professione/Ordine Medici', 'ENPAM', conf, 'previdenza ENPAM / Ordine dei Medici', [])
    if fa == 'formazione':
        if re.search(r'docenz|insegnament|lezion|candidatur|curriculum|universit|laurea|master|bando|concorso', h):
            return ('12 Lavoro e professione/Docenza e candidature', 'Luca Simondi', conf - 0.05, 'docenza, studi o candidature', [])
        return ('12 Lavoro e professione/Seminari', d.get('e') or 'Corso', conf, 'corso, congresso o ECM', [])
    if fa in ('studio_fornitori', 'studio_fatture_emesse', 'personale_studio'):
        studio = 'Studio Neive' if re.search(r'neive', s) else 'Studio Cuneo'
        if fa == 'personale_studio' and re.search(r'curriculum|candidatur|\bcv\b', h) and not re.search(r'dipendent|assunzion|busta|cedolin', h):
            return (f'12 Lavoro e professione/{studio}/Candidature', d.get('e') or 'Candidato', conf - 0.05, 'candidature per lo studio', [])
        return (f'12 Lavoro e professione/{studio}/{an}', d.get('e') or 'Studio', conf, f'studio ({fa.replace("_", " ")})', [])
    if fa in ('acquisti', 'servizi'):
        return (f'13 Acquisti e garanzie/{an}', d.get('e') or 'Acquisto', conf - (0.1 if fa == 'servizi' else 0), 'acquisto o servizio', [])

    # --- pubblicità, foto, corrispondenza, altro: dal contenuto
    return dal_contenuto(d, s, h, an, conf, pratiche, legale, persona)


REGOLE_CONTENUTO = [  # (percorso, motivo, regex sull'intestazione)
    ('studio', 'studio dentistico: fornitori, materiali, personale', r'centro\s+dentistic|studio\s+(dentistico|simondi)|odontoiatr|implant|straumann|dental|dentale|ortodon|allineator|riunito|autoclave|radiograf|fornitore|materiale\s+(dentale|implantare)|ridentemente|neomed|biologitech|simitecno|ll\s+medical|primo\s+group|dentist'),
    ('fisco', 'fisco', r'\bf\s?24\b|cartella\s+di\s+pagamento|agenzia\s+(delle\s+)?entrate|riscossione|\b730\b|modello\s+redditi|dichiarazione\s+dei\s+redditi|\bimu\b|\btari\b|cartella\s+di\s+pagamento|commercialist|iva\b|bilancio|ammortament|certificazione\s+unica|pvc\b'),
    ('legale', 'legale', r'decreto\s+ingiuntivo|precetto|pignorament|tribunale|ricorso|avv\.|avvocat|diffida|sentenza|giudice|udienza|esecuzione\s+immobiliare|studio\s+legale|opposizion|sovraindebitament|\bocc\b|concordato'),
    ('banca', 'banca o conto', r'estratto\s+(di\s+)?conto|\biban\b|bonific|mutuo|finanziament|carta\s+di\s+credito|revolut|intesa|banca|azzoaglio|alpi\s+marittime|kerdos'),
    ('immobile', 'casa o immobile', r'visura|catast|planimetri|rogito|condomin|immobil|affitto|locazion|piccona|boves|pradleves|beinette|galileo\s+ferraris|geometra|architett|ristrutturaz|cappotto|preventivo\s+lavori'),
    ('veicolo', 'veicolo', r'\b[a-z]{2}\d{3}[a-z]{2}\b|automobil|veicol|bollo\s+auto|revisione|tagliando|carrozzeria|share\s*now|free2move|car\s*sharing|multa|verbale.*strada|pedagg|telepass|sealine|imbarcazion|yacht|barca\b|nautic'),
    ('assicurazione', 'assicurazione', r'polizza|assicurazion|\brca\b|sinistro|quietanza'),
    ('utenza', 'utenza', r'bolletta|fornitura\s+(di\s+)?(energia|gas|luce)|\bpod\b|\bpdr\b|edison|enel|sorgenia|union\s+energia|uno\s*energy|fastweb|telecom|\btim\b|vodafone|acquedott'),
    ('salute', 'salute', r'referto|ricetta|esami\s+del\s+sangue|ospedal|clinica|visita\s+(medica|specialistica)|asl\b|farmac|terapia'),
    ('scuola', 'famiglia e scuola', r'scuol|istituto\s+comprensivo|mensa|leopardi|promosport|asilo|classe\s+\d|compiti|registro\s+elettronico|figli|martina|giulia'),
    ('formazione', 'corsi e congressi', r'\becm\b|congress|corso\s+(di|in)|seminari|webinar|master|workshop|simposio|attestato\s+di\s+partecipazione'),
    ('lavoro', 'Ordine dei Medici, ENPAM, candidature', r'omceo|ordine\s+dei\s+medici|enpam|curriculum|candidatur|docenz'),
    ('acquisti', 'acquisti e garanzie', r'ordine\s+n|conferma\s+d.?ordine|amazon|ebay|subito\.it|acquisto|scontrino|garanzia|spedizion|consegna|ricevuta\s+di\s+pagamento|biglietto|prenotazion|booking|hotel|volo|traghett|abbonament|iscrizione\s+al\s+servizio'),
]

def dal_contenuto(d, s, h, an, conf, pratiche, legale, persona):
    fa = d['fa']
    base = 0.75 if not d.get('da') else 0.65
    if fa == 'foto_video':
        p = persona()
        if re.search(r'studio|paziente|radiograf|clinic|implant|dental|bocca|denti', h):
            return ('12 Lavoro e professione/Studio Cuneo/Foto', 'Studio', 0.65, 'foto di lavoro (studio)', [])
        return (f'08 Famiglia e scuola/{p if p in FAMIGLIA else "Famiglia"}/Attività', p or 'Famiglia', 0.62, 'foto o video personale', [])
    if fa == 'pubblicita':
        if re.search(REGOLE_CONTENUTO[0][2], h):
            return ('12 Lavoro e professione/Studio Cuneo/Offerte fornitori', d.get('e') or 'Fornitore', 0.65, 'pubblicità o offerta per lo studio', [])
        return (f'13 Acquisti e garanzie/{an}', d.get('e') or 'Offerta', 0.6, 'pubblicità o offerta non richiesta', [])
    punti = Counter()
    for chiave, _, rx in REGOLE_CONTENUTO:
        if re.search(rx, h):
            punti[chiave] += 2
        n = len(re.findall(rx, norm(d.get('x'))[:500]))
        punti[chiave] += min(n, 2) * 0.5
    if d.get('pr') and pratiche.get(d['pr'], {}).get('f') == 'legale':
        punti['legale'] += 3
    if not punti:
        return ('99 Da verificare/Dubbi', d.get('e') or 'Documento', 0.4, 'nessun indizio sul contenuto', [])
    (best, pb), *resto = punti.most_common(2) + [(None, 0)]
    secondo = resto[0][1] if resto else 0
    margine = 0.12 if pb - secondo >= 2 else 0.05 if pb > secondo else -0.1
    c = max(0.35, min(0.88, base + margine + (0.05 if pb >= 3 else 0)))
    motivo = dict((k, m) for k, m, _ in REGOLE_CONTENUTO)[best] + ' (dal contenuto)'
    finto = dict(d)
    mappa = {'studio': 'studio_fornitori', 'fisco': 'fiscale', 'banca': 'conti', 'immobile': 'immobili', 'veicolo': 'veicoli', 'assicurazione': 'assicurazioni',
             'utenza': 'utenze', 'salute': 'sanitario_famiglia', 'scuola': 'famiglia_scuola', 'formazione': 'formazione', 'lavoro': 'previdenza', 'acquisti': 'acquisti'}
    if best == 'legale':
        p, sog, c2, mot, sc = legale(' (dal contenuto)')
        return (p, sog, min(c, c2), mot, sc)
    if best == 'lavoro' and re.search(r'curriculum|candidatur|docenz', h):
        return ('12 Lavoro e professione/Docenza e candidature', 'Luca Simondi', c, motivo, [])
    finto['fa'] = mappa[best]
    finto['da'] = True
    p, sog, c2, mot, sc = categoria(finto, pratiche)
    if p.startswith('99 '):
        return (p, sog, min(c2, 0.5), motivo + ', ma ' + mot, sc)
    return (p, sog, round(min(c, c2), 2), motivo + ' → ' + mot, sc)

# ---------------------------------------------------------------- nome del file
PAROLE_VUOTE = set('il lo la i gli le un una di da del della dei delle per con su in a al alla e ed o od – - n. nr n del dal agli alle ai sul sulla tra fra'.split())

def dettaglio(d, tipo, soggetto):
    t = str(d.get('t') or d.get('n') or '')
    t = re.sub(r'\.[a-z0-9]{2,5}$', '', t, flags=re.I)
    via = set(norm(x) for x in re.split(r'[\s–—-]+', soggetto or '') if x)
    via |= {norm(tipo)}
    parole = []
    for w in re.split(r'[\s–—_/,;:()\[\]"«»]+', t):
        w2 = norm(w).strip('.-')
        if not w2 or w2 in PAROLE_VUOTE or w2 in via or len(w2) < 2:
            continue
        if re.match(r'^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$', w2):
            continue
        parole.append(w.strip('.-'))
        if len(parole) == 4:
            break
    return token(' '.join(parole), 4, 34) if parole else 'Documento'

def nome_file(d, tipo, soggetto, ext):
    dt = data(d) or anno(d) or 'senza-data'
    sog = token(soggetto, 3, 26)
    det = dettaglio(d, tipo, soggetto)
    base = f'{dt}_{tipo}_{sog}_{det}'
    massimo = 90 - len(ext)
    if len(base) > massimo:
        base = base[:massimo].rstrip('-_')
    return base + ext

# ---------------------------------------------------------------- piano

# ---------------------------------------------------------------- correzioni dopo la rilettura (Claude Code, 2026-11-22)
# Lette a mano le cartelle grandi (Studio Cuneo, Dichiarazioni, Famiglia, Acquisti): errori ricorrenti corretti qui.
# (regex sul titolo, percorso, confidenza, motivo). Vince la prima. {an} = anno del documento.
PRIMO = '11 Legale e pratiche/Centri Dentistici Primo – opposizioni ai D.I. (g'
CORREZIONI = [
    (r'modello\s+consenso\s+informato|modulo\s+.\s*raccolta\s+anamnesi', '12 Lavoro e professione/Studio Cuneo/Modulistica', 0.85, 'moduli in bianco dello studio (non clinici)'),
    (r'(stl|anatomy).*giulia\s+simondi|giulia\s+simondi.*(stl|anatomy)', '07 Salute/Giulia Simondi/Referti', 0.8, 'scansioni dentali di Giulia'),
    (r'(stl|anatomy).*martina\s+simondi|martina\s+simondi.*(stl|anatomy)', '07 Salute/Martina Simondi/Referti', 0.8, 'scansioni dentali di Martina'),
    (r'ucsf|glioblastom', '07 Salute/Roberto Simondi/Referti', 0.85, 'cure di Roberto Simondi'),
    (r'bergese', '07 Salute/Isa Bergese/Referti', 0.7, 'salute di Isa Bergese (persona da confermare)'),
    (r'\bfile\s+stl\b.*pazient|paziente\s+\w|panoramiche|relazione\s+clinica|file\s+protesico|anagrafica\s+pazienti|^pazienti\s|x\s*dent\s+pazienti|_consenso_\d|scansioni\s+\d|maxillary|mandibular', '99 Da verificare/Possibili documenti clinici', 0.5,
     'possibile documento clinico di un paziente: va nel fascicolo clinico, non lo sposto'),
    (r'pignorament|543\s*c\.?p\.?c|atti\s+del\s+pignoramento', '11 Legale e pratiche/Pignoramenti presso terzi sui conti di Luca (202/Atti', 0.8, 'pignoramento presso terzi'),
    (r'simondi\s*(\+\s*1\s*)?/\s*primo|primo\s*/\s*simondi|risposta\s+contestazioni\s+primo|manleva.*primo', PRIMO + '/Atti', 0.8, 'causa con Centri Dentistici Primo'),
    (r'american\s+express', '04 Banche e conti/American Express/Contratti', 0.85, 'carta American Express'),
    (r'vivid\s+money|rendiconto\s+cripto', '12 Lavoro e professione/Società e progetti/Investimenti e cripto', 0.8, 'investimenti e cripto'),
    (r'assimedici', '09 Assicurazioni/RC professionale/Assimedici', 0.85, 'polizza RC professionale Assimedici'),
    (r'club\s+medici|amtrust', '09 Assicurazioni/RC professionale/AmTrust', 0.85, 'polizza RC professionale AmTrust'),
    (r'odontoflex', '09 Assicurazioni/RC professionale/Odontoflex', 0.8, 'polizza RC professionale Odontoflex'),
    (r'avviso\s+di\s+addebito\s+inps|provvedimento\s+di\s+rateazione|regolamento\s+rateazioni|rateizzazione\s+(irpef|cartella)|avviso\s+di\s+intimazione', '05 Fisco e tasse/{an}/Avvisi e cartelle', 0.85, 'avviso o rateazione fiscale'),
    (r"carta\s+d.identit.\s+–\s+luca|estratto\s+di\s+nascita", '01 Identità e documenti/Luca Simondi', 0.85, 'documento di identità di Luca'),
    (r'appunti\s+(di\s+)?(anatomia|studio|protesi)|domande\s+di\s+anatomia|tesi\s+di\s+laurea|indice\s+tesi|riassunto\s+tesi|bibliografia\s+tesi|conferma\s+titolo\s+di\s+studio|dichiarazione\s+validit.\s+corsi|tesionline|piano\s+di\s+studi|esame\s+di\s+stato|convalida\s+esami|congedo\s+in\s+arrivo|trasferimento\s+chieti|universit.\s+degli\s+studi\s+di\s+pavia', '12 Lavoro e professione/Docenza e candidature', 0.85, 'studi universitari di Luca'),
    (r'articolo\s+scientifico.*(ortodont|impiant)|corrosione\s+dei\s+metalli', '12 Lavoro e professione/Seminari', 0.8, 'articolo scientifico di odontoiatria'),
    (r'eicosanoidi|cancer\s+convention|oncologia\s+complementare|onkologie', '07 Salute/Roberto Simondi/Referti', 0.7, 'ricerche sulle cure di Roberto Simondi'),
    (r'relata\s+verbale|multa\s+francia|sanzioni\s+prese\s+con\s+la\s+fiat', '06 Auto e veicoli/Noleggi e car sharing/Multe', 0.8, 'multa su un veicolo'),
    (r'patente\s+nautica|solaris\s+one|cantiere\s+serigi|jeanneau|sun\s+odissey|scheda\s+barche|imbarcazione|sarda\s+cantieri|^alice\.it\s+–\s+(cabina|carteggio|in\s+secca|motore|barca|cucina)', '06 Auto e veicoli/Barca Sealine F37/Proprietà e libretto', 0.8, 'barca, cantieri e patente nautica'),
    (r'eurodecor|gaia\s+service|amianto|serramenti|punto\s+infissi|tende\s+miste|telerie\s+e\s+tendaggi|tendenze\s+per\s+la\s+casa|detrazione\s+(55|36)', '02 Casa e catasto/Ricerca e progetti di case/Lavori e preventivi', 0.75, 'lavori e arredi di casa'),
    (r'golfo\s+aranci', '02 Casa e catasto/Golfo Aranci/Condominio', 0.8, 'casa a Golfo Aranci'),
    (r'scheda\s+personaggio|d&d|heroclix|munchkin|carta\s+fantasy|magic\s+the\s+gathering|carte\s+magic|maptool|steam\b|valve\s+corporation|cyberpunk', '08 Famiglia e scuola/Luca Simondi/Attività', 0.8, 'giochi e passatempi'),
    (r'calendario\s+del\s+contadino|atlante\s+uccelli|birdwatching|fotografia\s+naturalistica|paola\s+solaro|dina\s+sanichar|logo\s+chiesa|jewelry|amici\s+per\s+l.?africa|senegal|leggicomodo|tamburo\s+sciamanico|acroyoga|sapore\s+vegano|arte\s+dei\s+5\s+elementi|5\s*x\s*1000|5\s+per\s+mille|natale\s*insieme|centro\s+recupero\s+animali|bambinisolitogo', '08 Famiglia e scuola/Luca Simondi/Attività', 0.75, 'passioni, associazioni e attività personali'),
    (r'grohe|forno\s+da\s+incasso|integratore|ultra\s+preventive|portobello|myhomeineurope|loft\s+amsterdam|mercatini|ristorante|range\s+rover|obiettivo\s+(nikon|canon|fisheye)|opteka|canon\s+(xm2|1dmk)|british\s+museum|parco\s+acquatico|moby', '13 Acquisti e garanzie/{an}', 0.8, 'acquisti, viaggi e tempo libero'),
    (r'corso\s+(dr\s+)?filler|rossani|joosten|magister\s+formazione', '12 Lavoro e professione/Seminari', 0.85, 'corsi di medicina estetica'),
    (r'^(?!.*(diffida|precetto|decreto\s+ingiuntivo|procura\s+alle\s+liti|relata|ricorso)).*(one\s+apple|via\s+pacini)', '12 Lavoro e professione/Società e progetti/One Apple', 0.85, 'società One Apple'),
    (r"modello\s+unico.*(l.arabi|immobiliare\s+la)|certificazione\s+unica.*(l.arabi|larab)", "12 Lavoro e professione/Società e progetti/Immobiliare La – L'Arabi", 0.85, "dichiarazioni di Immobiliare La / L'Arabi"),
    (r'mobe-?e|mob-e', '12 Lavoro e professione/Società e progetti/Mall-e', 0.8, 'società MOBE-E (progetto Mall-e)'),
    (r'poliedron.*(test|collaudo)|collaudo\s+tecnico|non\s+leggibile|senza\s+contenuto|documento\s+scansionato\s+vuoto|^gg$|^cia$|^simondi$|^doc\s+simondi$|^file\s+simondi$|nessun\s+oggetto', '99 Da verificare/Dubbi', 0.45, 'senza contenuto leggibile: da guardare'),
]

def correggi(d, perc, sog, conf, motivo, sc):
    if perc.startswith('99 Da verificare/Duplicati'):
        return perc, sog, conf, motivo, sc
    t = norm(' '.join(str(d.get(k) or '') for k in ('t', 'n')))
    for rx, dest, c, m in CORREZIONI:
        if re.search(rx, t):
            return dest.replace('{an}', anno(d) or 'Senza anno'), sog, c, m + ' (correzione dopo rilettura)', sc
    return perc, sog, conf, motivo, sc


# Dubbi riletti uno per uno (Claude Code, 2026-11-22): assegnati solo quando il titolo basta. Valgono solo per «99 Da verificare/Dubbi».
DA_DUBBI = [
    (r'kousmine|minarelli|glioma\s+profile|medicor\s+cancer|\bihf\b|ivano\s+ferri|vaccini\s+immunomodulanti', '07 Salute/Roberto Simondi/Referti', 0.65, 'cure e ricerche per Roberto Simondi'),
    (r"documento\s+d.?\s*identit.\s+–\s+(abdulahi|elisa\s+romano|laxmi|olga|sindou|carlos|yulyia|comune\s+di\s+cuneo\s+–\s+gj)|fotografia\s+(tessera\s+–\s+identit.|–\s+(adil|maryam|franco))|foto\s+identificativa|passport|documento\s+zymberi|nulla\s+osta", '12 Lavoro e professione/Società e progetti/Storie per tessere', 0.65, 'documenti di persone accolte («Storie per tessere»)'),
    (r'\bitas\b|avviso\s+di\s+scadenza\s+polizza|premio\s+di\s+polizza\s+non\s+incassato|questionario\s+di\s+adeguatezza|salomone\s+assicurazioni|quietanza\s+polizza', '09 Assicurazioni/Altre polizze/ITAS Mutua', 0.65, 'polizza ITAS (ramo da confermare)'),
    (r'generali|polizze\s+7624', '09 Assicurazioni/Altre polizze/Generali', 0.65, 'polizza Generali (ramo da confermare)'),
    (r'unit.\s+da\s+diporto', '06 Auto e veicoli/Barca Sealine F37/Proprietà e libretto', 0.75, 'assicurazione della barca'),
    (r'cane|gatto', '08 Famiglia e scuola/Famiglia/Animali', 0.7, 'animali di casa'),
    (r'rentalcars|hertz|polizia\s+locale\s+–\s+verbale|autostrada\s+asti', '06 Auto e veicoli/Noleggi e car sharing/Multe', 0.7, 'multa o pedaggio'),
    (r'leasing\s+7042828|fca\s+bank|audi\s+q5|land\s+rover|freelander|renault\s+zoe|macan|minivoltura|numero\s+telaio|minivol', '06 Auto e veicoli/Acquisti e leasing', 0.65, 'acquisto o leasing di un\'auto'),
    (r'affitt|locazion|via\s+g\.?\s*b\.?\s+vico|corso\s+genova|soloaffitti|immodomus|uppi\s+pavia|\brli\b|fideiussione\s+bancaria|papiniano|boccaccio|via\s+conca|immobilsarda', '02 Casa e catasto/Ricerca e progetti di case/Affitti', 0.62, 'affitti e ricerca casa'),
    (r'planimetri|visura\s+(catastale|ipotecaria)|visura\s+–\s+box|cappotto|caldaia|thermoshield|greypor|stiferite|insufflaggio|sanitari\s+e\s+rubinett|prospetti|disegno\s+cad|tettoia|prestazione\s+energetica|frazionamento|confedilizia|condomin|hydrorep|controsoffitto|arcadia\s+biocase|antifurto|disegno\s+tecnico\s+scala', '02 Casa e catasto/Immobile da attribuire', 0.6, 'casa o immobile: quale, da confermare'),
    (r'divisione.*pradleves|pradleves.*divisione|lotti\s+pradleve', '02 Casa e catasto/Pradleves/Atti e rogiti', 0.7, 'divisione di famiglia a Pradleves'),
    (r'diritto\s+annuale|ufficio\s+camerale|visura\s+camerale', '12 Lavoro e professione/Studio Cuneo/{an}', 0.65, 'Camera di Commercio dello studio'),
    (r'avviso\s+di\s+irregolarit|invito\s+a\s+regolarizzare|037-crt|cartella\s+037|ingiunzione|avvio\s+procedimento\s+110194|rigetto\s+istanza\s+110194|richiesta\s+rateizzazione', '05 Fisco e tasse/{an}/Avvisi e cartelle', 0.7, 'avvisi e cartelle'),
    (r'^fattura\s+n\.?\s*\d+.*simondi|report\s+fatture.*incassare|verifiche\s+ricavi|nota\s+pro\s+forma|pro\s+forma\s+simondi', '05 Fisco e tasse/{an}/Dichiarazioni', 0.6, 'fatture e ricavi di Luca'),
    (r'marmellata|mirtill|confettur|crema\s+per\s+colazione|tartuficoltura', '08 Famiglia e scuola/Luca Simondi/Attività', 0.65, 'ricette e passioni'),
    (r'faizal\s+wedding|consenso\s+pcr|omicron|point\s+of\s+care|fine\s+quarantena', '12 Lavoro e professione/Società e progetti/Tamponi e screening COVID', 0.7, 'tamponi e screening COVID'),
    (r'ordine\s+medici', '12 Lavoro e professione/Ordine Medici', 0.85, 'Ordine dei Medici'),
    (r'monopattino|etwow|johnson\s+fitness|apple\s+store|telecamera\s+wifi|ivy-sectec', '13 Acquisti e garanzie/{an}', 0.65, 'acquisti'),
    (r'ubi\s+banca|saldo_e_movimentiubi|moratoria\s+coronavirus', '04 Banche e conti/Intesa Sanpaolo/Estratti conto/{an}', 0.65, 'conto UBI (oggi Intesa Sanpaolo)'),
    (r'movimenti\s+conto|elenco\s+bonifici|disposizione\s+bonifico|ricevuta\s+di\s+bonifico|sumup|estratto\s+conto\s+492|coordinate\s+bancarie', '04 Banche e conti/Altri conti/{an}', 0.6, 'movimenti bancari, banca da confermare'),
    (r'infocert|inad|\bpec\b\s+infocert', '13 Acquisti e garanzie/{an}', 0.6, 'servizio PEC/firma InfoCert'),
]

def da_dubbi(d, perc, sog, conf, motivo, sc):
    if perc != '99 Da verificare/Dubbi':
        return perc, sog, conf, motivo, sc
    t = norm(' '.join(str(d.get(k) or '') for k in ('t', 'n')))
    for rx, dest, c, m in DA_DUBBI:
        if re.search(rx, t):
            return dest.replace('{an}', anno(d) or 'Senza anno'), sog, c, m + ' (dubbio riletto)', sc
    return perc, sog, conf, motivo, sc

def main(fdocs, fdrive, fprat, fout):
    D = json.load(open(fdocs))
    el = json.load(open(fdrive))
    by = {e['id']: e for e in el}
    FOLD = 'application/vnd.google-apps.folder'

    def path(i):
        p = []
        while i in by:
            p.append(by[i]['name']); i = by[i]['padre']
        return '/'.join(reversed(p))
    P = {p['id']: p for p in json.load(open(fprat))}
    # chiavi per riconoscere nel testo le pratiche legali (parole distintive del titolo)
    for p in P.values():
        if p['f'] == 'legale':
            w = [x for x in re.split(r'[\s–—\-/,()]+', norm(p['t'])) if len(x) > 4 and x not in ('decreto', 'ingiuntivo', 'esecuzione', 'immobiliare', 'tribunale', 'cuneo', 'contenzioso', 'opposizioni', 'ricorso', 'pratica', 'avvocato', 'fatture', 'contestate')]
            p['chiave'] = r'\b' + re.escape(w[0]) + r'\b' if w else None

    drive_file = {e['id']: e for e in el if e['mimeType'] != FOLD}
    righe = []
    for d in D:
        f = drive_file.get(d['f'])
        if not f:
            continue  # file fuori da «Archivio personale»: non si toccano (file di Drive di Luca indicizzati)
        perc, sog, conf, motivo, sc = categoria(d, P)
        perc, sog, conf, motivo, sc = correggi(d, perc, sog, conf, motivo, sc)
        tipo = tipo_di(d)
        ext = (re.search(r'\.[A-Za-z0-9]{1,5}$', f['name']) or re.search(r'\.[A-Za-z0-9]{1,5}$', str(d.get('n') or '')) or [''])[0]
        ext = ext.lower() if ext else ''
        righe.append({'documento_id': d['id'], 'file_id': d['f'], 'percorso_attuale': path(f['padre']), 'nome_attuale': f['name'],
                      'percorso_nuovo': perc, 'nome_nuovo': nome_file(d, tipo, sog, ext), 'tipo': tipo, 'soggetto': pulito(sog, 60),
                      'data_documento': data(d) or anno(d), 'dettaglio': dettaglio(d, tipo, sog), 'confidenza': round(max(0.0, min(1.0, conf)), 2),
                      'motivo': motivo[:200], 'scorciatoie': sc, 'md5': f.get('md5Checksum'), 'creato': f.get('createdTime')})
    # file su Drive non registrati in archivio (es. _In elaborazione)
    registrati = {r['file_id'] for r in righe} | {d['f'] for d in D}
    for f in drive_file.values():
        if f['id'] in registrati:
            continue
        pa = path(f['padre'])
        if pa.startswith('Clinico pazienti'):
            continue
        ext = (re.search(r'\.[A-Za-z0-9]{1,5}$', f['name']) or [''])[0].lower()
        righe.append({'documento_id': None, 'file_id': f['id'], 'percorso_attuale': pa, 'nome_attuale': f['name'], 'percorso_nuovo': '99 Da verificare/Dubbi',
                      'nome_nuovo': pulito(re.sub(r'\.[A-Za-z0-9]{1,5}$', '', f['name']), 90 - len(ext)) + ext, 'tipo': 'Documento', 'soggetto': None,
                      'data_documento': (f.get('createdTime') or '')[:10], 'dettaglio': None, 'confidenza': 0.3,
                      'motivo': 'file su Drive non registrato in archivio', 'scorciatoie': [], 'md5': f.get('md5Checksum'), 'creato': f.get('createdTime')})
    # duplicati certi (stesso md5): l'originale è il più vecchio, le copie vanno in 99 Da verificare/Duplicati
    gruppi = defaultdict(list)
    for r in righe:
        if r['md5']:
            gruppi[r['md5']].append(r)
    for g in gruppi.values():
        if len(g) < 2:
            continue
        g.sort(key=lambda r: (r['documento_id'] is None, r['creato'] or ''))
        orig = g[0]
        for r in g[1:]:
            r['percorso_nuovo'] = '99 Da verificare/Duplicati'
            r['duplicato_di'] = orig['file_id']
            r['confidenza'] = 0.95
            r['motivo'] = f'copia identica di «{orig["nome_nuovo"]}» (stesso checksum)'
            r['scorciatoie'] = []
    # soglia: sotto 0,60 → 99 Da verificare/Dubbi
    for r in righe:
        if r['confidenza'] < 0.6 and not r['percorso_nuovo'].startswith('99 '):
            r['motivo'] = f'incerto ({r["percorso_nuovo"]}): ' + r['motivo']
            r['percorso_nuovo'] = '99 Da verificare/Dubbi'
    # dubbi riletti: assegnati quando il titolo basta
    per_id = {d['id']: d for d in D}
    for r in righe:
        if r['percorso_nuovo'] == '99 Da verificare/Dubbi' and r['documento_id'] in per_id:
            p2, _, c2, m2, _ = da_dubbi(per_id[r['documento_id']], r['percorso_nuovo'], None, r['confidenza'], r['motivo'], [])
            if p2 != r['percorso_nuovo']:
                r['percorso_nuovo'], r['confidenza'], r['motivo'] = p2, c2, m2
    # nomi unici nella stessa cartella
    visti = Counter()
    for r in sorted(righe, key=lambda r: (r['percorso_nuovo'], r['nome_nuovo'])):
        k = (r['percorso_nuovo'], r['nome_nuovo'].lower())
        visti[k] += 1
        if visti[k] > 1:
            base, ext = re.match(r'^(.*?)(\.[a-z0-9]{1,5})?$', r['nome_nuovo']).groups()
            suf = f'-{visti[k]}'
            r['nome_nuovo'] = base[:90 - len(ext or '') - len(suf)] + suf + (ext or '')
    for r in righe:
        r.pop('md5', None); r.pop('creato', None)
        assert len(r['nome_nuovo']) <= 90 and not re.search(r'[/\\:*?"<>|]', r['nome_nuovo']), r['nome_nuovo']
        assert r['percorso_nuovo'].count('/') <= 3, r['percorso_nuovo']
    json.dump(righe, open(fout, 'w'), ensure_ascii=False)
    print(len(righe), 'righe')


if __name__ == '__main__':
    main(*sys.argv[1:5])
