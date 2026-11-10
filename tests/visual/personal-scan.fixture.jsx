// Synthetic-only fixture (SCAN-HOME): the «Scan» Home app shell (scanner first, «PDF e firma»).
// Network is blocked by the runner: archive counters and settings simply fail and are ignored.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../personal/src/personal.css';
import '../../personal/src/pro.css';
import '../../personal/src/icone-base.css';
import { Scan } from '../../personal/src/scan/Scan.jsx';
createRoot(document.getElementById('root')).render(<Scan email="test@example.invalid" />);
