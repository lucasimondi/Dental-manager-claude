const MAX_BYTES = 10 * 1024 * 1024;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const IMAGE_HEADERS = {
  'image/png': b => b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
  'image/jpeg': b => b[0] === 255 && b[1] === 216 && b[2] === 255,
  'image/webp': b => b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP'
};

// Never accept a caller-supplied Drive ID/URL: document comes from the RLS query.
export async function fetchOriginal(document, token, {endpoint, fetchImpl=fetch}={}) {
  if (!document || document.fascicolo === 'clinico_pazienti' || !/^[\w-]{10,}$/.test(document.drive_file_id || '')) throw Error('Document unavailable');
  if (!token || !endpoint) throw Error('Authentication required');
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('Secure archive endpoint required');
  const response = await fetchImpl(url, {
    method:'POST', redirect:'follow', signal:AbortSignal.timeout(25000),
    headers:{'content-type':'text/plain;charset=utf-8'},
    body:JSON.stringify({token,azione:'file',drive_file_id:document.drive_file_id})
  });
  if (!response.ok) throw Error('Original unavailable');
  // Bound the streamed JSON before allocating/decode, including chunked responses.
  const chunks=[]; let size=0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > Math.ceil(MAX_BYTES/3)*4+65536) { await response.body.cancel().catch(()=>{}); throw Error('File too large'); }
    chunks.push(chunk);
  }
  const file=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (file.ok !== true || typeof file.dati !== 'string' || !file.dati || !BASE64.test(file.dati)) throw Error('Invalid original');
  const bytes=Buffer.from(file.dati,'base64');
  if (!bytes.length || bytes.length>MAX_BYTES) throw Error('File too large');
  return {bytes,mime:String(file.mime||'').toLowerCase(),name:String(file.nome||'documento').slice(0,255)};
}

export async function contentBlocks(file, {start_page=1,page_count=3}={}) {
  const {bytes,mime}=file;
  if (IMAGE_HEADERS[mime]) {
    if(bytes.length>4*1024*1024) throw Error('Image too large');
    if (!IMAGE_HEADERS[mime](bytes)) throw Error('Invalid image');
    return {summary:{kind:'image',mime,bytes:bytes.length},blocks:[{type:'image',mimeType:mime,data:bytes.toString('base64')}]};
  }
  if (mime === 'text/plain' || mime === 'text/csv') {
    const text=bytes.toString('utf8');
    return {summary:{kind:'text',truncated:text.length>80000},blocks:[{type:'text',text:text.slice(0,80000)}]};
  }
  if (mime !== 'application/pdf' || bytes.toString('ascii',0,5) !== '%PDF-') throw Error('Unsupported content');
  // Explicit imports make the Node/native and worker dependencies visible to
  // serverless file tracing. PDF.js' implicit dynamic worker URL is not traced.
  const canvasModule=await import('@napi-rs/canvas');
  for(const name of ['DOMMatrix','ImageData','Path2D']) if(!globalThis[name])globalThis[name]=canvasModule[name];
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const {WorkerMessageHandler}=await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  globalThis.pdfjsWorker={WorkerMessageHandler};
  const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:true,stopAtErrors:true});
  try {
    const pdf=await task.promise;
    const start=Math.max(1,Math.floor(Number(start_page)||1));
    const count=Math.min(5,Math.max(1,Math.floor(Number(page_count)||3)));
    if(start>pdf.numPages) throw Error('Page outside document');
    const end=Math.min(pdf.numPages,start+count-1);
    const blocks=[]; const scanned=[]; let textTruncated=false; let emittedBytes=0; let lastPage=start-1;
    for(let number=start;number<=end;number++) {
      const page=await pdf.getPage(number);
      const data=await page.getTextContent();
      const text=data.items.map(item=>typeof item.str === 'string'?item.str+(item.hasEOL?'\n':' '):'').join('').trim();
      textTruncated ||= text.length>80000;
      if(text) {blocks.push({type:'text',text:`Pagina ${number}\n${text.slice(0,80000)}`}); emittedBytes+=Buffer.byteLength(text.slice(0,80000));}
      else {
        // Scanned pages have no text layer: render locally for ChatGPT vision.
        const viewport=page.getViewport({scale:1});
        const scale=Math.min(2,1600/Math.max(viewport.width,viewport.height));
        const scaled=page.getViewport({scale});
        const canvas=canvasModule.createCanvas(Math.max(1,Math.ceil(scaled.width)),Math.max(1,Math.ceil(scaled.height)));
        await page.render({canvasContext:canvas.getContext('2d'),viewport:scaled}).promise;
        const image=canvas.toBuffer('image/png');
        if(image.length>4*1024*1024) throw Error('Rendered page too large');
        if(emittedBytes+image.length>6*1024*1024 && lastPage>=start) {page.cleanup();break;}
        emittedBytes+=image.length;
        blocks.push({type:'text',text:`Pagina ${number}: scansione, leggere dall'immagine seguente.`},{type:'image',mimeType:'image/png',data:image.toString('base64')});
        scanned.push(number);
      }
      page.cleanup();
      lastPage=number;
    }
    return {summary:{kind:'pdf',total_pages:pdf.numPages,start_page:start,end_page:lastPage,next_page:lastPage<pdf.numPages?lastPage+1:null,scanned_pages:scanned,text_truncated:textTruncated},blocks};
  } finally {await task.destroy();}
}
