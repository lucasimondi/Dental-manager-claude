import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { searchTreatmentPrices } from '../lib/patientEntryPresentation.js';
import './TreatmentPricePicker.css';

const money = value => Number.isFinite(Number(value)) && value !== '' && value != null
  ? Number(value).toLocaleString('it-IT', {style:'currency', currency:'EUR'}) : 'Prezzo da inserire';

export default function TreatmentPricePicker({ id, label, value, pricelist = [], onChange, onSelect }) {
  const listId = useId(), resultsRef = useRef(null), rootRef = useRef(null);
  const [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const options = searchTreatmentPrices(pricelist, value);
  const expanded = open && options.length > 0;
  useEffect(() => {
    if (!open) return;
    const click = event => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    // Close after the outside click has activated its intended control, never on focus/blur.
    document.addEventListener('click', click);
    return () => document.removeEventListener('click', click);
  }, [open]);
  useLayoutEffect(() => {
    const list = resultsRef.current, option = list?.children[active];
    if (!list || !option) return;
    const bounds = list.getBoundingClientRect(), row = option.getBoundingClientRect();
    if (row.bottom > bounds.bottom) list.scrollTop += row.bottom - bounds.bottom;
    else if (row.top < bounds.top) list.scrollTop -= bounds.top - row.top;
  }, [active]);
  const select = item => { onSelect(item); setOpen(false); setActive(-1); };
  return <div ref={rootRef} className="treatment-price-picker">
    <input id={id} role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? listId : undefined} aria-activedescendant={expanded && active >= 0 && active < options.length ? `${listId}-${active}` : undefined}
      autoComplete="off" placeholder="Cerca nel listino o scrivi una prestazione" value={value}
      onFocus={() => { setOpen(true); setActive(-1); }} onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1); }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Tab') setOpen(false);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(current => options.length ? current < 0 ? event.key === 'ArrowDown' ? 0 : options.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length : -1); }
        if (event.key === 'Enter' && expanded && active >= 0 && options[active]) { event.preventDefault(); select(options[active]); }
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); setActive(-1); }
      }} />
    {expanded && <div className="treatment-price-results"><div className="treatment-price-caption">Dal tuo listino <span>tocca per inserire</span></div>
      <div ref={resultsRef} id={listId} role="listbox" aria-label="Suggerimenti dal listino">{options.map((item, index) => <button type="button" role="option" tabIndex={-1} aria-selected={active === index} id={`${listId}-${index}`} key={`${item.id ?? item.nome}-${index}`}
        onMouseDown={event => event.preventDefault()} onClick={() => select(item)}>
        <span><strong>{item.nome}</strong>{(item.cat || item.cod) && <small>{[item.cat, item.cod].filter(Boolean).join(' · ')}</small>}</span><b>{money(item.prezzo)}</b>
      </button>)}</div>
    </div>}
    {open && !options.length && <p className="treatment-price-empty">{pricelist.length ? 'Nessuna corrispondenza. Puoi usare la voce che hai scritto e inserire il prezzo.' : 'Il listino è vuoto. Puoi scrivere una prestazione e il prezzo.'}</p>}
  </div>;
}
