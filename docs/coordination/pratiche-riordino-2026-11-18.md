# PRATICHE-WORKFLOW — fase 0, riordino doppioni (2026-11-18, Claude Code)

Progetto Supabase `archivio-documenti`. Per ogni riga: pratica doppia → pratica canonica. Documenti, scadenze e promemoria della doppia spostati sulla canonica; la doppia ha `stato = 'archiviata'` e in `note` «Unita in <canonica> (PRATICHE-WORKFLOW 2026-11-18, Claude Code).». Nessuna riga cancellata.

Annullare una unione: riaprire la doppia (`update pratiche set stato='aperta' where id='<doppia>'`) e riportarvi i documenti elencati nella colonna «doc» riconoscendoli dal titolo (gli id dei singoli documenti spostati non sono stati salvati in questa prima tornata; dalle prossime unioni li registro uno per uno).

| Doppia | Canonica | doc | scadenze | promemoria | Motivo |
|---|---|---|---|---|---|
| 9b3c8358-9541-4343-9113-12ef20d77627 | 51bd0991-14fc-4abc-8992-67b7ce1e6f31 | 2 | 1 | 0 | UnoEnergy: stesso contratto gas via del Pilone 38 (titolo diceva «via Piccona 35» per errore) |
| e9f10e9c-86b9-4585-a6a6-fe7a1cc607e8 | 51bd0991-14fc-4abc-8992-67b7ce1e6f31 | 6 | 5 | 0 | UnoEnergy: recesso e fatture contestate, origine del D.I. 841/2026 |
| 5a48cc9a-a974-44a5-a980-8d2f083ca7c3 | bbd2ce2f-b838-40c2-841d-54135d9775f2 | 2 | 1 | 0 | Bertola, via Quintino Sella 10: stesse planimetrie |
| 584207ec-47be-4685-b9f0-774752ea8772 | bbd2ce2f-b838-40c2-841d-54135d9775f2 | 1 | 1 | 0 | idem |
| 28e1ccf6-8081-493c-89e8-dec35319af85 | 2a88403f-56cc-463b-8050-fc1cc8c9cebe | 1 | 0 | 0 | CILA corso Galileo Ferraris 11 bis (Comune / Ing. Bertola) |
| 086f323e-de75-4222-8064-b562cfaf7e33 | ed530f4b-47fd-4a1b-9b15-acb40ef2ab66 | 1 | 0 | 0 | UPPI Pavia: stessa email 02/09/2025 |
| c3b103e1-681e-40b4-8ccb-ee8867ff0c26 | e43727a4-9b5a-4089-b1b4-d2167e2f2547 | 5 | 4 | 0 | Union Energia: stesse fatture 191764/250050/261500 |
| bdf3d7dc-105d-4a7e-992a-4c6919d24004 | 73b2be54-3a82-4e92-a812-ad27bd9d2178 | 1 | 0 | 0 | Centralina canale Marchisa Dronero |
| 11102e85-40c9-4f4a-a929-cc0cc78d99cb | e9bfc502-ae94-4662-9164-b157b6cbc648 | 4 | 0 | 0 | Centralina Pradleves torrente Grana (concessione 1390) |
| d41a7522-1a9a-48cf-a10c-e0181f3d274f | 6fc011d1-fc71-4a3b-8c6a-bf84ba9e68af | 1 | 0 | 0 | Geromella/Giusiano: stessa vicenda (avv. Conoscente, 22/11/2011) |
| 8c3cf4ce-9bbe-45c6-8a3f-072cd85c96c9 | fb1df01b-4b00-4ac2-887d-48d74716ebdb | 1 | 1 | 0 | Adecco: fattura già nella canonica |
| eaa938aa-d661-46cd-8713-b028f1b7ffad | fb1df01b-4b00-4ac2-887d-48d74716ebdb | 1 | 0 | 0 | Piacenza Donatella: assunzione dopo la somministrazione Adecco |
| 5be981d5-5e6d-4153-9dc5-69a7b62052ff | 2d770883-072c-48f1-aa5e-73db6911e2a7 | 4 | 0 | 0 | Anthropic: stesse ricevute |
| d6ab45db-f86e-4f1b-89b2-27319debe4e9 | 5a325787-36c1-49ba-b371-fa0e7606508a | 1 | 0 | 0 | Botpress blueprint |
| 64ad1c5e-1baa-42e7-b6c9-f76c5228c518 | ea3eed9a-7486-4e52-b67d-5b3d3645fc1b | 2 | 1 | 0 | Dental Susa: fatture direzione sanitaria 2026 in una pratica |
| 006bdb35-25d0-4b60-b3f7-85f9ac53c514 | ea3eed9a-7486-4e52-b67d-5b3d3645fc1b | 1 | 0 | 0 | idem |
| f047b1fc-a697-4a41-85e2-dd1c6babfb09 | 0509229d-99d7-4dec-87bd-8201d465e21e | 5 | 4 | 0 | Eco Eridania: stesso contratto 61098/25 |
| 528d1c8c-ef29-4b1f-84d9-951ec8ca1563 | b80fdbbb-473b-433d-8dd2-6cffb89020e8 | 1 | 1 | 0 | Erospubblicità: insegne studio |
| 3a4593e5-0352-4883-a036-d26b999890e0 | c4d30cdd-98ad-4d0d-b22d-076eb31e463e | 1 | 0 | 0 | Identità Anuli Barre |
| 29e04606-9a7d-4517-8546-6906e3c626eb | 142bf28d-b3cb-4014-9d1f-be804513ef77 | 1 | 0 | 0 | Identità Kelvin Ochade |
| aa7229de-7bee-45f5-9d36-63f49d16eb80 | c633acee-99a4-4ff0-b738-b27a9d4b19b2 | 2 | 0 | 0 | Identità Lamine Ndiaye |
| c9b9908d-09c9-4689-9d86-85875bc2d651 | 1729d971-a8df-450c-984c-292f61826d36 | 1 | 0 | 0 | Federico |
| fbbe9844-2e4e-4419-94c9-59e4cd0894ef | b3cad72d-c33c-40ec-9512-8c6f40b97ea8 | 1 | 0 | 0 | IDI Evolution, stessa capsula provvisoria |
| a7ac4375-0232-4bc6-9168-63e546862816 | e9e47b86-5936-425a-8d79-d540260d464e | 1 | 0 | 0 | stessa prescrizione 30/04/2026 |
| f617af06-8f36-4d3a-8b2f-22cd61cf8e50 | 6a450576-ae40-4ee4-b7a1-cfafab584714 | 1 | 0 | 0 | MIUR Istanze Online |
| 81ae8f40-832d-4487-80d1-1c79f8079add | 3fba49c9-6e3f-42a7-b8d5-9094ae947492 | 1 | 1 | 0 | Mondolè ordine 49-KWY2T40 |
| 7db44164-18da-41ca-98df-3df32bdb4ac8 | 06949756-aa11-49e8-b0dc-4e553b959e1f | 1 | 0 | 0 | Mooney chiusura carta |
| c3364bd9-e7af-4f32-be28-df5460c1c820 | 01c5ea9b-477c-41bc-b18c-f3e1019d6a84 | 1 | 0 | 0 | O.R.SO Ready! Stem! Go! |
| da7e12ec-a1df-4e38-9a94-4d3bb74d7c24 | 600f9ad2-c2ec-4e92-a845-202ee4a54041 | 1 | 0 | 0 | Sastecn |
| 2a01782b-dcfe-45cb-bd7b-f38aae3be824 | 4a436c15-f620-49fe-9743-24654ba3f1fb | 1 | 0 | 0 | Wise Europe |
| ffcd1d4f-71fb-42f7-97b7-9a1ba042ef59 | e9da30ae-d055-4c68-964f-3c26addd6f10 | 1 | 0 | 0 | IONOS poliedrasoft.it |
| 1c770a44-e820-446f-9072-c9761d12f0b7 | 8cebbdd6-85a8-4e21-aaa2-f6653fc6840d | 1 | 0 | 0 | Yndetech CAD Minore Barbara |
| d56a0852-0c01-4a83-8a43-45eeef99688f | e93cd1e4-11ad-4650-90b4-ec53fdc0e770 | 1 | 0 | 0 | Yndetech listino e offerta |

Titoli rinominati (canoniche): 51bd0991 UnoEnergy; bbd2ce2f Bertola Q. Sella; 73b2be54 Dronero; e9bfc502 Pradleves; 6fc011d1 Geromella; fb1df01b Adecco/Piacenza; ea3eed9a Dental Susa fatture; 0509229d Eco Eridania; b80fdbbb Erospubblicità; c633acee Lamine Ndiaye; 600f9ad2 Sastecn; e93cd1e4 Yndetech; e43727a4 Union Energia.

Lasciate separate apposta: Condominio Armida (A&B, E.Co., Sartore: creditori diversi), Ing. Bertola corso Francia (50b25c2e, altro immobile), Telecom subentro/rientro, ISOMED (corsi diversi), Tomaselli/Rovere/Paolo Pes (offerte diverse), Spinbridge Levrone (creditore non chiaro, da vedere in analisi).

## Documenti legali senza pratica assegnati (260)

Prima di questa tornata 264 documenti `fascicolo = 'legale'` (caricati in blocco dalla cartella Drive «Legale e contenziosi», senza data) non avevano pratica. Assegnati per ente e titolo; per annullare: `update documenti set pratica_id = null where id in (...)` con gli id qui sotto. Le scadenze di questi documenti senza pratica hanno preso la stessa pratica.

Pratiche nuove (`fascicolo = 'legale'`, `urgenza = 'media'`, nota «Creata da Claude Code (PRATICHE-WORKFLOW 2026-11-18)»):
- PRIMO = e0a40aec-47d4-450f-a729-757038465c53 — Centri Dentistici Primo – opposizioni ai D.I. (giudizi riuniti, Avv. Martini)
- DI2019 = 9acc1cae-3c15-4e52-8810-aa4d528898df — Centro Dentistico Simondi – decreti ingiuntivi 2019 (Gliga Elvira, D.I. 415/19 GdP Cuneo)
- DTREY = 56dd52f2-9217-4745-8471-7fe7e4ce3af5 — Dental Trey S.r.l. – ricorso per ingiunzione di pagamento (2018)
- ENELBOC = 7fd5b9ae-30e1-409a-adee-fe8d37774827 — Enel (Ge.Ri., Avv. Cenci) – messa in mora via Boccaccio 569,52 €
- ONEAPPLE = fe671c41-27ed-496e-8977-35e6c7dd780d — One Apple S.r.l. – diffida Iconica, D.I. e precetto (2024), sollecito Intrum
- MPO = 665353e2-9161-4071-b07d-f9df615bc28e — MPO – precetto contro Luca (2024)
- HYPE = 670888aa-7c66-491c-9d72-800f351ab05a — HYPE – conto bloccato per pignoramento presso terzi (dic. 2025)
- TORRES = 8d322de9-5f8c-415b-bbf4-fd2575fb2104 — Torres / Simondi – causa RG 2325/2018 Tribunale di Cuneo (Amtrust, CTU)
- GIANSANTI = e36822c8-de41-40a5-8db3-e065a86697ec — Giansanti – diffida a Odontofratti, Novarod, Cofidis (2025)
- LLMED = 8a15f1bc-216b-412e-bf2e-3640f570b474 — LL Medical / Safe Active – contratti (2021)
- PRATONEVOSO = 5bfbb9c1-a52e-428a-a4ac-d496f164e623 — Prato Nevoso – diffida Luca Blengio (2020)

Per pratica: 1c79fdfa (esecuzione 36/2023 Mondino) 81, 842ffcdc (Banca Alpi Marittime) 49, PRIMO 43, a3c650c1 (causa Giraudo, Trib. Milano) 42, DI2019 7, ONEAPPLE 5, 51bd0991 (UnoEnergy) 5, 94b51404 (Edison, contestazione CMOR) 4, DTREY 4, 7308fb09 (Università, ricorsi) 4, 15e99a0a (Enel/Spinbridge/Fire Levrone, rinominata) 3, 7dc5db9d (Free2move, solleciti Intrum) 3, GIANSANTI 2, LLMED 2, TORRES 2, ENELBOC 1, PRATONEVOSO 1, HYPE 1, MPO 1.
Da verificare in analisi: le 4 scansioni dell'Avv. Nicola Dottore (2022–marzo 2023) messe nell'esecuzione Mondino.
Rimasti senza pratica (incerti): LexDo costituzione società, «Documentazione ricorso» 2022, foto udienza 2013, «Ricorso per decreto ingiuntivo – 2020».

Id dei documenti (prefisso pratica:id documento):
```
15e99a0a:70aaf6c2-40be-4bbf-a3ce-6666a5e11988
15e99a0a:5e2d88e5-913f-48d4-b7fd-a922449752ee
15e99a0a:38bb15ad-e28c-4906-8f9c-0db058fa5fae
1c79fdfa:5fa46819-7cc2-4f4c-a196-9e0800634e33
1c79fdfa:1747585e-2479-4ec9-948c-73b8fc719849
1c79fdfa:dcc7343d-6667-4e92-8f0f-76d18efa481c
1c79fdfa:dbf5c063-b8c1-4cc2-ae7b-48bb19c9d7e9
1c79fdfa:06d4ff4b-83fd-4bbc-aa83-08d9cae3cbd3
1c79fdfa:65bbacff-5749-40ce-b53c-20fd0ea970f5
1c79fdfa:65dbe450-2dee-494f-aab4-de8f42ae322c
1c79fdfa:ba6d2655-6d2f-46e9-ae4c-9527bfbf292a
1c79fdfa:246c3736-83a3-49d6-b868-c3495f08c788
1c79fdfa:d9829f12-ab22-4089-ba65-35f508487056
1c79fdfa:f79b438f-2b3d-40d7-8a86-3dfa715e76d7
1c79fdfa:0f92f722-4c7e-458c-9bf7-28b652cc6e50
1c79fdfa:24dd8484-075e-4842-8666-fac0181a3c93
1c79fdfa:6d1850d3-cad5-4667-b456-60954fa70f56
1c79fdfa:074a2c3b-ef93-44ad-926a-0cde6079626f
1c79fdfa:d86397c2-d897-4019-812b-560e3efc9ae2
1c79fdfa:6f3dfbf0-6457-4906-86a3-107e2566a7bb
1c79fdfa:6f87f925-5f09-4845-9b26-746cc2f5d2db
1c79fdfa:8fc87dd3-0550-426b-904b-dac6ad4d9508
1c79fdfa:5df65aa2-8c62-47b5-8931-4fb65740f5b5
1c79fdfa:5f364072-2088-40b0-826c-21615dc551dd
1c79fdfa:fe579d7c-dbe3-454c-bfe0-d1cb9f5894e3
1c79fdfa:4beb2633-4c46-4e94-8da2-b3f6905c7aab
1c79fdfa:4bf3010a-34da-4506-860e-1f1128d15974
1c79fdfa:1fa6fa28-8355-477d-963d-02134d4ff28c
1c79fdfa:1fd0003b-2c2f-41b6-b6e6-dfc6d020414d
1c79fdfa:53a12ffd-e875-48a0-b3bd-e49efb357a64
1c79fdfa:542cf183-a041-4b1d-a7c6-5c8e528ccc5d
1c79fdfa:0d0e42b5-7896-4d7a-88a5-cdbe3f95789e
1c79fdfa:94c09032-c955-4142-8d7c-66aa10115726
1c79fdfa:8edec480-86e1-4627-a8f4-659dd168608c
1c79fdfa:21a76dee-b7fd-46f2-8dbb-016f2521bd15
1c79fdfa:5c81eb49-826d-4231-be6d-cdcec3f24ab8
1c79fdfa:711f26e0-414a-472d-8369-50469fdd08b5
1c79fdfa:719d5dc0-83c4-4b05-af2f-7038cef9d4fd
1c79fdfa:26d81275-15fc-4df5-ab31-273ea50df0bc
1c79fdfa:0fdfdda0-01e5-4e2e-98e4-3f163cea53fd
1c79fdfa:112f290d-498f-49b5-897f-7321941e422e
1c79fdfa:13f08eab-f595-4713-a2ec-18c0455cccd3
1c79fdfa:d1290d60-0243-4e4f-9aa4-d6769e30e528
1c79fdfa:274700b6-311f-4c01-803c-87485ef2cb46
1c79fdfa:7dd819cd-1401-40cf-9e37-a7d8f06f6370
1c79fdfa:816632b6-07d9-4d6d-881c-2cb3076e168e
1c79fdfa:cdeb744b-9e48-41c4-840b-b948e3dcffcf
1c79fdfa:81bc71d9-024e-493a-af8c-b07451c91027
1c79fdfa:a40def86-10b5-4de0-a1a3-ee3276314958
1c79fdfa:991ac30f-0d69-4cb7-802c-e8e8de652614
1c79fdfa:c8e5c44d-ade6-4e3a-9aef-860341bcff4b
1c79fdfa:c58ce06c-4b9f-4381-afa7-5e9f9d381e9d
1c79fdfa:155cb0ea-93d8-4a87-af8e-0f3f366944cf
1c79fdfa:c22cae3a-d36f-4b83-a246-279110b42520
1c79fdfa:9a6d89ad-8374-4dd6-b048-2a32d3132991
1c79fdfa:f09a5822-58e2-430b-abe5-6f35ad62b89c
1c79fdfa:a769035a-d5c1-46ca-807d-8d722f770fe5
1c79fdfa:a78fbac4-9bfe-4676-9120-283f2d140ced
1c79fdfa:07fc4ca4-7066-47dd-93cd-223864a320c7
1c79fdfa:2e8ba061-b734-4714-9067-747fbef039dd
1c79fdfa:30e5ed60-b01a-4898-ab7e-7fc6907403e7
1c79fdfa:9c9294ac-6279-4123-b4b5-3552f9d14888
1c79fdfa:efb4be3d-acf0-49c6-be3e-05a78f31e53a
1c79fdfa:39ad09ce-2599-4fa1-b805-c33bfb6bd5e2
1c79fdfa:ec2d17f0-997d-4960-b07d-eda91f43b80c
1c79fdfa:3a78b48c-6cfd-476b-aa85-884ef05aa61f
1c79fdfa:3b67b8cb-075c-4b43-ad6e-6be3249daaff
1c79fdfa:f7757ec6-f9f9-4c18-8934-51f5936666c0
1c79fdfa:09e8e1cd-6b35-4391-8754-2a7d77312792
1c79fdfa:15af1a5c-62e0-4e6a-b4bf-3648a4a959e5
1c79fdfa:ea6b684f-7639-48c3-aacf-6f3319871be7
1c79fdfa:ad4c9b5f-35ac-47e0-817f-4021e9e5bb58
1c79fdfa:4098e205-b37d-4d46-bc8d-b9805b32896f
1c79fdfa:4364c15b-fcb1-4294-af42-258694b3ea15
1c79fdfa:43ad9fd3-0ce0-4b84-9346-9ca0ab494f25
1c79fdfa:43bfc208-491e-4056-be82-19d50c3e41df
1c79fdfa:e78fa063-dc54-486d-bd1e-5b2754008396
1c79fdfa:c07e5eeb-aca7-4f1d-b149-a75c902cb0ba
1c79fdfa:1b8c07f7-a9a7-4bcb-9388-ee8f2522b1a9
1c79fdfa:042781a1-671b-4d5d-a1c2-fa0f1ac59f13
1c79fdfa:177a651b-a38a-428a-8735-a16d3e4a10a9
1c79fdfa:4889bda8-8814-40ea-a352-17d9eda19be8
1c79fdfa:e4f2d2f9-ee0b-4b78-adf0-3b68521bf5b0
1c79fdfa:94ce8c99-25c6-4170-8aa4-d751b94f42bb
51bd0991:2a259d68-8849-4862-b72b-7f701701e134
51bd0991:1769a12e-a6c0-4bb6-b7c4-b887680613bc
51bd0991:44bb89fc-bdd6-4aa1-84f5-a815a6202dda
51bd0991:77556122-2d23-469f-a94a-56583f77ab3f
51bd0991:cc9bc490-3492-431f-bdbe-2114ed92ae0c
7308fb09:1eb011d5-dffe-47dc-b49d-001c6f705dc4
7308fb09:dac5b4cf-b74f-4497-941a-0aa70bed8730
7308fb09:7680512f-d3a5-41f3-aa1a-beade4be0ce0
7308fb09:d2dcce2d-42ec-4af7-8b46-52ced0701d6c
7dc5db9d:32488741-9122-4b6d-97e3-74f47201fffd
7dc5db9d:95732913-947e-49b1-a8c2-9a10ff667bf9
7dc5db9d:8da66a01-7292-4a83-9245-883398f86a54
842ffcdc:f8814715-c022-4ae0-b80a-8465814345ef
842ffcdc:950c7c53-2a28-4b79-8ba6-62ebec97b208
842ffcdc:c3500ec3-cc7f-4155-92db-b2e1f4843a2a
842ffcdc:bf1deba2-efba-4591-aca5-ac3ff829e465
842ffcdc:a35a3903-403d-4f6e-9bcb-6af019280967
842ffcdc:bb551892-a695-4c76-a182-138aa5fa642a
842ffcdc:b5cc5faf-ba2d-4698-95e1-f32296a4ef3c
842ffcdc:ae8ed5d5-8624-489a-be0f-dc657febec1a
842ffcdc:a71aed45-9f1f-4a1d-9969-5d3db206e78b
842ffcdc:feb51624-1c81-4970-895b-962a01b2f9da
842ffcdc:a9c6ebc4-8e81-4638-9468-e2b7d57ec541
842ffcdc:06324dd3-1094-45a7-bf76-08c854ec3ee3
842ffcdc:04538cb2-108c-4cd5-9d71-19539acec5ed
842ffcdc:1e5d2f11-96ba-4dd3-bd09-d021ded6d4c3
842ffcdc:f677a03a-e6a0-4c78-9274-c7f72955a9b9
842ffcdc:221f6770-ffd8-4bfc-860c-dc21b86293c7
842ffcdc:22fad836-deea-482f-9f06-10efc7176163
842ffcdc:27e6c525-4ecc-480f-a2e9-805959fb4ae1
842ffcdc:f3c3ff24-544c-4001-936f-81c66da2495c
842ffcdc:281fcc37-0ac2-4588-852e-bfa48f2ea055
842ffcdc:28f35594-1781-4aed-bee1-ac0f6f5c4512
842ffcdc:2a62e433-cf00-49fb-9cfe-6208119a722e
842ffcdc:07f7ebaf-f142-4aa2-bf56-f90f35b9d53a
842ffcdc:323a928e-f3ef-431a-99d6-81b8912335ed
842ffcdc:0921d731-ab83-47d1-824f-83f22ed942fa
842ffcdc:3cfa2c40-9ef5-4c39-90b6-d0a07001267c
842ffcdc:e8eecb59-88c2-496e-89a5-f07257f780fe
842ffcdc:e777d0a8-8234-4a6b-9b66-f62c16670b7b
842ffcdc:469ee670-5b5c-41a8-a107-cb52cda9e3f0
842ffcdc:46b20796-763e-4e0f-864e-ca031c4b98fd
842ffcdc:4a30292d-ebe2-407b-8e51-792cf5c4460e
842ffcdc:e11c920b-e2eb-4861-bee8-c9149dc162c2
842ffcdc:4c282cac-8363-4f5f-8179-669c6c7e0377
842ffcdc:fe46a02a-cdde-4a24-bea7-3d85a22afdcc
842ffcdc:581ab6e4-d924-4a72-8723-bc7e96230641
842ffcdc:dccb2a77-8bdf-4007-aaa2-e9e6dd8e8cbf
842ffcdc:5dded6df-c2fc-4822-8def-9f11ba6c128b
842ffcdc:5fc34d1d-c11a-45b3-b4b5-7bdf8bd0ec05
842ffcdc:d99014ee-980a-4b80-9c1f-bac63f45fc66
842ffcdc:67490627-3cf6-4655-8c53-aa998213c75a
842ffcdc:674b98ae-bf22-40e9-ac3b-e3436f1c7e9c
842ffcdc:6c94963c-0a7b-4e0a-9990-8b02acdf19d4
842ffcdc:d91fe6e5-81ab-4ba3-8a4f-192fdc1b04da
842ffcdc:73baa627-607b-4758-b1b9-aba603ca9f57
842ffcdc:7b4bd4f4-9fa4-4813-afc7-efc903dd2370
842ffcdc:8432934b-68eb-41c5-9eff-f13b6d470f35
842ffcdc:85d5f78c-4271-4352-8a70-9c3fb3c2f69d
842ffcdc:921fd154-7a0d-4960-bbe3-6b5fdf313ff1
842ffcdc:c3c51f2f-c732-415e-aaf7-0936fc1ea208
94b51404:3ff97c8e-ec1b-4762-88fb-698580019993
94b51404:21e7287b-c075-45f2-b484-442095872ae9
94b51404:8cf16e5f-3857-4ac0-b7d0-46f7ed18b806
94b51404:dfd1df6a-1bb2-4190-97cc-11d39f364401
a3c650c1:e63ca565-2f94-4de5-b3bd-8ada6731ed84
a3c650c1:06918211-2005-4841-b2b5-8b93061d6df3
a3c650c1:17e3366e-a896-457a-b89a-f7cd4010ccb9
a3c650c1:18d07443-f865-440c-bce2-7cb93049e72c
a3c650c1:1d3b23b8-9dcc-401b-86c3-0b5c37521b6a
a3c650c1:2229f63e-9fc9-440f-8594-9f9e48af09b8
a3c650c1:26817357-cfc7-4a1c-8a0e-a74ff2004d37
a3c650c1:2ca7f29f-573b-4230-b7f5-5196484f61e5
a3c650c1:2e664370-fdec-45e4-90d7-a24bfb91641a
a3c650c1:337517d1-f975-4e83-9d7a-475d0754b289
a3c650c1:3f37af56-2a90-42d2-9ced-8370e9ad84e1
a3c650c1:4b2c7a76-3796-4d41-9838-7d658719cc31
a3c650c1:4fe88931-20dd-4088-bf8f-8c6be2870a24
a3c650c1:556a18d5-1358-4867-b66b-702cd8eff46f
a3c650c1:5700a31b-2fbc-41db-a130-89605432a6a9
a3c650c1:6c16a47a-1e6d-403c-b5eb-1ce6ba423e0c
a3c650c1:6c707634-a183-47ac-bdba-baa3cdc55c04
a3c650c1:76e27bef-b553-4ab3-9754-094c6c3406af
a3c650c1:795b3aea-dc1d-41f7-adfd-d33eafba02b3
a3c650c1:79e15bb8-67fc-44f7-bc7f-4e2f6e6cbeab
a3c650c1:8d03a080-20d2-4af3-8cdd-9fbab3de493c
a3c650c1:8f2c08f6-35aa-450d-8d6a-14fcf677fda4
a3c650c1:9581b925-ec75-44ad-8b1c-6190981d0824
a3c650c1:9ac8cf3a-ebeb-4d6c-8b11-1128ee7cae45
a3c650c1:a2b81501-5a32-46a0-b908-728b78c4e805
a3c650c1:a8a15365-5cde-40c7-94e0-e11eeedc04e8
a3c650c1:ac87e933-e07d-43a2-ab75-2f77507fb22d
a3c650c1:adea7c41-901e-4afb-a7e1-bb6959a98469
a3c650c1:b8e75ecf-abf9-4e4d-b90d-63bccb1b4390
a3c650c1:bd3297cc-4fe5-4f70-b521-5a62c6c3ee66
a3c650c1:c0b99e0f-2f31-4f83-af94-fc7373c8bf36
a3c650c1:cc2e8d15-815f-40d5-b1a6-0bedc731022c
a3c650c1:d4ffe3a7-6ce6-4a66-be94-3f394f9d5aa9
a3c650c1:d9fa9363-6904-4f45-97b5-b4ce1459e2ca
a3c650c1:dc84d46f-1478-48dd-9f38-4cdc7bda3f31
a3c650c1:e3b94c72-29f7-4fab-93af-2ccb452e59d7
a3c650c1:e790710b-3186-426d-833a-055c0e30c1e0
a3c650c1:e9bb4c11-f5fb-4e4c-9ae0-3c50a463179a
a3c650c1:eac7db30-d998-4e09-a9ec-3068c3339946
a3c650c1:eea4cb83-b824-4ae1-876f-db99403c8819
a3c650c1:f02a917a-b468-4c90-811d-ad247dbb7b4a
a3c650c1:fa046c39-e2ff-420a-9fc8-415eb8037c62
DI2019:57ee49a1-af7c-48ef-908b-b187b2266723
DI2019:d7181f36-f6dc-4682-bde0-812264e528cb
DI2019:46a10a85-1494-4dd5-abb9-1a34ec5b7118
DI2019:68687129-e1e9-4977-bbe9-b5564a9a5cff
DI2019:63e9ca9b-14f3-4f48-ae91-e1cedd4065b1
DI2019:a6d22630-6a3b-4484-a8b9-d58cf2e83d02
DI2019:4b7d0346-4fc9-41b0-b4de-a8d50b8756a9
DTREY:63d35b07-303e-4cb3-8d52-0a3a71ac82c5
DTREY:6e6af9c1-8eae-4f7c-9b25-7fed2c0ce0bd
DTREY:3721e09e-6ea7-475f-8dd1-4ee48d6b0c04
DTREY:d6d5b61c-4dd2-4f29-a780-672572718799
ENELBOC:fb32513d-c71e-4ec1-b55f-a2b9bc41eb8c
GIANSANTI:0d102ad9-7fba-46c8-986e-f231ec69ad8c
GIANSANTI:d54043e0-3051-4097-9d83-80ed475d9fc2
HYPE:43cc82ac-489e-492d-89a8-8483824f5bdc
LLMED:9a55716d-4449-49ab-b752-0a3c7d2c5278
LLMED:f97f4b91-ef1a-4f67-9763-f8c722d23079
MPO:0f83a4c1-af1a-4f0b-82dc-7a3b1e01e3a4
ONEAPPLE:b35a13a8-b522-406f-bd78-534b14899677
ONEAPPLE:63a1e8ec-be14-4e7b-a4b3-ae0a010e937b
ONEAPPLE:c99ad86a-3269-4b6e-bc0a-9db62716b678
ONEAPPLE:3ffe150e-55d3-4531-a8e1-bae00a40b2ae
ONEAPPLE:7a69c168-1cf9-4335-8986-4a8d74590959
PRATONEVOSO:c9b34e76-10c8-47ee-b5b6-636754718c2f
PRIMO:ea86b604-3be6-4f12-8199-3892a8e67075
PRIMO:0cf4d97e-d6b5-4a53-9cea-ccbfa559cd9e
PRIMO:3a6b10d3-f3db-4778-a8ba-9998811f692a
PRIMO:ecdf392b-7766-4e6d-b974-da09d380f290
PRIMO:ede8b50d-1a95-47ac-aeb7-74de92e889bd
PRIMO:0a940706-ae1e-46f2-9acd-20b78033e074
PRIMO:04c6f39f-f995-4f9e-a1d2-e9ca52694616
PRIMO:298557c6-6f8a-4927-b60b-46e586185c85
PRIMO:b1e199d0-ac72-47c8-b233-ec34c1ed2179
PRIMO:a3b53725-ccf5-4992-8dc5-9a76fdeeb274
PRIMO:c365de7c-d47b-40c7-bfca-99d728390fb0
PRIMO:9408e827-ca22-4202-84bf-eb5ddc283288
PRIMO:8dfc0ee3-2618-4ffe-b778-0bd1cd0810c6
PRIMO:8945b217-4e72-4cc8-bf3a-d641317c7fa1
PRIMO:85789423-b4e5-4ace-9c58-ba283caab4d6
PRIMO:cdcdce31-3ee0-42fe-b981-3a7b4d0b40b6
PRIMO:81b4a718-e609-4291-a53c-042b7b71f3e8
PRIMO:d0bce464-f66c-4373-8fec-2569a8c0bf2a
PRIMO:73c40ae2-81cf-45bc-b059-4f5d46c0ec9e
PRIMO:d31ef996-e835-4527-8709-f44740555189
PRIMO:d35fe010-68cc-4ef1-8cc8-4866c89f0430
PRIMO:d820a37d-b3a4-4e67-9b72-cb972d067bd1
PRIMO:d89c7f91-1d58-439c-9a5f-733ceca80dba
PRIMO:6d33619c-8864-43cc-b874-3bff36c491e4
PRIMO:f9e65949-d9b4-4454-aa5a-ce926d87e738
PRIMO:61ff0323-e49a-4807-a59b-519d8e7270e7
PRIMO:59ba4d8f-46c9-4df9-b982-c0a899c94459
PRIMO:fff1345e-5328-42a4-a30d-91129d8fc69b
PRIMO:4978e5b4-9609-4fc4-aa10-a9ef5350ba54
PRIMO:46558bf1-b721-4f88-a85d-e8a32575c1dd
PRIMO:404a71e3-ea05-4862-8340-2ec786f8a666
PRIMO:fc9ea3f7-8f78-44b9-80c2-d0348ff6bf89
PRIMO:e9da4937-0e66-47f8-aec6-ae73181cef9e
PRIMO:9f14f850-085b-44c5-82ef-a2f570400bf4
PRIMO:188289db-409b-4b6e-aa66-ac72b5bdb2a8
PRIMO:a59549b3-a3eb-4b46-b8b6-abb2f09bf35e
PRIMO:27ffec2e-34d6-4b8c-9e6b-97153e48a28e
PRIMO:95610f23-1338-4a90-9dfe-72742980aea5
PRIMO:bb095831-c2a9-45e2-8731-04f21e1ddd72
PRIMO:a3704c31-25b5-4ca0-84ce-ff33ed7a506b
PRIMO:21faf456-29b6-4c39-8fa0-76cbfa5b8ec5
PRIMO:be74bb3a-39b1-4311-9b94-a3fda0a186aa
PRIMO:a3166a06-278e-40ec-a6f6-8084b191f50a
TORRES:f2c15ed0-478b-4ce5-a676-acaefcb9fbbc
TORRES:ed682f0e-0f7d-4e9b-bef2-d7a7e1add0c5
```
