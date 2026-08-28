import React from 'react';
import Ic from './Ic.jsx';

export default function LoadingState({ title = 'Caricamento…', message, icon = 'refresh' }) {
  return (
    <div className="pol-ui-state pol-ui-state--loading" role="status" aria-live="polite">
      <div className="pol-ui-state__icon" aria-hidden="true"><Ic n={icon} s={22} /></div>
      <div className="pol-ui-state__title">{title}</div>
      {message && <div className="pol-ui-state__message">{message}</div>}
    </div>
  );
}
