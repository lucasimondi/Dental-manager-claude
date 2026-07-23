import { useState, useEffect, useCallback, useRef } from 'react';
import { applyTheme, getInitialTheme, THEME_KEY } from './utils';

export function useTheme() {
  const [theme, setThemeState] = useState(getInitialTheme);
  const mounted = useRef(false);

  // Applica il tema al primissimo caricamento (prima che l'app venga mostrata)
  useEffect(() => {
    if (!mounted.current) {
      applyTheme(theme);
      mounted.current = true;
    }
  }, [theme]);

  const setTheme = useCallback((mode) => {
    // Applica subito, PRIMA di aggiornare lo stato: cosi' il render innescato da
    // setThemeState usa gia' i colori nuovi invece di quelli vecchi (altrimenti
    // solo lo sfondo generale in CSS cambiava subito, il resto restava vecchio
    // finche' qualcos'altro non forzava un nuovo render, es. cambiare pagina).
    applyTheme(mode);
    window.localStorage.setItem(THEME_KEY, mode);
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
