import React from 'react';
import { BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Crd } from './ui';
import { C, fmt } from '../lib/utils';

// POL-PERF-001: i grafici della Home ("Grafici e andamento", chiusi di
// default) vivono qui, caricati con import() solo quando l'utente li apre:
// così recharts (~530 kB) non entra più nel download iniziale dell'app.
export default function DashboardCharts({ andamentoMensile, incassoPerPrestazione, incassoPerGiorno, speseMensili, speseCategoria, chartPalette: CHART_PALETTE }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Crd>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 8 }}>Ultimi mesi</div>
        {andamentoMensile.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Nessun incasso registrato</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={andamentoMensile} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.brd} vertical={false} />
              <XAxis dataKey="mese" tick={{ fontSize: 11, fill: C.txl }} axisLine={{ stroke: C.brd }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} width={42} />
              <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v, n) => [fmt(v), n === 'incasso' ? 'Incasso' : 'Media mobile']} />
              <Bar dataKey="incasso" fill={C.priL} radius={[6, 6, 0, 0]} barSize={22} />
              <Line dataKey="media" stroke={C.pri} strokeWidth={2.5} dot={{ r: 3, fill: C.pri }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Crd>
      <Crd>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 8 }}>Dove incasso di più</div>
        {incassoPerPrestazione.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Nessuna prestazione eseguita</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, incassoPerPrestazione.length * 34)}>
            <BarChart data={incassoPerPrestazione} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.brd} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="tipo" tick={{ fontSize: 11, fill: C.txt }} axisLine={false} tickLine={false} width={92} />
              <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v) => fmt(v)} />
              <Bar dataKey="incasso" radius={[0, 6, 6, 0]} barSize={16}>
                {incassoPerPrestazione.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Crd>
      <Crd>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 8 }}>Incasso per giorno</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={incassoPerGiorno} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.brd} vertical={false} />
            <XAxis dataKey="giorno" tick={{ fontSize: 11, fill: C.txl }} axisLine={{ stroke: C.brd }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} width={42} />
            <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v) => fmt(v)} />
            <Bar dataKey="incasso" radius={[6, 6, 0, 0]} barSize={26}>
              {incassoPerGiorno.map((d, i) => <Cell key={i} fill={d.top ? C.pri : C.priL} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Crd>
      <Crd>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 8 }}>Andamento spese</div>
        {speseMensili.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Nessuna spesa registrata</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={speseMensili} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.brd} vertical={false} />
              <XAxis dataKey="mese" tick={{ fontSize: 11, fill: C.txl }} axisLine={{ stroke: C.brd }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} width={42} />
              <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v, n) => [fmt(v), n === 'unaTantum' ? 'Una tantum' : 'Ricorrenti (quota mese)']} />
              <Bar dataKey="ricorrenti" stackId="s" fill={C.war + '55'} radius={[0, 0, 0, 0]} barSize={22} />
              <Bar dataKey="unaTantum" stackId="s" fill={C.dan} radius={[6, 6, 0, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Crd>
      {speseCategoria.length > 0 && (
        <Crd>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 2 }}>Spese per categoria</div>
          <div style={{ fontSize: 11, color: C.txl, marginBottom: 8 }}>Ricorrenti proiettate su base annua/12</div>
          <ResponsiveContainer width="100%" height={Math.max(140, speseCategoria.length * 34)}>
            <BarChart data={speseCategoria} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.brd} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="categoria" tick={{ fontSize: 11, fill: C.txt }} axisLine={false} tickLine={false} width={92} />
              <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v) => fmt(v)} />
              <Bar dataKey="tot" radius={[0, 6, 6, 0]} barSize={16}>
                {speseCategoria.map((_, i) => <Cell key={i} fill={C.dan} fillOpacity={1 - i * 0.12} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Crd>
      )}
    </div>
  );
}
