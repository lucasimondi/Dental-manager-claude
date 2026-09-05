import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';

/* POL-UI-025 — extracted verbatim from Dashboard.jsx (POL-UI-013 era):
   consulente CFO/marketing proattivo, generato in background
   (genera-consigli-ai) senza che nessuno apra la chat — stesso spirito
   del bot Richiami. Solo per admin dello studio (RLS lo impone comunque)
   e solo al livello Premium dell'assistente (è la funzione che lo genera
   a deciderlo server-side; qui evitiamo solo la chiamata inutile).

   Moved into its own hook so both Home (which no longer renders the
   widget, POL-UI-025) and the new PoliedronHub page (which does) can use
   the exact same fetch/state — a widget cannot survive a page unmount
   (Dashboard.jsx and PoliedronHub.jsx are mutually exclusive page
   mounts), so sharing CODE via a hook is the only way to avoid the two
   pages drifting into two different implementations of "what counts as
   a consiglio". */
export function usePoliedronConsigli({ enabled }) {
  const [consigli, setConsigli] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const rigenera = async () => {
    setLoading(true);
    setErr('');
    try {
      const { data, error } = await supabase.functions.invoke('genera-consigli-ai');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setConsigli(data.consigli || []);
    } catch (e) {
      setErr(e.message || 'Errore nella generazione dei consigli');
    } finally {
      setLoading(false);
    }
  };

  const segnaLetto = async (id) => {
    setConsigli((prev) => prev.map((c) => (c.id === id ? { ...c, letto: true } : c)));
    await supabase.from('ai_agent_consigli').update({ letto: true }).eq('id', id);
  };

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    supabase.from('ai_agent_consigli').select('*').order('creato_il', { ascending: false }).limit(4).then(({ data }) => {
      if (cancelled) return;
      setConsigli(data || []);
      const piuRecente = data && data[0] ? new Date(data[0].creato_il) : null;
      const settimanaFa = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (!piuRecente || piuRecente < settimanaFa) rigenera();
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { consigli, loading, err, rigenera, segnaLetto };
}
