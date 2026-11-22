# Tassonomia dell'archivio personale (POL-VITA-ORDINA)

Unica fonte di verità per cartelle, nomi e tipi di documento. La tabella Supabase `categorie` (fase 2) la riproduce. App e script leggono da lì: la struttura non si duplica nel codice.

**Stato: BOZZA del 2026-11-22.** Gli elenchi di persone, immobili, veicoli, banche e pratiche sono **proposti** da Claude Code leggendo i documenti. Sono da confermare da Luca prima della classificazione.

`clinico_pazienti` è fuori dalla tassonomia: resta in «Clinico pazienti» com'è (niente spostamenti, rinomine o AI).

## Struttura (al massimo 4 livelli sotto «Archivio personale»)

```
Archivio personale/
├─ 00 Da catalogare/
├─ 01 Identità e documenti/<Persona>/
├─ 02 Casa e catasto/<Immobile>/{Atti e rogiti, Catasto e visure, Lavori e preventivi, Condominio}
├─ 03 Successione/<Nome defunto>/{Dichiarazione, Atti notarili, Volture, Banche e rapporti}
├─ 04 Banche e conti/<Banca>/{Estratti conto/AAAA, Contratti, Mutui e finanziamenti, Carte}
├─ 05 Fisco e tasse/AAAA/{Dichiarazioni, F24 e pagamenti, IMU e tributi locali, Avvisi e cartelle, Spese detraibili}
├─ 06 Auto e veicoli/<Veicolo-Targa>/{Proprietà e libretto, Bollo, Revisione, Manutenzione, Multe}
├─ 07 Salute/<Persona>/{Referti, Prescrizioni, Spese mediche/AAAA}
├─ 08 Famiglia e scuola/<Persona>/{Scuola, Sport e certificati, Attività}
├─ 09 Assicurazioni/<Ramo>/<Compagnia-Polizza>/   (Auto, Casa, Vita, Salute, RC professionale)
├─ 10 Utenze/<Tipo-Fornitore>/AAAA/              (Luce, Gas, Acqua, Telefono, Internet, Rifiuti)
├─ 11 Legale e pratiche/<Pratica>/{Atti, Corrispondenza, Consulenti, Pagamenti}
├─ 12 Lavoro e professione/{Studio Cuneo, Studio Neive, Ordine Medici, Docenza e candidature, Seminari}
├─ 13 Acquisti e garanzie/AAAA/
└─ 99 Da verificare/{Dubbi, Duplicati}
```

Regole:
- Nessuna cartella vuota «per sicurezza»: una sottocartella nasce col primo file.
- Cartelle anno solo dove i documenti si ripetono ogni anno.
- Un documento sta in UNA cartella (la principale). Nelle altre va una scorciatoia di Drive, mai una copia.
- Confidenza ≥ 0,85: proposta normale. Tra 0,60 e 0,85: evidenziata. Sotto 0,60: «99 Da verificare/Dubbi».

## Nomi dei file
`AAAA-MM-GG_Tipo_Soggetto_Dettaglio.ext`
- Data del documento (emissione o scadenza); se manca, `AAAA-MM` o `AAAA`.
- `Soggetto` = persona, immobile, veicolo o ente.
- `Dettaglio` = da 1 a 4 parole unite da trattino.
- Al massimo 90 caratteri, nessuno di `/ \ : * ? " < > |`, accenti consentiti, estensione originale.
- Il nome originale resta in `documenti.nome_file_originale` e nella descrizione del file su Drive.

### Tipi (vocabolario chiuso)
CartaIdentita, Passaporto, Patente, TesseraSanitaria, CodiceFiscale, Certificato, Visura, Planimetria, Rogito, Atto, Contratto, Preventivo, Fattura, Ricevuta, Bolletta, Estratto, Mutuo, Finanziamento, Carta, Bonifico, F24, Dichiarazione, CU, Avviso, Cartella, Sollecito, Diffida, DecretoIngiuntivo, Precetto, Pignoramento, Ricorso, Sentenza, Verbale, Multa, Bollo, Revisione, Libretto, Polizza, Quietanza, Sinistro, Referto, Prescrizione, Ricetta, Pagella, Iscrizione, Comunicazione, Lettera, Email, Relazione, Perizia, Foto, Manuale, Garanzia, Altro.

## Elenchi PROPOSTI (da confermare)

### Persone (01 Identità, 07 Salute, 08 Famiglia e scuola)
**Famiglia:**
- Luca Simondi;
- Martina Simondi;
- Giulia Simondi;
- Anna Simondi;
- Roberto Simondi (†);
- Anna Bruna Levrone (†).

**Da chiarire:**
- Isa Bergese (molti documenti sanitari);
- Monica Giraudo, Pietro Giraudo;
- Silvio Bagnis, Claudio Vinay, Raffaele Michele Calvi.

**Non famiglia:**
- Valentina Ganzino, Ara Zhulberta (dipendenti dello studio) → 12 Lavoro;
- circa 25 documenti d'identità del progetto «Storie per tessere» → da decidere.

### Immobili (02 Casa e catasto) — dalle visure del Concordato
- Cuneo – via Piccona 36 (10 unità);
- Cuneo – piazza Boves 13 (box);
- Cuneo – corso Galileo Ferraris 6;
- Cuneo – Cascina Piccona (terreni);
- Pradleves – via IV Novembre 17-19;
- Pradleves – via Castello 3;
- Pradleves – Borgata Riosecco;
- Pradleves – terreni (29 particelle);
- Beinette – via Mario Rosso 59/A.

Altri citati nei documenti, da chiarire:
- Golfo Aranci (successione Levrone);
- Dronero – Pratavecchia 44;
- Pietra Ligure – Condominio Armida;
- Cuneo – via del Pilone 38;
- Cuneo – via Piccona 33;
- centraline idroelettriche Pradleves e Dronero.

### Successioni (03)
- Roberto Simondi (2011);
- Anna Bruna Levrone (2024).

### Banche (04)
- Banca Alpi Marittime;
- Banca Azzoaglio;
- UBI Banca / Intesa Sanpaolo;
- Revolut;
- Wise;
- Sella Personal Credit (carta);
- Fiditalia;
- Kerdos SPV (mutuo ceduto).

Da chiarire: BCC Pianfei, PayPal, Satispay, Klarna.

### Veicoli (06)
- Fiat Punto CM396HK;
- FN862HS (polizza Prima);
- EJ621TT (verbali Cuneo);
- ER572DF;
- EH207VW (ammortamenti dello studio).

Non di proprietà: GM437KW (Bipicar), DJ306BT (MGB Motori), GG966ZD (Share Now) → noleggi e car sharing.

Imbarcazione Sealine F37 e patente nautica → da chiarire.

### Pratiche (11) — aperte o in corso, dall'archivio
- Banca Alpi Marittime – D.I. 159/2023;
- Affidamento e mantenimento figlie (Missaglia e De Vellis);
- Centri Dentistici Primo – opposizioni ai D.I.;
- Primo SRL – esecuzione 25/2025 (via Piccona 36);
- Mondino – esecuzione 36/2023 (Cascina Piccona);
- Sovraindebitamento – OCC Cuneo;
- UnoEnergy – D.I. 841/2026;
- One Apple – D.I. e precetto;
- Dental Susa SRL;
- Erik Sogno – cessione ramo Saluzzo;
- Najia Ait Rom – ATP 2174/2026;
- Yndetech – insoluto;
- Biancotto e altri – D.I. 2019;
- Università Torino – ricorso;
- Enel – recupero crediti Levrone.

Chiuse: Condominio Armida, Avv. Conoscente – danni bagno.

### Assicurazioni (09), per ramo
- **Auto:** ITAS Mutua (Punto CM396HK), Prima (FN862HS);
- **RC professionale:** Assimedici, Sigma Studi Assicurativi, Revo/ASME;
- **Altre:** Generali, Quixa → ramo da verificare.

### Utenze (10)
- **Luce:** Edison (via Piccona 33), Union Energia (c.so Galileo Ferraris 11), Enel, Sorgenia (Levrone);
- **Gas:** UnoEnergy (via del Pilone 38), Sorgenia;
- **Telefono:** Telecom;
- **Internet:** Fastweb.

## Corrispondenza con le categorie di oggi (fascicoli)
- identita → 01
- immobili → 02
- successione → 03
- conti → 04
- fiscale → 05
- veicoli → 06
- sanitario_famiglia → 07
- famiglia_scuola → 08
- assicurazioni → 09
- utenze, riscaldamento → 10
- legale → 11
- studio_fornitori, studio_fatture_emesse, personale_studio, formazione, previdenza → 12
- acquisti, servizi → 13
- **pubblicita, foto_video, corrispondenza, altro → classificazione dal contenuto** (Haiku): dove non c'è una cartella adatta → 99 Da verificare.
- clinico_pazienti → fuori tassonomia.
