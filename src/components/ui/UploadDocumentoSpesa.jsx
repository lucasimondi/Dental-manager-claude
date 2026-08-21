import React, { useState, useRef, useEffect } from 'react';
import Btn from './Btn.jsx';
import { Crd } from './atoms.jsx';
import Modal from './Modal.jsx';
import Ic from './Ic.jsx';
import { C } from '../../lib/utils';
import { supabase } from '../../lib/supabase.js';

const SUPABASE_URL = 'https://idklxdqebfceplrualgh.supabase.co';

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Modal con anteprima live della webcam (getUserMedia) — serve soprattutto su
// desktop, dove il file picker del sistema operativo non offre quasi mai
// un'opzione "scatta foto" come fa invece il picker nativo su mobile.
function ModalWebcam({ onScatta, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [errore, setErrore] = useState('');

  useEffect(() => {
    let annullato = false;
    navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (annullato) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setErrore('Non riesco ad accedere alla webcam — controlla i permessi del browser.'));
    return () => {
      annullato = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const scatta = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onScatta(new File([blob], `webcam-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  };

  return (
    <Modal title="Scatta con la webcam" icon="eye" onClose={onClose}>
      {errore ? (
        <div style={{ color: C.dan, fontSize: 12.5, padding: '10px 0' }}>{errore}</div>
      ) : (
        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 10, background: '#000', marginBottom: 12 }} />
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn ch="Annulla" v="sec" onClick={onClose} full />
        <Btn ch="Scatta" onClick={scatta} dis={!!errore} full />
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
// Upload + lettura automatica documento (bolletta/fattura/busta paga/fattura
// macchinario/spesa condominiale...) — condiviso da Costi.jsx e Spese.jsx,
// così l'estrazione AI resta identica ovunque si carichi un documento.
// Due modi per fornire l'immagine: il file picker nativo (che su mobile
// propone già scatta/galleria/file se non si forza l'attributo "capture",
// che invece salterebbe dritto alla fotocamera) e un pulsante dedicato con
// anteprima webcam live, utile soprattutto su desktop.
// ─────────────────────────────────────────────────────────────────
export default function UploadDocumento({ onEstratto, titolo = 'Carica bolletta, fattura o scontrino', sottotitolo = 'Foto o PDF — i dati vengono letti automaticamente' }) {
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState('');
  const [webcamAperta, setWebcamAperta] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setErrore('');
    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/estrai-spesa-documento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ file_base64: base64, media_type: file.type }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        setErrore(data.error || 'Non sono riuscito a leggere il documento — puoi comunque inserirlo a mano.');
        setLoading(false);
        return;
      }
      onEstratto(data.estratto, file);
    } catch (e) {
      setErrore('Errore di caricamento: ' + String(e));
    }
    setLoading(false);
  };

  return (
    <Crd style={{ marginBottom: 14, textAlign: 'center', padding: 18, border: `1.5px dashed ${C.brd}` }}>
      <input ref={inputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
        onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ''; }} />
      {loading ? (
        <div style={{ color: C.txl, fontSize: 13 }}>Sto leggendo il documento...</div>
      ) : (
        <>
          <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}><Ic n="file" s={28} c={C.txl} /></div>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.txt, marginBottom: 3 }}>{titolo}</div>
          <div style={{ fontSize: 11, color: C.txl, marginBottom: 10 }}>{sottotitolo}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Btn ch="Scatta foto o scegli file" ic="send" onClick={() => inputRef.current?.click()} />
            <Btn ch="Usa la webcam" ic="eye" v="sec" onClick={() => setWebcamAperta(true)} />
          </div>
        </>
      )}
      {errore && <div style={{ color: C.dan, fontSize: 11, marginTop: 8 }}>{errore}</div>}
      {webcamAperta && (
        <ModalWebcam
          onClose={() => setWebcamAperta(false)}
          onScatta={(file) => { setWebcamAperta(false); handleFile(file); }}
        />
      )}
    </Crd>
  );
}
