import { useState, useEffect } from 'react';
import { getMobileShellMode } from './mobileShell.js';

// Kept as the canonical portrait threshold for existing dock/Edge Dock
// contracts; landscape-phone retention is the additive POL-UI-017 rule.
const BREAKPOINT = 720;

const readMobileShellMode = () => getMobileShellMode({
  width: window.innerWidth,
  height: window.innerHeight,
  coarsePointer: window.matchMedia?.('(pointer: coarse)').matches === true,
  portraitBreakpoint: BREAKPOINT,
});

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? readMobileShellMode() : true));
  useEffect(() => {
    const coarseQuery = window.matchMedia?.('(pointer: coarse)');
    const onResize = () => setIsMobile(readMobileShellMode());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    coarseQuery?.addEventListener?.('change', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      coarseQuery?.removeEventListener?.('change', onResize);
    };
  }, []);
  return isMobile;
}
