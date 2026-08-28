import React from 'react';
import Ic from './Ic.jsx';
import Btn from './Btn.jsx';

export default function ErrorState({ title = 'Qualcosa non ha funzionato', message, onRetry, retryLabel = 'Riprova' }) {
  return (
    <div className="pol-ui-state pol-ui-state--error" role="alert">
      <div className="pol-ui-state__icon" aria-hidden="true"><Ic n="warn" s={22} /></div>
      <div className="pol-ui-state__title">{title}</div>
      {message && <div className="pol-ui-state__message">{message}</div>}
      {onRetry && <div className="pol-ui-state__action"><Btn className="pol-retry" ch={retryLabel} onClick={onRetry} /></div>}
    </div>
  );
}
