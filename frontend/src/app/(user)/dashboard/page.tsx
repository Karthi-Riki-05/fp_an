'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useOee } from '../../../lib/api/oee';
import { useUnitsList, type UnitCard } from '../../../lib/api/units';

const BRAND = '#01b9d0';
const SUCCESS = '#00a65a';
const ERROR = '#dd4b39';
const WARN = '#f39c12';
const CARD_SHADOW = '0 1px 4px rgba(0,0,0,0.08)';

type MachineVisualState = 'running' | 'stopped' | 'warning';

// Map a unit's raw flags to one visual state. Unregistered stops take
// priority (operator must classify them) → warning; otherwise on/off.
function machineState(u: UnitCard): MachineVisualState {
  if (u.hasUnregisterData === 'yes') return 'warning';
  return u.runningStatus === 'on' ? 'running' : 'stopped';
}

const STATE_COLOR: Record<MachineVisualState, string> = {
  running: SUCCESS, stopped: ERROR, warning: WARN,
};
const STATE_LABEL: Record<MachineVisualState, string> = {
  running: 'Running', stopped: 'Stopped', warning: 'Needs attention',
};

function lastSeen(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function UserDashboard() {
  const router = useRouter();
  const { data: oee, isLoading } = useOee();
  const { data: units } = useUnitsList();

  // The operator's primary machine = first card (the API already sorts
  // units needing attention to the front).
  const machine = units?.[0] ?? null;

  const oeeVal = oee?.oee ?? 0;
  const counts = (units ?? []).reduce(
    (acc, u) => { acc[machineState(u)] += 1; return acc; },
    { running: 0, stopped: 0, warning: 0 } as Record<MachineVisualState, number>,
  );
  const running = counts.running;
  const stopped = counts.stopped;
  const warning = counts.warning;

  return (
    <div style={{ paddingBottom: 16 }}>

      {/* OEE Strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
        gap: 1, background: '#f0f0f0',
        margin: '12px 12px 0', borderRadius: 10,
        overflow: 'hidden', boxShadow: CARD_SHADOW
      }}>
        {[
          { val: isLoading ? '…' : `${oeeVal}%`, label: 'OEE', color: BRAND },
          { val: running, label: 'Running', color: SUCCESS },
          { val: stopped, label: 'Stopped', color: ERROR },
          { val: warning, label: 'Warn', color: WARN },
        ].map((s) => (
          <div key={s.label} style={{ background: 'white', padding: '10px 6px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1, marginBottom: 3 }}>{s.val}</div>
            <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#8c8c8c' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Section label */}
      <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#8c8c8c', padding: '12px 12px 6px' }}>
        My Machine
      </div>

      {/* My Machine card */}
      {machine ? (() => {
        const st = machineState(machine);
        const color = STATE_COLOR[st];
        return (
          <div
            onClick={() => router.push('/monitor')}
            style={{
              background: 'white', borderRadius: 10, padding: 14,
              margin: '0 12px 10px', boxShadow: CARD_SHADOW,
              borderLeft: `4px solid ${color}`, cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              {/* Left: name + status */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 13, fontWeight: 700, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {machine.unitName || machine.equipmentName || `Machine ${machine.id}`}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color }}>{STATE_LABEL[st]}</span>
                  {machine.hasUnregisterData === 'yes' && machine.unregisteredCount > 0 ? (
                    <span style={{ fontSize: 10, color: '#8c8c8c' }}>· {machine.unregisteredCount} unregistered</span>
                  ) : null}
                </div>
              </div>
              {/* Right: OEE + last seen */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>
                  {isLoading ? '…' : `${oeeVal}%`}
                </div>
                <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 2 }}>{lastSeen(machine.lastOnline)}</div>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ height: 3, background: '#f0f0f0', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, oeeVal))}%`, background: color }} />
            </div>
          </div>
        );
      })() : (
        <div style={{
          background: 'white', borderRadius: 10, padding: '18px 14px',
          margin: '0 12px 10px', boxShadow: CARD_SHADOW, border: '1px solid #f0f0f0',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>🏭</div>
          <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 12, fontWeight: 700, color: '#262626' }}>No machine assigned</div>
          <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>Contact your administrator to get a unit assigned.</div>
        </div>
      )}

      {/* Section label */}
      <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#8c8c8c', padding: '12px 12px 6px' }}>
        Quick Actions
      </div>

      {/* Quick action grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 12px 12px' }}>
        {[
          { icon: '📊', label: 'Log Production', href: '/myresult/production', primary: true },
          { icon: '⚠️', label: 'Log Stop', href: '/myresult/stop', primary: false },
          { icon: '🗑️', label: 'Log Scrap', href: '/myresult/scrap', primary: false },
          { icon: '📡', label: 'Monitor', href: '/monitor', primary: false },
        ].map((a) => (
          <div
            key={a.label}
            onClick={() => router.push(a.href)}
            style={{
              background: a.primary ? `linear-gradient(135deg, #00768D, ${BRAND})` : 'white',
              borderRadius: 10, padding: '14px 12px', textAlign: 'center',
              cursor: 'pointer', boxShadow: CARD_SHADOW,
              border: a.primary ? 'none' : '1px solid #f0f0f0',
              minHeight: 80, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 5,
              transition: 'transform 0.15s',
            }}
          >
            <div style={{ fontSize: 22 }}>{a.icon}</div>
            <div style={{
              fontFamily: 'var(--font-poppins)', fontSize: 11, fontWeight: 700,
              color: a.primary ? 'white' : '#262626'
            }}>{a.label}</div>
          </div>
        ))}
      </div>

      {/* Section label */}
      <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#8c8c8c', padding: '0 12px 6px' }}>
        My Results Today
      </div>

      {/* Results links */}
      {[
        { icon: '📋', label: 'Production Log', sub: 'View & edit entries', href: '/myresult/production' },
        { icon: '🛑', label: 'Stop Log', sub: 'Logged stops', href: '/myresult/stop' },
        { icon: '🗑', label: 'Scrap Log', sub: 'Scrap entries', href: '/myresult/scrap' },
        { icon: '⚡', label: 'Unregistered Stops', sub: 'Needs reason code', href: '/myresult/unregistered' },
      ].map((item) => (
        <div
          key={item.label}
          onClick={() => router.push(item.href)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'white', borderRadius: 10, padding: '12px 14px',
            margin: '0 12px 8px', boxShadow: CARD_SHADOW,
            border: '1px solid #f0f0f0', cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 12, fontWeight: 700, color: '#262626' }}>{item.label}</div>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>{item.sub}</div>
          </div>
          <div style={{ color: BRAND, fontSize: 16 }}>›</div>
        </div>
      ))}
    </div>
  );
}
