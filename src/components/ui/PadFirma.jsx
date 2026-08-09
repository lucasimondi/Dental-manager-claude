import React, { useRef, useState, useEffect } from 'react';

const C_DEFAULT = { pri: '#185FA5', brd: '#DCE1E6', txt: '#1A2433', txl: '#8A93A0' };

/**
 * Pannello di firma touch: il paziente firma col dito (o mouse/trackpad),
 * funziona identico su mobile, tablet e desktop perché disegna su un
 * <canvas> con eventi pointer unificati (non serve distinguere touch/mouse).
 * onFirmata riceve un data URL PNG della firma.
 */
export default function PadFirma({ onFirmata, onVuota, C = C_DEFAULT, altezza = 180 }) {
  const canvasRef = useRef(null);
  const disegnandoRef = useRef(false);
  const ultimoPuntoRef = useRef(null);
  const [haFirma, setHaFirma] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Adatta la risoluzione del canvas al device pixel ratio, altrimenti su
    // schermi retina la firma appare sgranata.
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = C.txt;
  }, [C.txt]);

  const posizioneRelativa = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const iniziaTratto = (e) => {
    e.preventDefault();
    disegnandoRef.current = true;
    ultimoPuntoRef.current = posizioneRelativa(e);
  };

  const continuaTratto = (e) => {
    if (!disegnandoRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const punto = posizioneRelativa(e);
    ctx.beginPath();
    ctx.moveTo(ultimoPuntoRef.current.x, ultimoPuntoRef.current.y);
    ctx.lineTo(punto.x, punto.y);
    ctx.stroke();
    ultimoPuntoRef.current = punto;
    if (!haFirma) setHaFirma(true);
  };

  const fineTratto = () => { disegnandoRef.current = false; };

  const cancella = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHaFirma(false);
    if (onVuota) onVuota();
  };

  const conferma = () => {
    if (!haFirma) return;
    const canvas = canvasRef.current;
    onFirmata(canvas.toDataURL('image/png'));
  };

  return (
    <div>
      <div style={{ position: 'relative', border: `1.5px dashed ${C.brd}`, borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: altezza, display: 'block', touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={iniziaTratto}
          onPointerMove={continuaTratto}
          onPointerUp={fineTratto}
          onPointerLeave={fineTratto}
        />
        {!haFirma && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.txl, fontSize: 13, pointerEvents: 'none' }}>
            Firma qui con il dito
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={cancella} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1.5px solid ${C.brd}`, background: '#fff', color: C.txl, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Cancella
        </button>
        <button
          onClick={conferma}
          disabled={!haFirma}
          style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: haFirma ? C.pri : C.brd, color: haFirma ? '#fff' : C.txl, fontWeight: 800, fontSize: 13, cursor: haFirma ? 'pointer' : 'default' }}
        >
          Conferma firma
        </button>
      </div>
    </div>
  );
}
