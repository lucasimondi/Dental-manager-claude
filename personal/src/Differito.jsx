// Keep section metadata synchronous; download each screen only when it is rendered.
import { Component, createElement, lazy, Suspense } from 'react';

class ErroreModulo extends Component {
  state = { errore: false };
  static getDerivedStateFromError() { return { errore: true }; }
  render() {
    if (this.state.errore) return (
      <div className="pp-messaggio pp-messaggio-errore" role="alert">
        <p>Impossibile aprire questa schermata. Controlla la connessione.</p>
        <button className="pp-bottone" onClick={() => window.location.reload()}>Riprova</button>
      </div>
    );
    return this.props.children;
  }
}

export function differito(carica, nome) {
  const Schermata = lazy(() => carica().then((modulo) => ({ default: modulo[nome] })));
  function Differito(props) {
    return (
      <ErroreModulo>
        <Suspense fallback={<p className="pp-riga-meta" role="status">Apertura…</p>}>
          {createElement(Schermata, props)}
        </Suspense>
      </ErroreModulo>
    );
  }
  Differito.displayName = `Differito(${nome})`;
  return Differito;
}
