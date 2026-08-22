import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import PoliedronOrb from './PoliedronOrb';
import PoliedronEdgeDock from './PoliedronEdgeDock';
import PoliedronPanel from './PoliedronPanel';
import { NAVIGATION_INDEX } from '../../lib/poliedron/navigationIndex';
import { filterNavigationIndex, isActionAllowed } from '../../lib/poliedron/permissionEngine';
import { ACTION_REGISTRY } from '../../lib/poliedron/actionRegistry';
import { buildContext } from '../../lib/poliedron/contextEngine';
import { processQuery } from '../../lib/poliedron/poliedraCore';

/* POL-AI-001 §33 / POL-AI-002A §16-17 — mounted exactly once by App.jsx,
   survives every page change. This is the only file that talks to the
   other poliedron/* modules; PoliedronOrb (mobile) / PoliedronEdgeDock
   (desktop) / Panel/*.jsx below it are pure UI. Both triggers open this
   SAME component's state/panel — never two AI systems (§16 same
   identity, one Poliedra AI Core). */
export default function Poliedron({
  isMobile, page, setPage, patients, goSchedaPaz,
  features, isStudioAdmin, vertical, studioId, currentPatient,
  quickActionCtx, supabaseClient, onArchivioFilterHint,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const panelId = useId();
  const requestSeq = useRef(0);

  const permissionCtx = useMemo(() => ({ features, isStudioAdmin }), [features, isStudioAdmin]);

  const navigationIndex = useMemo(() => filterNavigationIndex(NAVIGATION_INDEX, permissionCtx), [permissionCtx]);
  const actions = useMemo(
    () => ACTION_REGISTRY.filter((a) => isActionAllowed(a, { ...permissionCtx, quickActionCtx })),
    [permissionCtx, quickActionCtx]
  );

  const context = useMemo(
    () => buildContext({ page, vertical, studioId, currentPatient, isStudioAdmin, features }),
    [page, vertical, studioId, currentPatient, isStudioAdmin, features]
  );

  // §25 — Cmd/Ctrl+K opens Poliedron from anywhere, desktop only per spec
  // (mobile stays touch-first). Registered at document level so it works
  // regardless of which page/element currently has focus.
  useEffect(() => {
    if (isMobile) return undefined;
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMobile]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setState(null);
  }, []);

  const runQuery = useCallback((q) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    processQuery({
      query: q,
      context,
      permissions: { managementControl: permissionCtx.features?.controllo_gestione === true && !!isStudioAdmin },
      sources: { patients, navigationIndex, actions },
      supabaseClient,
    }).then((result) => {
      if (seq !== requestSeq.current) return; // stale response from an earlier keystroke — dropped
      // POL-AI-002A §20, §23 — an exact commandAlias match navigates
      // immediately and closes the panel: no intermediate results screen,
      // no click required, no model call in the loop.
      if (result.directNavigation) {
        const { navId, filtroTipo } = result.directNavigation;
        if (navId === 'archivio') onArchivioFilterHint?.(filtroTipo || 'tutti');
        setPage(navId);
        setLoading(false);
        close();
        return;
      }
      setState(result);
      setHighlightedIndex(0);
      setLoading(false);
    });
  }, [context, permissionCtx, isStudioAdmin, patients, navigationIndex, actions, supabaseClient, setPage, onArchivioFilterHint, close]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => runQuery(query), query ? 150 : 0); // §7 live search, light debounce only while typing
    return () => clearTimeout(t);
  }, [query, open, runQuery]);

  const navCtx = useMemo(() => ({
    setPage, goSchedaPaz,
    onNavigate: setPage, onNavigateNew: (p) => setPage(p),
    onGoAgenda: () => setPage('agenda'), onGoRichiami: () => setPage('richiami'),
    openBooking: () => setPage('agenda'), openTodoModal: () => {},
  }), [setPage, goSchedaPaz]);

  const handleSelectResult = useCallback((item) => {
    if (item.kind === 'patient') { goSchedaPaz?.(item.data); close(); return; }
    if (item.kind === 'section') { setPage(item.id); close(); return; }
    if (item.kind === 'action') { item.data.navigate(navCtx, item.data.entity); close(); }
  }, [goSchedaPaz, setPage, navCtx, close]);

  const handleConfirmAction = useCallback((action) => {
    action.navigate(navCtx, state?.entities?.patientCandidates?.[0]);
    close();
  }, [navCtx, state, close]);

  const handleModifyAction = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const onToggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <>
      {/* POL-AI-002A §17 — same identity, different interaction: mobile
          gets the large freely-positionable Orb, desktop gets the
          discreet edge-anchored dock. Both call the exact same onToggle,
          opening the exact same panel/state below. */}
      {isMobile
        ? <PoliedronOrb open={open} onToggle={onToggle} panelId={panelId} />
        : <PoliedronEdgeDock open={open} onToggle={onToggle} panelId={panelId} />}
      {open && (
        <PoliedronPanel
          panelId={panelId}
          isMobile={isMobile}
          query={query}
          onQueryChange={setQuery}
          state={state}
          loading={loading}
          highlightedIndex={highlightedIndex}
          onHighlightChange={setHighlightedIndex}
          onSelectResult={handleSelectResult}
          onConfirmAction={handleConfirmAction}
          onModifyAction={handleModifyAction}
          onClose={close}
          inputRef={inputRef}
        />
      )}
    </>
  );
}
