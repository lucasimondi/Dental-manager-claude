import React from 'react';

export default function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F4F8',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 38, height: 38, border: '3px solid #E2E8F0', borderTopColor: '#1A6B8A',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px',
        }} />
        <div style={{ color: '#718096', fontSize: 13, fontWeight: 600 }}>Caricamento dati…</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
