// Synthetic documents only. Real Scan routing + manager; sharing is intercepted, never sent.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PDFDocument } from 'pdf-lib';
import { Scan } from '../../personal/src/scan/Scan.jsx';
import '../../personal/src/personal.css';
import '../../personal/src/pro.css';
import '../../personal/src/icone-base.css';
let receiver;
Object.defineProperty(window, 'launchQueue', { configurable: true, value: { setConsumer(fn) { receiver = fn; } } });
async function sample(name, pages) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) { const page = doc.addPage([420, 594]); page.drawText(`DOCUMENTO DI PROVA - PAGINA ${i+1}`, { x: 25, y: 530, size: 14 }); }
  const field = doc.getForm().createTextField('Esempio'); field.setText('CAMPO MODIFICABILE'); field.addToPage(doc.getPage(0), {x:30,y:450,width:300,height:30});
  return new File([await doc.save()], name, { type:'application/pdf' });
}
function Fixture() {
  const [result,setResult] = useState('Nessun invio');
  Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
  Object.defineProperty(navigator,'share',{configurable:true,value:async ({files})=>{
    const details = [];
    for (const file of files) { const doc = await PDFDocument.load(await file.arrayBuffer()); details.push(`${file.name}: ${doc.getPageCount()} pagine, ${doc.getForm().getFields().length} campi`); }
    setResult(`Invio simulato: ${details.join(' | ')}`);
  }});
  return <><aside style={{padding:12,background:'#eef7f3',position:'relative',zIndex:5}}><button onClick={async()=>{const files=[await sample('Referto prova.pdf',3),await sample('Ricevuta prova.pdf',1)];receiver({files:files.map(f=>({getFile:async()=>f}))});}}>Carica due PDF di prova</button><p role="status">{result}</p></aside><Scan email="test@example.invalid" /></>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture /></React.StrictMode>);
