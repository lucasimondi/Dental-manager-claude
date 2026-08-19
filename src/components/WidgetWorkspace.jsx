import React, { Children } from 'react';
import { getHomeWidget, getHomeWidgetIdFromReactKey } from '../lib/homeWidgetRegistry.js';
import './WidgetWorkspace.css';

export default function WidgetWorkspace({ children, layout, editing, previewMode, onMove, onResize }) {
  const childById = new Map(Children.toArray(children).filter(Boolean).map((child) => [getHomeWidgetIdFromReactKey(child.key), child]));
  return (
    <div className={`home-widget-preview home-widget-preview--${previewMode}`} data-testid="home-widget-preview">
      <div className="home-widget-grid">
        {layout.filter((item) => item.visible).map((item) => {
          const content = childById.get(item.id);
          const widget = getHomeWidget(item.id);
          if (!content || !widget) return null;
          return (
            <section key={item.id} className={`home-widget-frame home-widget-frame--${item.size}`} data-widget-id={item.id}
              draggable={editing}
              onDragStart={(event) => event.dataTransfer.setData('text/home-widget-id', item.id)}
              onDragOver={(event) => editing && event.preventDefault()}
              onDrop={(event) => { if (editing) onMove(event.dataTransfer.getData('text/home-widget-id'), item.id); }}>
              {editing && <div className="home-widget-frame__toolbar">
                <span className="home-widget-frame__handle" title="Trascina per spostare">⠿ {widget.label}</span>
                {widget.sizes.length > 1 && <div className="home-widget-frame__sizes" aria-label={`Dimensione ${widget.label}`}>
                  {widget.sizes.map((size) => <button key={size} type="button" className={item.size === size ? 'is-active' : ''}
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
