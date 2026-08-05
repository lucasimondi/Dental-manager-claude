export { default as Ic } from './Ic.jsx';
export { default as DockIc, DOCK_ICON_STYLES } from './DockIc.jsx';
export { default as Btn } from './Btn.jsx';
export { default as Modal } from './Modal.jsx';
export { default as Toast } from './Toast.jsx';
export { default as PhStr } from './PhStr.jsx';
export { Bdg, Crd, Fld } from './atoms.jsx';
export { Inp, Sel, Txt } from './inputs.jsx';

export { default as SearchSel } from './SearchSel.jsx';
export { default as TimePicker } from './TimePicker.jsx';
export { default as SelettorePaziente } from './SelettorePaziente.jsx';
export { default as PannelloInvioDocumento } from './PannelloInvioDocumento.jsx';
// PdfViewerModal NON è esportato qui apposta: viene importato con React.lazy()
// direttamente nei componenti che lo usano (SchedaPaz.jsx, ArchivioDocs.jsx),
// perché include pdf.js (~1MB con worker) e non deve gonfiare il bundle
// principale caricato da tutti all'avvio dell'app — solo chi apre davvero
// un documento scarica quella libreria.
export { default as WaAction, waAbilitato, waUrl, apriWaDiretto } from './WaAction.jsx';
