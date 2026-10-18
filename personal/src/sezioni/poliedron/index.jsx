// Sezione Poliedron: la chat sull'archivio, a pagina intera nel dock.
import { IconaChat } from '../../Icone.jsx';
import { CHAT_VUOTA } from '../../lib/chat.js';
import { VistaPoliedron } from './Poliedron.jsx';

// In testata: "Nuova chat" quando c'è una conversazione (il modo AI/ricerca resta).
function AzioniPoliedron({ ctx }) {
  const { chat, setChat } = ctx;
  if (!chat.messaggi.length) return null;
  return <button className="pp-testo-link pp-nuova-chat" onClick={() => setChat((c) => ({ ...CHAT_VUOTA, modo: c.modo }))}>Nuova chat</button>;
}

export const poliedron = {
  id: 'poliedron', nome: 'Poliedron', Icona: IconaChat, Vista: VistaPoliedron, AzioniTestata: AzioniPoliedron,
  classeContenuto: 'pp-contenuto-chat', senzaPiu: true, pagine: {},
};
