#!/usr/bin/env python3
"""Foto iCloud -> Google Drive, a lotti (POL-VITA-FOTO-ICLOUD).

Scarica le foto (e i video) dalla Fototeca iCloud a lotti di N elementi
(predefinito 1000), le carica su Google Drive e ricorda cosa ha già fatto,
così ogni lotto riparte da dove si era fermato il precedente.

Regole:
- Non cancella niente da iCloud (nessuna chiamata di eliminazione).
- La password Apple non si scrive mai nei file: si legge dal portachiavi del
  sistema (keyring) o si chiede a terminale. La sessione iCloud (cookie)
  resta solo nella cartella di lavoro locale, mai nel repository.
- Le copie locali temporanee si eliminano solo dopo il caricamento riuscito.

Destinazione:
- "remote:percorso" (con i due punti) -> caricamento con rclone (es. "gdrive:Foto iCloud").
- un percorso locale -> sposta i file in quella cartella (es. la cartella di
  Google Drive per desktop, che poi sincronizza da sola).

Uso rapido:
    python3 icloud_drive.py --apple-id tu@icloud.com --destinazione "gdrive:Foto iCloud"
    python3 icloud_drive.py --apple-id tu@icloud.com --destinazione "gdrive:Foto iCloud" --continua
    python3 icloud_drive.py --apple-id tu@icloud.com --conta
"""

from __future__ import annotations

import argparse
import getpass
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Callable, Iterable, Iterator

CARTELLA_LAVORO = Path(os.environ.get("ICLOUD_DRIVE_HOME", "~/.icloud-drive-foto")).expanduser()
LOTTO_PREDEFINITO = 1000
SPAZIO_MINIMO_BYTE = 2 * 1024**3  # si ferma prima se restano meno di 2 GB liberi
CARATTERI_VIETATI = re.compile(r'[\x00-\x1f<>:"/\\|?*]')


def log(msg: str) -> None:
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


# --------------------------------------------------------------------------- stato

class Stato:
    """Registro SQLite di ciò che è stato scaricato e caricato."""

    def __init__(self, percorso: Path):
        percorso.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(percorso)
        self.db.executescript(
            """
            create table if not exists file (
              asset_id text not null,
              risorsa text not null,
              percorso text not null unique,
              dimensione integer,
              stato text not null check (stato in ('scaricato','caricato')),
              scaricato_il text,
              caricato_il text,
              primary key (asset_id, risorsa)
            );
            create table if not exists lotti (
              id integer primary key autoincrement,
              iniziato_il text, finito_il text,
              foto integer default 0, file integer default 0, byte integer default 0,
              errori integer default 0, note text
            );
            """
        )
        self.db.commit()

    def risorsa_nota(self, asset_id: str, risorsa: str) -> bool:
        return self.db.execute(
            "select 1 from file where asset_id=? and risorsa=?", (asset_id, risorsa)
        ).fetchone() is not None

    def percorso_occupato(self, percorso: str, asset_id: str, risorsa: str) -> bool:
        riga = self.db.execute("select asset_id, risorsa from file where percorso=?", (percorso,)).fetchone()
        return riga is not None and tuple(riga) != (asset_id, risorsa)

    def segna_scaricato(self, asset_id: str, risorsa: str, percorso: str, dimensione: int) -> None:
        self.db.execute(
            "insert or replace into file(asset_id,risorsa,percorso,dimensione,stato,scaricato_il) values(?,?,?,?, 'scaricato', ?)",
            (asset_id, risorsa, percorso, dimensione, adesso()),
        )
        self.db.commit()

    def segna_caricato(self, percorsi: Iterable[str]) -> None:
        self.db.executemany(
            "update file set stato='caricato', caricato_il=? where percorso=?",
            [(adesso(), p) for p in percorsi],
        )
        self.db.commit()

    def in_sospeso(self) -> list[str]:
        return [r[0] for r in self.db.execute("select percorso from file where stato='scaricato' order by percorso")]

    def dimentica(self, percorsi: Iterable[str]) -> None:
        """Toglie dal registro file scaricati ma spariti dalla cartella temporanea:
        al prossimo lotto verranno riscaricati."""
        self.db.executemany("delete from file where percorso=? and stato='scaricato'", [(p,) for p in percorsi])
        self.db.commit()

    def apri_lotto(self) -> int:
        cur = self.db.execute("insert into lotti(iniziato_il) values(?)", (adesso(),))
        self.db.commit()
        return int(cur.lastrowid)

    def chiudi_lotto(self, lotto: int, foto: int, file: int, byte: int, errori: int, note: str = "") -> None:
        self.db.execute(
            "update lotti set finito_il=?, foto=?, file=?, byte=?, errori=?, note=? where id=?",
            (adesso(), foto, file, byte, errori, note, lotto),
        )
        self.db.commit()

    def riepilogo(self) -> dict[str, int]:
        foto, file, byte = self.db.execute(
            "select count(distinct asset_id), count(*), coalesce(sum(dimensione),0) from file where stato='caricato'"
        ).fetchone()
        return {"foto": foto, "file": file, "byte": byte}


def adesso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# --------------------------------------------------------------------------- scelta dei file

def data_asset(asset: Any) -> datetime:
    for nome in ("asset_date", "created", "added_date"):
        try:
            valore = getattr(asset, nome, None)
        except Exception:  # proprietà che falliscono su asset incompleti
            valore = None
        if isinstance(valore, datetime):
            return valore if valore.tzinfo else valore.replace(tzinfo=timezone.utc)
    return datetime.fromtimestamp(0, timezone.utc)


def risorse_da_scaricare(asset: Any, video: bool, live: bool) -> list[tuple[str, Any]]:
    """Restituisce [(chiave, risorsa)] da scaricare per l'asset: l'originale e,
    se richiesto, il video delle Live Photo."""
    risorse = getattr(asset, "resources", None) or {}

    def prima(chiavi: Iterable[str]) -> tuple[str, Any] | None:
        for chiave in chiavi:
            r = risorse.get(chiave)
            if r is not None and getattr(r, "url", None):
                return getattr(r, "key", None) or chiave, r
        return None

    if getattr(asset, "item_type", "image") == "movie":
        if not video:
            return []
        scelta = prima(["original", "medium"])
        return [scelta] if scelta else []

    scelte: list[tuple[str, Any]] = []
    principale = prima(["original", "medium"])
    if principale:
        scelte.append(principale)
    if live and getattr(asset, "is_live_photo", False):
        mov = prima(["original_video", "medium_video"])
        if mov and mov[0] not in {c for c, _ in scelte}:
            scelte.append(mov)
    return scelte


def nome_sicuro(nome: str, riserva: str = "foto") -> str:
    nome = PurePosixPath(str(nome or "").replace("\\", "/")).name
    nome = CARATTERI_VIETATI.sub("-", nome).strip().strip(".")
    return nome or riserva


def percorso_relativo(asset: Any, risorsa: Any, chiave: str, stato: Stato, riservati: set[str]) -> str:
    """Cartella anno/mese dalla data di scatto + nome originale; se il nome è già
    usato da un'altra foto nella stessa cartella aggiunge un pezzo dell'id."""
    data = data_asset(asset)
    nome = nome_sicuro(getattr(risorsa, "filename", None) or getattr(asset, "filename", None) or "")
    cartella = f"{data:%Y}/{data:%m}"
    candidato = f"{cartella}/{nome}"
    radice, punto, est = nome.rpartition(".")
    if not punto:
        radice, est = nome, ""
    breve = re.sub(r"[^A-Za-z0-9]", "", str(asset.id))[:8] or "id"
    indice = 1
    while candidato in riservati or stato.percorso_occupato(candidato, asset.id, chiave):
        extra = f"_{breve}" if indice == 1 else f"_{breve}_{indice}"
        candidato = f"{cartella}/{radice}{extra}{'.' + est if est else ''}"
        indice += 1
    return candidato


# --------------------------------------------------------------------------- caricamento

@dataclass
class Destinazione:
    valore: str
    rclone: str = "rclone"

    @property
    def remota(self) -> bool:
        # "gdrive:Foto" è remota; "C:\\..." su Windows no.
        return bool(re.match(r"^[A-Za-z0-9_\-. ]{2,}:", self.valore))

    def controlla(self) -> None:
        if self.remota:
            if shutil.which(self.rclone) is None:
                raise SystemExit("rclone non trovato. Installalo (https://rclone.org/install/) e configura Google Drive con 'rclone config'.")
            remoto = self.valore.split(":", 1)[0] + ":"
            uscita = subprocess.run([self.rclone, "listremotes"], capture_output=True, text=True)
            if remoto not in uscita.stdout.split():
                raise SystemExit(f"Il remote rclone '{remoto}' non esiste. Crealo con 'rclone config' (tipo: drive).")
        else:
            Path(self.valore).expanduser().mkdir(parents=True, exist_ok=True)

    def carica(self, temporanea: Path, percorsi: list[str]) -> list[str]:
        """Carica i file e restituisce quelli caricati davvero (non più presenti
        nella cartella temporanea)."""
        if not percorsi:
            return []
        if self.remota:
            elenco = temporanea / ".elenco-lotto.txt"
            elenco.write_text("\n".join(percorsi) + "\n", encoding="utf-8")
            comando = [
                self.rclone, "move", str(temporanea), self.valore,
                "--files-from", str(elenco),
                "--transfers", "4", "--checkers", "8",
                "--retries", "5", "--low-level-retries", "20",
                "--stats", "30s", "--stats-one-line", "-v",
            ]
            log(f"Caricamento su {self.valore} con rclone ({len(percorsi)} file)…")
            esito = subprocess.run(comando)
            elenco.unlink(missing_ok=True)
            if esito.returncode != 0:
                log(f"rclone ha terminato con codice {esito.returncode}: i file non caricati restano e si riprovano al prossimo giro.")
        else:
            base = Path(self.valore).expanduser()
            log(f"Spostamento in {base} ({len(percorsi)} file)…")
            for p in percorsi:
                sorgente, arrivo = temporanea / p, base / p
                if not sorgente.exists():
                    continue
                arrivo.parent.mkdir(parents=True, exist_ok=True)
                if arrivo.exists() and arrivo.stat().st_size == sorgente.stat().st_size:
                    sorgente.unlink()
                    continue
                shutil.move(str(sorgente), str(arrivo))
        pulisci_cartelle_vuote(temporanea)
        return [p for p in percorsi if not (temporanea / p).exists()]


def pulisci_cartelle_vuote(radice: Path) -> None:
    for cartella in sorted((d for d in radice.rglob("*") if d.is_dir()), key=lambda d: len(d.parts), reverse=True):
        try:
            cartella.rmdir()
        except OSError:
            pass


# --------------------------------------------------------------------------- lotto

@dataclass
class Opzioni:
    lotto: int = LOTTO_PREDEFINITO
    video: bool = True
    live: bool = False
    spazio_minimo: int = SPAZIO_MINIMO_BYTE


def scrivi_atomico(percorso: Path, dati: bytes) -> None:
    percorso.parent.mkdir(parents=True, exist_ok=True)
    provvisorio = percorso.with_name(percorso.name + ".parziale")
    provvisorio.write_bytes(dati)
    os.replace(provvisorio, percorso)


def riprendi_sospesi(stato: Stato, temporanea: Path, dest: Destinazione) -> int:
    """Carica i file rimasti da un giro interrotto."""
    sospesi = stato.in_sospeso()
    if not sospesi:
        return 0
    presenti = [p for p in sospesi if (temporanea / p).exists()]
    spariti = [p for p in sospesi if p not in set(presenti)]
    if spariti:
        stato.dimentica(spariti)
    if presenti:
        log(f"Riprendo {len(presenti)} file scaricati ma non ancora caricati.")
        caricati = dest.carica(temporanea, presenti)
        stato.segna_caricato(caricati)
        return len(caricati)
    return 0


def esegui_lotto(
    foto: Iterable[Any],
    stato: Stato,
    temporanea: Path,
    dest: Destinazione,
    opz: Opzioni,
    spazio_libero: Callable[[Path], int] = lambda p: shutil.disk_usage(p).free,
) -> dict[str, int]:
    """Scarica fino a opz.lotto foto nuove, poi le carica. Restituisce il resoconto."""
    temporanea.mkdir(parents=True, exist_ok=True)
    lotto = stato.apri_lotto()
    scaricati: list[str] = []
    n_foto = byte = errori = esaminate = 0
    riservati: set[str] = set()
    nota = ""
    inizio = time.monotonic()
    for asset in foto:
        esaminate += 1
        if esaminate % 2000 == 0:
            log(f"…esaminate {esaminate} foto della fototeca")
        risorse = [
            (chiave, risorsa)
            for chiave, risorsa in risorse_da_scaricare(asset, opz.video, opz.live)
            if not stato.risorsa_nota(asset.id, chiave)
        ]
        if not risorse:
            continue
        if n_foto >= opz.lotto:
            break
        if spazio_libero(temporanea) < opz.spazio_minimo:
            nota = "spazio su disco quasi finito: lotto chiuso in anticipo"
            log(nota)
            break
        for chiave, risorsa in risorse:
            rel = percorso_relativo(asset, risorsa, chiave, stato, riservati)
            riservati.add(rel)
            try:
                dati = asset.download(chiave)
            except Exception as exc:  # rete, file non disponibile, ecc.
                dati = None
                log(f"Errore scaricando {rel}: {exc}")
            if not dati:
                errori += 1
                continue
            scrivi_atomico(temporanea / rel, dati)
            stato.segna_scaricato(asset.id, chiave, rel, len(dati))
            scaricati.append(rel)
            byte += len(dati)
        n_foto += 1
        if n_foto % 50 == 0:
            velocita = byte / max(time.monotonic() - inizio, 1) / 1024**2
            log(f"Scaricate {n_foto}/{opz.lotto} foto ({byte / 1024**3:.2f} GB, {velocita:.1f} MB/s)")

    caricati = dest.carica(temporanea, scaricati)
    stato.segna_caricato(caricati)
    non_caricati = len(scaricati) - len(caricati)
    stato.chiudi_lotto(lotto, n_foto, len(caricati), byte, errori + non_caricati, nota)
    return {
        "lotto": lotto, "foto": n_foto, "file": len(caricati), "byte": byte,
        "errori": errori, "non_caricati": non_caricati, "esaminate": esaminate,
        "finito": int(n_foto < opz.lotto and not nota),
    }


# --------------------------------------------------------------------------- iCloud

def accedi(apple_id: str, cartella_sessione: Path, cina: bool = False) -> Any:
    try:
        from pyicloud import PyiCloudService
        from pyicloud import utils as pu
    except ImportError:
        raise SystemExit("Manca la libreria pyicloud: esegui 'pip install -r requirements.txt'.")

    password = os.environ.get("ICLOUD_PASSWORD") or pu.get_password_from_keyring(apple_id)
    salva = False
    if not password:
        password = getpass.getpass(f"Password dell'ID Apple {apple_id}: ")
        salva = input("Salvarla nel portachiavi del computer? [s/N] ").strip().lower() in {"s", "si", "sì", "y"}
    cartella_sessione.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(cartella_sessione, 0o700)
    except OSError:
        pass
    api = PyiCloudService(apple_id, password, cookie_directory=str(cartella_sessione), china_mainland=cina or None)
    if salva:
        pu.store_password_in_keyring(apple_id, password)

    if api.requires_2fa:
        if not sys.stdin.isatty():
            raise SystemExit("Serve il codice di verifica Apple: esegui una volta lo script a mano da terminale.")
        try:
            if not api.request_2fa_code():
                raise SystemExit("Questo account richiede una chiave di sicurezza fisica: non supportata da questo script.")
        except SystemExit:
            raise
        except Exception:
            api.use_existing_trusted_device_code()
        print("Apple ha inviato un codice ai tuoi dispositivi (o via SMS).")
        for _ in range(3):
            if api.validate_2fa_code(input("Codice di verifica: ").strip()):
                break
            print("Codice non valido.")
        else:
            raise SystemExit("Verifica non riuscita.")
        if not api.is_trusted_session:
            api.trust_session()
    elif api.requires_2sa:
        dispositivi = list(api.trusted_devices or [])
        if not dispositivi:
            raise SystemExit("Verifica in due passaggi richiesta ma nessun dispositivo disponibile.")
        dispositivo = dispositivi[0]
        if not api.send_verification_code(dispositivo) or not api.validate_verification_code(
            dispositivo, input("Codice di verifica: ").strip()
        ):
            raise SystemExit("Verifica non riuscita.")
    return api


def fototeca(api: Any, libreria: str) -> Any:
    librerie = getattr(api.photos, "libraries", {}) or {}
    if libreria not in librerie:
        raise SystemExit(f"Libreria '{libreria}' non trovata. Disponibili: {', '.join(librerie) or 'nessuna'}.")
    return librerie[libreria].all


# --------------------------------------------------------------------------- main

def leggi_argomenti(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Scarica le foto da iCloud a lotti e le carica su Google Drive.")
    p.add_argument("--apple-id", default=os.environ.get("ICLOUD_APPLE_ID"), help="email dell'ID Apple")
    p.add_argument("--destinazione", default=os.environ.get("ICLOUD_DESTINAZIONE"),
                   help='"remote:cartella" di rclone (es. "gdrive:Foto iCloud") oppure una cartella locale di Google Drive')
    p.add_argument("--lotto", type=int, default=LOTTO_PREDEFINITO, help="foto per lotto (predefinito 1000)")
    p.add_argument("--continua", action="store_true", help="fa un lotto dopo l'altro finché la fototeca è tutta su Drive")
    p.add_argument("--max-lotti", type=int, default=0, help="con --continua: si ferma dopo N lotti (0 = nessun limite)")
    p.add_argument("--pausa", type=int, default=30, help="secondi di pausa tra un lotto e l'altro")
    p.add_argument("--senza-video", action="store_true", help="salta i video")
    p.add_argument("--live", action="store_true", help="scarica anche il breve video delle Live Photo")
    p.add_argument("--libreria", default="root", help='"root" (personale, predefinita) o la libreria condivisa')
    p.add_argument("--conta", action="store_true", help="conta solo le foto in iCloud e quelle già caricate, senza scaricare")
    p.add_argument("--cina", action="store_true", help="account iCloud della Cina continentale")
    p.add_argument("--cartella-lavoro", default=str(CARTELLA_LAVORO), help="sessione, registro e file temporanei")
    a = p.parse_args(argv)
    if not a.apple_id:
        p.error("serve --apple-id (o la variabile ICLOUD_APPLE_ID)")
    if not a.conta and not a.destinazione:
        p.error("serve --destinazione (o la variabile ICLOUD_DESTINAZIONE)")
    if a.lotto < 1:
        p.error("--lotto deve essere almeno 1")
    return a


def main(argv: list[str] | None = None) -> int:
    a = leggi_argomenti(argv)
    lavoro = Path(a.cartella_lavoro).expanduser()
    stato = Stato(lavoro / "registro.sqlite")
    temporanea = lavoro / "temporanei"

    api = accedi(a.apple_id, lavoro / "sessione", a.cina)
    album = fototeca(api, a.libreria)

    if a.conta:
        totale = len(album)
        fatte = stato.riepilogo()
        log(f"In iCloud: {totale} elementi. Già su Drive: {fatte['foto']} ({fatte['byte'] / 1024**3:.1f} GB).")
        return 0

    dest = Destinazione(a.destinazione)
    dest.controlla()
    riprendi_sospesi(stato, temporanea, dest)
    opz = Opzioni(lotto=a.lotto, video=not a.senza_video, live=a.live)

    n = 0
    while True:
        n += 1
        log(f"Lotto {n}: cerco fino a {a.lotto} foto non ancora caricate…")
        esito = esegui_lotto(album.photos, stato, temporanea, dest, opz)
        tot = stato.riepilogo()
        log(
            f"Lotto {n} finito: {esito['foto']} foto, {esito['file']} file caricati "
            f"({esito['byte'] / 1024**3:.2f} GB), errori {esito['errori']}, non caricati {esito['non_caricati']}. "
            f"Totale su Drive: {tot['foto']} foto."
        )
        if esito["finito"] or esito["foto"] == 0:
            log("Fototeca completata: non ci sono altre foto nuove.")
            break
        if not a.continua or (a.max_lotti and n >= a.max_lotti):
            log("Per il prossimo lotto riesegui lo stesso comando (o usa --continua).")
            break
        time.sleep(max(0, a.pausa))
        album = fototeca(api, a.libreria)  # rilegge la fototeca (foto nuove, sessione fresca)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        log("Interrotto. Riesegui lo stesso comando: riparte da dove si era fermato.")
        sys.exit(130)
