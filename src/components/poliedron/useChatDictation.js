import { useCallback, useEffect, useRef, useState } from 'react';
import { joinDictation, speechErrorMessage } from '../../lib/poliedron/phoneApp.js';

export default function useChatDictation({ draft, setDraft }) {
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState('');
  const recognitionRef = useRef(null);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const supported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    const hide = () => { if (document.hidden) recognitionRef.current?.abort(); };
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        recognition.onresult = recognition.onerror = recognition.onend = recognition.onstart = null;
        recognition.abort();
      }
    };
  }, []);

  const toggle = useCallback(() => {
    if (recognitionRef.current) { stop(); return; }
    if (!supported) { setNotice('Per dettare, usa il microfono della tastiera del telefono.'); return; }
    setNotice('');
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      // Only final text becomes an editable draft. Never submit dictated actions.
      const transcript = Array.from(event.results).filter((result) => result.isFinal).map((result) => result[0].transcript).join(' ');
      if (transcript) setDraft(joinDictation(latestDraft.current, transcript));
    };
    recognition.onerror = (event) => setNotice(speechErrorMessage(event.error));
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setListening(false);
    };
    setListening(true);
    try { recognition.start(); }
    catch { recognitionRef.current = null; setListening(false); setNotice(speechErrorMessage('unavailable')); }
  }, [setDraft, stop, supported]);

  return { listening, notice, supported, toggle, stop };
}
