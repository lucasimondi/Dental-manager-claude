import React from 'react';

// POL-UI-040: pairs with lazyWithRetry.js — a rejected lazy import is
// retried once via a forced reload; if it still fails (a genuinely broken
// chunk, not a transient stale-cache blip), or any other route component
// throws during render, there was previously NO error boundary anywhere
// above the app's single Suspense block, so React would just unmount
// silently with nothing shown but a blank page and a console error. This
// gives that failure a real, recoverable screen instead.
export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
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
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px', borderRadius: 10, border: 'none', background: '#185FA5',
                color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              Ricarica
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
