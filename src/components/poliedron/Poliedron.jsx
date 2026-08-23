import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import PoliedronEdgeDock from './PoliedronEdgeDock';
import PoliedronMobileDock from './PoliedronMobileDock';
import PoliedronPanel from './PoliedronPanel';
import { NAVIGATION_INDEX } from '../../lib/poliedron/navigationIndex';
import { buildIntelligencePermissions, filterNavigationIndex, isActionAllowed } from '../../lib/poliedron/permissionEngine';
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
  isMobile, page, setPage, patients, plans, appointments, richiami, impegni, goSchedaPaz,
  features, isStudioAdmin, vertical, studioId, currentPatient,
  quickActionCtx, supabaseClient, onArchivioFilterHint, openPrescription, openNew, openBooking,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const panelId = useId();
  const requestSeq = useRef(0);
  const previewTimerRef = useRef(null);

  const permissionCtx = useMemo(() => ({ features, isStudioAdmin }), [features, isStudioAdmin]);

  const navigationIndex = useMemo(() => filterNavigationIndex(NAVIGATION_INDEX, permissionCtx), [permissionCtx]);
  const actions = useMemo(
    () => ACTION_REGISTRY.filter((a) => isActionAllowed(a, { ...permissionCtx, quickActionCtx })),
    [permissionCtx, quickActionCtx]
  );
  const intelligencePermissions = useMemo(
    () => buildIntelligencePermissions(quickActionCtx?.permissions),
    [quickActionCtx?.permissions]
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
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    requestSeq.current += 1;
    setOpen(false);
    setQuery('');
    setState(null);
  }, []);

  const runQuery = useCallback((q, { allowModel = false } = {}) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    processQuery({
      query: q,
      context,
      permissions: {
        managementControl: permissionCtx.features?.controllo_gestione === true && !!isStudioAdmin,
        intelligence: intelligencePermissions,
      },
      sources: {
        patients,
        plans,
        appointments,
        recalls: richiami,
        activities: impegni,
        navigationIndex,
        actions,
      },
      supabaseClient,
      allowModel,
    }).then((result) => {
      if (seq !== requestSeq.current) return; // stale response from an earlier keystroke — dropped
      // Only intentEngine-confirmed navigation phrases can reach this path.
      // Bare aliases remain in the panel as ranked suggestions.
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
    }).catch(() => {
      if (seq !== requestSeq.current) return;
      setState({ answer: 'Non riesco a completare la richiesta in questo momento. Riprova.' });
      setLoading(false);
    });
  }, [context, permissionCtx, intelligencePermissions, isStudioAdmin, patients, plans, appointments, richiami, impegni, navigationIndex, actions, supabaseClient, setPage, onArchivioFilterHint, close]);

  useEffect(() => {
    if (!open) return;
    previewTimerRef.current = setTimeout(() => runQuery(query), query ? 150 : 0); // §7 live search, light debounce only while typing
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [query, open, runQuery]);

  const handleQueryChange = useCallback((value) => {
    requestSeq.current += 1;
    setQuery(value);
    setLoading(false);
    setState(null);
    setHighlightedIndex(0);
  }, []);

  const navCtx = useMemo(() => ({
    setPage, goSchedaPaz,
    onNavigate: setPage, onNavigateNew: (p) => openNew?.(p),
    onGoAgenda: () => setPage('agenda'), onGoRichiami: () => setPage('richiami'),
    openBooking: () => openBooking?.(), openTodoModal: () => {},
    openPrescription,
  }), [setPage, goSchedaPaz, openPrescription, openNew, openBooking]);

  const handleSelectResult = useCallback((item) => {
    if (item.kind === 'patient' || item.kind === 'intelligence-patient') { goSchedaPaz?.(item.data?.patient || item.data); close(); return; }
    if (item.kind === 'section') {
      const destination = item.data?.page || item.id;
      if (destination === 'archivio') onArchivioFilterHint?.(item.data?.filtroTipo || 'tutti');
      setPage(destination);
      close();
      return;
    }
    if (item.kind === 'action') {
      if (item.id === 'prescription.create') {
        setQuery('crea ricetta');
        inputRef.current?.focus();
        return;
      }
      item.data.navigate(navCtx, item.data.entity);
      close();
    }
  }, [goSchedaPaz, setPage, onArchivioFilterHint, navCtx, close]);

  const handleConfirmAction = useCallback((action, selectedPatient) => {
    const patient = selectedPatient || state?.entities?.patientCandidates?.[0];
    action.navigate(navCtx, patient, { drug: state?.entities?.drugText || '' });
    close();
  }, [navCtx, state, close]);

  const handleModifyAction = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const onToggle = useCallback(() => setOpen((v) => !v), []);
  const submitQuery = useCallback(() => {
    if (!query.trim()) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    runQuery(query, { allowModel: true });
  }, [query, runQuery]);

  return (
    <>
      {/* POL-AI-002A §17 — same identity, different interaction: mobile
          gets the large freely-positionable Orb, desktop gets the
          discreet edge-anchored dock. Both call the exact same onToggle,
          opening the exact same panel/state below. */}
      {isMobile
        ? <PoliedronMobileDock page={page} setPage={setPage} open={open} onToggle={onToggle} panelId={panelId} />
        : <PoliedronEdgeDock open={open} onToggle={onToggle} panelId={panelId} />}
      {open && (
        <PoliedronPanel
          panelId={panelId}
          isMobile={isMobile}
          query={query}
          onQueryChange={handleQueryChange}
          state={state}
          loading={loading}
          highlightedIndex={highlightedIndex}
          onHighlightChange={setHighlightedIndex}
          onSelectResult={handleSelectResult}
          onConfirmAction={handleConfirmAction}
          onModifyAction={handleModifyAction}
          onSubmit={submitQuery}
          onClose={close}
          inputRef={inputRef}
        />
      )}
    </>
  );
}
