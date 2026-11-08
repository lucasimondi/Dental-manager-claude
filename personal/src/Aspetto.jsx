import { createContext, useContext, useEffect } from 'react';
import { applicaAspetto, salvaAspetto, storageAspetto } from './lib/aspetto.js';

// PO 2026-11-08: un solo stile. Il contesto resta perché alcune viste chiedono l'aspetto attivo.
const ContestoAspetto = createContext({ aspetto: 'moderno' });
export function AspettoProvider({ children }) {
  useEffect(() => { applicaAspetto(document.documentElement); salvaAspetto(storageAspetto()); }, []);
  return <ContestoAspetto.Provider value={{ aspetto: 'moderno' }}>{children}</ContestoAspetto.Provider>;
}
export function useAspetto() { return useContext(ContestoAspetto)?.aspetto || 'moderno'; }
