import React from 'react';
import { hardReload } from '../lib/hardReload.js';

// POL-UI-040: pairs with lazyWithRetry.js — a rejected lazy import is
// retried once via a forced reload; if it still fails (a genuinely broken
// chunk, not a transient stale-cache blip), or any other route component
// throws during render, there was previously NO error boundary anywhere
// above the app's single Suspense block, so React would just unmount
// silently with nothing shown but a blank page and a console error. This
// gives that failure a real, recoverable screen instead.
//
// Follow-up: the Product Owner still landed on this screen right after
// the automatic retry should have fixed a stale chunk — a plain reload
// was not enough because the service worker itself can serve the same
// stale cache to the reload's own requests. The "Ricarica" button below
// now goes through hardReload() (clears the service worker + Cache
// Storage first) for the same reason, and the caught error's message is
// shown on screen so the Product Owner can read it out directly instead
// of only a screenshot of the generic message.
export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || String(error) };
  }

  componentDidCatch(error) {
    console.error('RouteErrorBoundary caught an error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#F0F4F8', padding: 24, boxSizing: 'border-box',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 320 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2433', marginBottom: 6 }}>
              Qualcosa è andato storto
            </div>
            <div style={{ fontSize: 13, color: '#5F6B7A', marginBottom: 16 }}>
              Non è stato possibile caricare questa pagina. Tocca per ricaricare.
            </div>
            <button
              onClick={() => hardReload()}
              style={{
                padding: '10px 20px', borderRadius: 10, border: 'none', background: '#185FA5',
                color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              Ricarica
            </button>
            {this.state.errorMessage && (
              <div style={{ marginTop: 14, fontSize: 10.5, color: '#8A93A0', wordBreak: 'break-word' }}>
                {this.state.errorMessage}
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
