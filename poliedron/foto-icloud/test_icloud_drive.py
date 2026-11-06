"""Test di icloud_drive.py con una fototeca finta (nessun accesso a iCloud).

Esecuzione: python3 -m unittest test_icloud_drive.py
"""

from __future__ import annotations

import os
import stat
import sys
import tempfile
import textwrap
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import icloud_drive as t  # noqa: E402


class Risorsa:
    def __init__(self, filename, key="original"):
        self.filename, self.key, self.url = filename, key, "https://esempio.invalid/" + filename


class Foto:
    def __init__(self, id, filename, data, movie=False, live=False, rotta=False):
        self.id, self.filename, self.asset_date = id, filename, data
        self.item_type = "movie" if movie else "image"
        self.is_live_photo = live
        self.rotta = rotta
        self.resources = {"original": Risorsa(filename)}
        if live:
            self.resources["original_video"] = Risorsa(filename.rsplit(".", 1)[0] + ".MOV", "original_video")
        self.scaricamenti = 0

    def download(self, version="original"):
        self.scaricamenti += 1
        if self.rotta:
            raise RuntimeError("rete")
        return f"{self.id}:{version}".encode()


def libreria(n, inizio=0):
    return [Foto(f"ID{i:05d}", f"IMG_{i % 3}.HEIC", datetime(2020 + i % 2, 1 + i % 12, 1, tzinfo=timezone.utc))
            for i in range(inizio, inizio + n)]


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.stato = t.Stato(self.dir / "registro.sqlite")
        self.temp = self.dir / "temporanei"
        self.drive = self.dir / "drive"
        self.dest = t.Destinazione(str(self.drive))

    def tearDown(self):
        self.stato.db.close()
        self.tmp.cleanup()

    def file_drive(self):
        return sorted(p.relative_to(self.drive).as_posix() for p in self.drive.rglob("*") if p.is_file())


class TestLotti(Base):
    def test_lotti_da_1000_riprendono_e_finiscono(self):
        foto = libreria(2500)
        opz = t.Opzioni(lotto=1000)
        e1 = t.esegui_lotto(foto, self.stato, self.temp, self.dest, opz)
        self.assertEqual((e1["foto"], e1["file"], e1["finito"]), (1000, 1000, 0))
        e2 = t.esegui_lotto(foto, self.stato, self.temp, self.dest, opz)
        self.assertEqual((e2["foto"], e2["finito"]), (1000, 0))
        e3 = t.esegui_lotto(foto, self.stato, self.temp, self.dest, opz)
        self.assertEqual((e3["foto"], e3["finito"]), (500, 1))
        self.assertEqual(len(self.file_drive()), 2500)
        self.assertTrue(all(f.scaricamenti == 1 for f in foto), "nessuna foto scaricata due volte")
        self.assertEqual(self.stato.riepilogo()["foto"], 2500)
        self.assertEqual(list(self.temp.rglob("*.HEIC")), [], "i temporanei si svuotano dopo il caricamento")
        e4 = t.esegui_lotto(foto, self.stato, self.temp, self.dest, opz)
        self.assertEqual(e4["foto"], 0)

    def test_nomi_uguali_non_si_sovrascrivono(self):
        foto = libreria(30)
        t.esegui_lotto(foto, self.stato, self.temp, self.dest, t.Opzioni(lotto=100))
        file = self.file_drive()
        self.assertEqual(len(file), 30)
        self.assertEqual(len(set(file)), 30)
        self.assertTrue(all(f.split("/")[0] in {"2020", "2021"} for f in file))

    def test_foto_nuove_entrano_nel_lotto_dopo(self):
        foto = libreria(10)
        t.esegui_lotto(foto, self.stato, self.temp, self.dest, t.Opzioni(lotto=1000))
        foto = libreria(5, inizio=10) + foto  # le nuove arrivano in cima
        e = t.esegui_lotto(foto, self.stato, self.temp, self.dest, t.Opzioni(lotto=1000))
        self.assertEqual(e["foto"], 5)
        self.assertEqual(len(self.file_drive()), 15)

    def test_video_e_live(self):
        d = datetime(2022, 5, 1, tzinfo=timezone.utc)
        foto = [Foto("V1", "clip.MOV", d, movie=True), Foto("L1", "IMG_9.HEIC", d, live=True)]
        t.esegui_lotto(foto, self.stato, self.temp, self.dest, t.Opzioni(video=False))
        self.assertEqual(self.file_drive(), ["2022/05/IMG_9.HEIC"])
        # più tardi l'utente chiede anche video e Live: si aggiunge solo ciò che manca
        t.esegui_lotto(foto, self.stato, self.temp, self.dest, t.Opzioni(video=True, live=True))
        self.assertEqual(self.file_drive(), ["2022/05/IMG_9.HEIC", "2022/05/IMG_9.MOV", "2022/05/clip.MOV"])
        self.assertEqual(foto[1].scaricamenti, 2)  # foto una volta, video Live una volta

    def test_errore_di_rete_si_riprova(self):
        foto = libreria(3)
        foto[1].rotta = True
        e = t.esegui_lotto(foto, self.stato, self.temp, self.dest, t.Opzioni())
        self.assertEqual((e["file"], e["errori"]), (2, 1))
        foto[1].rotta = False
        e = t.esegui_lotto(foto, self.stato, self.temp, self.dest, t.Opzioni())
        self.assertEqual((e["foto"], e["file"]), (1, 1))

    def test_poco_spazio_chiude_il_lotto(self):
        foto = libreria(10)
        e = t.esegui_lotto(foto, self.stato, self.temp, self.dest, t.Opzioni(), spazio_libero=lambda p: 0)
        self.assertEqual((e["foto"], e["finito"]), (0, 0))

    def test_ripresa_dopo_interruzione(self):
        self.temp.mkdir(parents=True)
        (self.temp / "2020/01").mkdir(parents=True)
        (self.temp / "2020/01/a.HEIC").write_bytes(b"x")
        self.stato.segna_scaricato("A", "original", "2020/01/a.HEIC", 1)
        self.stato.segna_scaricato("B", "original", "2020/01/b.HEIC", 1)  # file perso
        self.assertEqual(t.riprendi_sospesi(self.stato, self.temp, self.dest), 1)
        self.assertEqual(self.file_drive(), ["2020/01/a.HEIC"])
        self.assertEqual(self.stato.in_sospeso(), [])
        self.assertFalse(self.stato.risorsa_nota("B", "original"), "il file perso si riscarica")


class TestRclone(Base):
    def test_carica_con_rclone(self):
        bin_dir = self.dir / "bin"
        bin_dir.mkdir()
        finto = bin_dir / "rclone"
        # rclone finto: 'move SRC gdrive:X --files-from F' sposta i file elencati in self.dir/remoto
        finto.write_text(textwrap.dedent(f"""\
            #!{sys.executable}
            import sys, shutil, pathlib
            a = sys.argv[1:]
            if a[0] == "listremotes":
                print("gdrive:"); sys.exit(0)
            src = pathlib.Path(a[1]); dst = pathlib.Path({str(self.dir / "remoto")!r}) / a[2].split(":", 1)[1]
            for rel in pathlib.Path(a[a.index("--files-from") + 1]).read_text().split():
                (dst / rel).parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(src / rel), str(dst / rel))
            """))
        finto.chmod(finto.stat().st_mode | stat.S_IEXEC)
        dest = t.Destinazione("gdrive:Foto iCloud", rclone=str(finto))
        self.assertTrue(dest.remota)
        dest.controlla()
        e = t.esegui_lotto(libreria(5), self.stato, self.temp, dest, t.Opzioni())
        self.assertEqual(e["file"], 5)
        remoto = list((self.dir / "remoto" / "Foto iCloud").rglob("*.HEIC"))
        self.assertEqual(len(remoto), 5)

    def test_percorsi_windows_e_locali_non_sono_remoti(self):
        self.assertFalse(t.Destinazione(r"C:\Users\me\Google Drive").remota)
        self.assertFalse(t.Destinazione("/Users/me/Google Drive/Foto").remota)
        self.assertTrue(t.Destinazione("gdrive:").remota)


class TestNomi(unittest.TestCase):
    def test_nome_sicuro(self):
        self.assertEqual(t.nome_sicuro("../x/IMG:1.HEIC"), "IMG-1.HEIC")
        self.assertEqual(t.nome_sicuro(""), "foto")

    def test_argomenti(self):
        with self.assertRaises(SystemExit):
            t.leggi_argomenti(["--apple-id", "a@b.c"])  # manca la destinazione
        a = t.leggi_argomenti(["--apple-id", "a@b.c", "--conta"])
        self.assertEqual(a.lotto, 1000)


if __name__ == "__main__":
    unittest.main()
