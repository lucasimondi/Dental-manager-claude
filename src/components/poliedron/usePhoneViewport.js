import { useEffect, useState } from 'react';
import { phoneViewport } from '../../lib/poliedron/phoneApp.js';

export default function usePhoneViewport(enabled) {
  const [bounds, setBounds] = useState(null);
  useEffect(() => {
    if (!enabled || !window.visualViewport) return undefined;
    const viewport = window.visualViewport;
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setBounds(phoneViewport(viewport)));
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [enabled]);
  return enabled && bounds ? { height: bounds.height, minHeight: bounds.height, position: 'fixed', top: bounds.top, left: 0, right: 0 } : {};
}
