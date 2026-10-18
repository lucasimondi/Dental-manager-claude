#!/usr/bin/env python3
"""Scarica in locale una copia di iCloud: Mail, iCloud Drive e Foto.

Uso:
    python3 scarica_icloud.py tutto --apple-id nome@icloud.com --destinazione ~/Backup-iCloud
    python3 scarica_icloud.py posta --apple-id nome@gmail.com --email-icloud nome@icloud.com
    python3 scarica_icloud.py drive --apple-id nome@icloud.com
    python3 scarica_icloud.py foto  --apple-id nome@icloud.com

Solo lettura: nulla viene cancellato, spostato o segnato come letto su iCloud.
Si può rilanciare quando si vuole: scarica solo quello che manca.

Password:
  - posta: password specifica per l'app (appleid.apple.com > Accesso e sicurezza),
    da variabile ICLOUD_APP_PASSWORD o chiesta a video;
  - drive e foto: password dell'Apple ID e codice a due fattori, chiesti a video.
Nessuna password viene salvata dallo script. Le sessioni di Apple (cookie)
restano in ~/.pyicloud, fuori dal repository.
"""

import argparse
import base64
import getpass
import imaplib
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

IMAP_HOST = "imap.mail.me.com"
IMAP_PORT = 993
LOTTO_POSTA = 25
CARATTERI_VIETATI = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def nome_sicuro(nome):
    """Nome di file o cartella valido su macOS, Windows e Linux."""
    pulito = CARATTERI_VIETATI.sub("_", nome).strip().rstrip(".")
    return pulito or "_"


def scrivi_atomico(percorso, scrivi):
    """Scrive in un file temporaneo e lo rinomina solo a scrittura finita."""
    temporaneo = percorso.with_name(percorso.name + ".parziale")
    with open(temporaneo, "wb") as f:
        scrivi(f)
    os.replace(temporaneo, percorso)


# --- Posta (IMAP) ---------------------------------------------------------


def decodifica_utf7_imap(nome):
    """Decodifica i nomi delle cartelle IMAP (UTF-7 modificato, RFC 3501)."""
    def sostituisci(m):
        corpo = m.group(1)
        if not corpo:
            return "&"
        b64 = corpo.replace(",", "/")
        b64 += "=" * (-len(b64) % 4)
        return base64.b64decode(b64).decode("utf-16-be")
    return re.sub(r"&([^-]*)-", sostituisci, nome)


TESTA_LIST = re.compile(r'\((?P<flag>[^)]*)\) (?P<sep>"[^"]*"|NIL) ?(?P<nome>.*)')


def cartelle_imap(imap):
    """Elenco (nome IMAP, percorso locale) delle cartelle selezionabili."""
    stato, righe = imap.list()
    if stato != "OK":
        raise RuntimeError("Impossibile leggere l'elenco delle cartelle")
    cartelle = []
    for riga in righe:
        if isinstance(riga, tuple):
            # nome inviato come letterale: (b'(flag) "/" {12}', b'Nome cartella')
            m = TESTA_LIST.match(riga[0].decode())
            nome = riga[1].decode()
        else:
            m = TESTA_LIST.match(riga.decode())
            nome = m.group("nome") if m else ""
        if not m or not nome or "\\noselect" in m.group("flag").lower():
            continue
        if nome.startswith('"') and nome.endswith('"'):
            nome = nome[1:-1].replace('\\"', '"').replace("\\\\", "\\")
        sep = m.group("sep").strip('"')
        leggibile = decodifica_utf7_imap(nome)
        parti = leggibile.split(sep) if sep and sep != "NIL" else [leggibile]
        cartelle.append((nome, "/".join(nome_sicuro(p) for p in parti)))
    return cartelle


def uid_gia_scaricati(cartella):
    uid = set()
    if cartella.exists():
        for f in cartella.glob("*.eml"):
            m = re.search(r"_(\d+)\.eml$", f.name)
            if m:
                uid.add(int(m.group(1)))
    return uid


def messaggi_dal_fetch(dati):
    """Estrae (uid, data, contenuto) dalla risposta di un UID FETCH."""
    for parte in dati:
        if not isinstance(parte, tuple):
            continue
        testa = parte[0].decode(errors="replace")
        m_uid = re.search(r"UID (\d+)", testa)
        if not m_uid:
            continue
        m_data = re.search(r'INTERNALDATE "([^"]+)"', testa)
        data = None
        if m_data:
            try:
                data = datetime.strptime(m_data.group(1), "%d-%b-%Y %H:%M:%S %z")
            except ValueError:
                pass
        yield int(m_uid.group(1)), data, parte[1]


def scarica_posta(email_icloud, destinazione):
    password = os.environ.get("ICLOUD_APP_PASSWORD") or getpass.getpass(
        "Password specifica per l'app (iCloud Mail): "
    )
    radice = destinazione / "posta"
    print(f"\n== Posta -> {radice}")
    imap = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    try:
        imap.login(email_icloud, password)
    except imaplib.IMAP4.error as e:
        sys.exit(
            f"Accesso a iCloud Mail non riuscito ({e}). Serve l'indirizzo @icloud.com"
            " (--email-icloud) e una password specifica per l'app, non quella"
            " dell'Apple ID."
        )
    totale = 0
    try:
        for nome_imap, leggibile in cartelle_imap(imap):
            quotato = nome_imap.replace("\\", "\\\\").replace('"', '\\"')
            stato, _ = imap.select(f'"{quotato}"', readonly=True)
            if stato != "OK":
                print(f"  ! cartella saltata: {leggibile}")
                continue
            _, val = imap.response("UIDVALIDITY")
            validita = val[0].decode() if val and val[0] else "0"
            cartella = radice / leggibile / f"uidvalidity-{validita}"
            stato, dati = imap.uid("SEARCH", None, "ALL")
            tutti = [int(u) for u in dati[0].split()] if stato == "OK" and dati[0] else []
            mancanti = sorted(set(tutti) - uid_gia_scaricati(cartella))
            print(f"  {leggibile}: {len(tutti)} messaggi, da scaricare {len(mancanti)}")
            if not mancanti:
                continue
            cartella.mkdir(parents=True, exist_ok=True)
            for i in range(0, len(mancanti), LOTTO_POSTA):
                lotto = ",".join(str(u) for u in mancanti[i:i + LOTTO_POSTA])
                stato, dati = imap.uid("FETCH", lotto, "(UID INTERNALDATE BODY.PEEK[])")
                if stato != "OK":
                    print(f"    ! lotto non scaricato ({lotto[:40]}...), riprova più tardi")
                    continue
                for uid, data, contenuto in messaggi_dal_fetch(dati):
                    prefisso = data.strftime("%Y-%m-%d") if data else "senza-data"
                    file = cartella / f"{prefisso}_{uid}.eml"
                    scrivi_atomico(file, lambda f, c=contenuto: f.write(c))
                    if data:
                        os.utime(file, (data.timestamp(), data.timestamp()))
                    totale += 1
                print(f"    {min(i + LOTTO_POSTA, len(mancanti))}/{len(mancanti)}")
    finally:
        try:
            imap.logout()
        except Exception:
            pass
    print(f"  Posta: {totale} messaggi nuovi salvati.")


# --- iCloud Drive (pyicloud) ---------------------------------------------


def accedi_icloud(apple_id):
    try:
        from pyicloud import PyiCloudService
    except ImportError:
        sys.exit("Manca pyicloud: esegui  pip install -r requirements.txt")
    password = getpass.getpass("Password dell'Apple ID (per iCloud Drive): ")
    api = PyiCloudService(apple_id, password)
    if api.requires_2fa:
        if api.request_2fa_code():
            print("Codice richiesto: guarda il tuo iPhone, iPad o Mac (o gli SMS).")
        for _ in range(3):
            codice = input("Codice di verifica a 6 cifre: ").strip()
            if api.validate_2fa_code(codice):
                break
            print("Codice non valido.")
        else:
            sys.exit("Verifica a due fattori non riuscita.")
        if not api.is_trusted_session:
            api.trust_session()
    elif api.requires_2sa:
        sys.exit("Questo account usa la vecchia verifica in due passaggi: non supportata.")
    return api


def scarica_file(nodo, file):
    """Scarica un file di iCloud Drive, con tre tentativi. True se riuscito."""
    for tentativo in range(3):
        try:
            with nodo.open(stream=True) as risposta:
                scrivi_atomico(
                    file, lambda f: shutil.copyfileobj(risposta.raw, f, 1024 * 1024)
                )
            return True
        except Exception as e:
            if tentativo == 2:
                print(f"  ! non scaricato: {file} ({e})")
                return False
            time.sleep(2 ** tentativo)


def scarica_nodo(nodo, cartella, conteggio):
    for figlio in nodo.get_children():
        nome = nome_sicuro(figlio.name)
        if figlio.type in ("folder", "app_library"):
            scarica_nodo(figlio, cartella / nome, conteggio)
            continue
        if figlio.type != "file":
            continue
        file = cartella / nome
        if file.exists() and file.stat().st_size == (figlio.size or 0):
            conteggio["saltati"] += 1
            continue
        cartella.mkdir(parents=True, exist_ok=True)
        if not scarica_file(figlio, file):
            conteggio["errori"] += 1
            continue
        modificato = figlio.date_modified
        if modificato:
            os.utime(file, (modificato.timestamp(), modificato.timestamp()))
        conteggio["nuovi"] += 1
        print(f"  + {file}")


def scarica_drive(apple_id, destinazione):
    radice = destinazione / "drive"
    print(f"\n== iCloud Drive -> {radice}")
    api = accedi_icloud(apple_id)
    conteggio = {"nuovi": 0, "saltati": 0, "errori": 0}
    scarica_nodo(api.drive.root, radice, conteggio)
    print(
        f"  Drive: {conteggio['nuovi']} file nuovi, {conteggio['saltati']} già presenti,"
        f" {conteggio['errori']} errori."
    )


# --- Foto (icloudpd) ------------------------------------------------------


def scarica_foto(apple_id, destinazione):
    radice = destinazione / "foto"
    print(f"\n== Foto -> {radice}")
    eseguibile = shutil.which("icloudpd")
    if not eseguibile:
        sys.exit("Manca icloudpd: esegui  pip install -r requirements.txt")
    radice.mkdir(parents=True, exist_ok=True)
    # Senza --delete-after-download / --auto-delete: icloudpd non tocca iCloud.
    comando = [
        eseguibile,
        "--directory", str(radice),
        "--folder-structure", "{:%Y/%m}",
        "--username", apple_id,
    ]
    risultato = subprocess.run(comando)
    if risultato.returncode != 0:
        sys.exit(f"icloudpd terminato con codice {risultato.returncode}")


def main():
    parser = argparse.ArgumentParser(
        description="Copia locale di iCloud (posta, Drive, foto). Solo lettura."
    )
    parser.add_argument("cosa", choices=["tutto", "posta", "drive", "foto"])
    parser.add_argument("--apple-id", required=True, help="email dell'Apple ID")
    parser.add_argument(
        "--email-icloud",
        help="indirizzo @icloud.com per la posta, se diverso dall'Apple ID",
    )
    parser.add_argument(
        "--destinazione",
        default=str(Path.home() / "Backup-iCloud"),
        help="cartella locale (predefinita: ~/Backup-iCloud)",
    )
    args = parser.parse_args()
    destinazione = Path(args.destinazione).expanduser()
    destinazione.mkdir(parents=True, exist_ok=True)

    if args.cosa in ("tutto", "posta"):
        scarica_posta(args.email_icloud or args.apple_id, destinazione)
    if args.cosa in ("tutto", "drive"):
        scarica_drive(args.apple_id, destinazione)
    if args.cosa in ("tutto", "foto"):
        scarica_foto(args.apple_id, destinazione)
    print(f"\nFatto. Tutto in {destinazione}")


if __name__ == "__main__":
    main()
