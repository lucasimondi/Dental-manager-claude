import { IconaTema } from '../../IconaTema.jsx';
import { IconaAltro, IconaFreccia, IconaImpostazioni } from '../../Icone.jsx';
import { conti } from '../conti/index.jsx';
import { personali } from '../personali/index.jsx';
import { foto } from '../foto/index.jsx';
import { legal } from '../legal/index.jsx';
import { diario } from '../diario/index.jsx';
import { didattica } from '../didattica/index.jsx';
import { oggi } from '../oggi/index.jsx';
import { password } from '../password/index.jsx';

const gruppi = [
  // HOME-AGENDA-CENTRIC: Oggi è uscito dal dock (l'agenda è la Home) e resta qui.
  { nome: 'La tua giornata', voci: [[oggi, 'Riepilogo, pagamenti, documenti e pratiche']] },
  { nome: 'La tua vita pratica', voci: [[personali, 'Identità, tessere e documenti di famiglia'], [password, 'Registro password, visibile solo a te'], [conti, 'Spese, incassi e pagamenti'], [legal, 'Pratiche e scadenze legali']] },
  { nome: 'Il tuo spazio', voci: [[foto, 'Album, immagini e video'], [diario, 'amor fati · Pensieri e riflessioni'], [didattica, 'Biblioteca · Filosofia e letture']] },
];
export function VistaAltro({ ctx }) {
  return <div className="pp-esplora">
    <p className="pp-intro">Tutto il tuo mondo, al posto giusto.</p>
    {gruppi.map(({ nome, voci }) => <section className="pp-sezione" key={nome} aria-label={nome}>
      <div className="pp-sezione-testa"><h2>{nome}</h2></div>
      <div className="pp-gruppo">{voci.map(([s, descrizione]) => <button key={s.id} className="pp-menu-voce" onClick={() => ctx.vai(s.id)}>
        <span className="pp-menu-icona"><IconaTema tipo={s.id} Icona={s.Icona} size={28} /></span><span className="pp-menu-testo"><strong>{s.nome}</strong><small>{descrizione}</small></span><IconaFreccia size={17} />
      </button>)}</div>
    </section>)}
    <button className="pp-menu-voce pp-menu-impostazioni" onClick={() => ctx.apri({ tipo: 'impostazioni' })}><span className="pp-menu-icona"><IconaImpostazioni size={23} /></span><span className="pp-menu-testo"><strong>Impostazioni</strong><small>Preferenze, persone e collegamenti</small></span><IconaFreccia size={17} /></button>
  </div>;
}
export const altro = { id: 'altro', nome: 'Altro', Icona: IconaAltro, Vista: VistaAltro, pagine: {}, senzaPiu: true };
