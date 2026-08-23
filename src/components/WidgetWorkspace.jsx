import React, { Children, useRef, useState } from 'react';
import { getHomeWidget, getHomeWidgetIdFromReactKey } from '../lib/homeWidgetRegistry.js';
import './WidgetWorkspace.css';

/* POL-UI-013: touch-compatible drag & drop.
   The existing HTML5 native drag (draggable/onDragStart/onDragOver/onDrop,
   kept below unchanged) only fires with a mouse — touch devices never
   receive dragstart at all. This adds a second, independent mechanism
   using the Pointer Events API (the same primitive already used by
   src/components/poliedron/usePoliedronPosition.js for the Orb's own
   drag), active only from the drag handle, so a normal tap/scroll inside
   a widget's card never starts a drag by accident. Both mechanisms call
   the same onMove callback and end up in the same normalized layout —
   whichever the input device supports "just works". */
function usePointerReorder(editing, onMove) {
  const dragState = useRef(null);
  const [draggingId, setDraggingId] = useState(null);

  const onHandlePointerDown = (id) => (event) => {
    if (!editing || event.button === 2) return;
    dragState.current = { id, lastTargetId: id };
    setDraggingId(id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const onPointerMove = (event) => {
    const state = dragState.current;
    if (!state) return;
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const frame = el?.closest?.('[data-widget-id]');
    const targetId = frame?.getAttribute('data-widget-id');
    if (targetId && targetId !== state.lastTargetId) {
      state.lastTargetId = targetId;
      onMove(state.id, targetId);
    }
  };

  const onPointerUp = () => {
    dragState.current = null;
    setDraggingId(null);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  };

  return { draggingId, onHandlePointerDown };
}

export default function WidgetWorkspace({ children, layout, editing, previewMode, onMove, onMoveByOffset, onResize }) {
  const childById = new Map(Children.toArray(children).filter(Boolean).map((child) => [getHomeWidgetIdFromReactKey(child.key), child]));
  const { draggingId, onHandlePointerDown } = usePointerReorder(editing, onMove);
  return (
    <div className={`home-widget-preview home-widget-preview--${previewMode}`} data-testid="home-widget-preview">
      <div className="home-widget-grid">
        {layout.filter((item) => item.visible).map((item, index, visibleItems) => {
          const content = childById.get(item.id);
          const widget = getHomeWidget(item.id);
          if (!content || !widget) return null;
          return (
            <section key={item.id} className={`home-widget-frame home-widget-frame--${item.size}${draggingId === item.id ? ' home-widget-frame--dragging' : ''}`} data-widget-id={item.id}
              draggable={editing}
              onDragStart={(event) => event.dataTransfer.setData('text/home-widget-id', item.id)}
              onDragOver={(event) => editing && event.preventDefault()}
              onDrop={(event) => { if (editing) onMove(event.dataTransfer.getData('text/home-widget-id'), item.id); }}>
              {editing && <div className="home-widget-frame__toolbar">
                <span className="home-widget-frame__handle" title="Trascina per spostare" aria-label={`Trascina per spostare ${widget.label}`}
                  onPointerDown={onHandlePointerDown(item.id)}>⠿ {widget.label}</span>
                <div className="home-widget-frame__move" aria-label={`Posizione ${widget.label}`}>
                  <button type="button" disabled={index === 0} onClick={() => onMoveByOffset(item.id, -1)} aria-label={`Sposta su ${widget.label}`}>↑<span>Sposta su</span></button>
                  <button type="button" disabled={index === visibleItems.length - 1} onClick={() => onMoveByOffset(item.id, 1)} aria-label={`Sposta giù ${widget.label}`}>↓<span>Sposta giù</span></button>
                </div>
                {widget.sizes.length > 1 && <div className="home-widget-frame__sizes" aria-label={`Dimensione ${widget.label}`}>
                  {widget.sizes.map((size) => <button key={size} type="button" className={item.size === size ? 'is-active' : ''}
                    aria-label={`${widget.label}: dimensione ${size === 'small' ? 'piccola' : size === 'medium' ? 'media' : 'grande'}`}
                    aria-pressed={item.size === size}
                    onClick={() => onResize(item.id, size)}>{size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}</button>)}
                </div>}
              </div>}
              <div className="home-widget-frame__content">{content}</div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
