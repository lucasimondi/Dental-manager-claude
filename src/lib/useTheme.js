import { useState, useEffect, useCallback, useRef } from 'react';
import { applyTheme, getInitialTheme, getTemaAttivo, THEME_KEY, TEMA_KEY, TEMI_DISPONIBILI } from './utils';

export function useTheme() {
  const [theme, setThemeState] = useState(getInitialTheme);
  const [tema, setTemaState] = useState(getTemaAttivo);
  const mounted = useRef(false);

  // Applica il tema al primissimo caricamento (prima che l'app venga mostrata)
  useEffect(() => {
    if (!mounted.current) {
      applyTheme(theme, tema);
      mounted.current = true;
    }
  }, [theme, tema]);

  const setTheme = useCallback((mode) => {
    // Applica subito, PRIMA di aggiornare lo stato: cosi' il render innescato da
    // setThemeState usa gia' i colori nuovi invece di quelli vecchi (altrimenti
    // solo lo sfondo generale in CSS cambiava subito, il resto restava vecchio
    // finche' qualcos'altro non forzava un nuovo render, es. cambiare pagina).
    applyTheme(mode, tema);
    window.localStorage.setItem(THEME_KEY, mode);
    setThemeState(mode);
  }, [tema]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // Cambia il tema visivo (Classico, Fintech, ecc.) — il chiamante deve
  // aver già verificato che lo studio ha diritto a usarlo (piano o
  // acquisto); qui applichiamo soltanto, senza controllo permessi.
  const setTemaVisivo = useCallback((temaId) => {
    if (!TEMI_DISPONIBILI.some((t) => t.id === temaId)) return;
    applyTheme(theme, temaId);
    window.localStorage.setItem(TEMA_KEY, temaId);
    setTemaState(temaId);
  }, [theme]);

  return { theme, setTheme, toggleTheme, tema, setTemaVisivo };
}
