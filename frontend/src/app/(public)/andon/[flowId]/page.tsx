'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { apiClient } from '../../../../lib/api-client';

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/* ----------------------------------------------------------------------
 * Public Andon TV board. No login. Tenant is identified by a signed
 * ?token=<cuid> board token (Sprint 3 / Task 1) — generated from the admin
 * Flow Monitor. (?company=<email> is still accepted by the backend as a
 * legacy fallback.) Data is pushed live over the token-scoped /andon
 * Socket.io namespace (Sprint 4 / Task 3), with a 30s HTTP poll fallback.
 * -------------------------------------------------------------------- */

const POPPINS = 'var(--font-poppins), sans-serif';

interface AndonMachine {
  equipmentId: number;
  name: string;
  status: 'running' | 'stopped' | 'warning';
  lostMinutesToday: number;
  oee: number;
  lastOnline: string | null;
}
interface AndonData {
  flowId: number;
  flowName: string;
  oee: number;
  counts: { running: number; stopped: number; warning: number };
  lostHoursToday: number;
  machines: AndonMachine[];
  ticker: Array<{ machineName: string; minutesAgo: number; text: string }>;
  serverTime: string;
}

const NODE_STYLE: Record<AndonMachine['status'], { border: string; bg: string; label: string; color: string }> = {
  running: { border: 'rgba(0,166,90,0.4)',  bg: 'rgba(0,166,90,0.08)',  label: 'RUNNING', color: '#00a65a' },
  stopped: { border: 'rgba(221,75,57,0.5)', bg: 'rgba(221,75,57,0.12)', label: 'STOPPED', color: '#dd4b39' },
  warning: { border: 'rgba(243,156,18,0.4)', bg: 'rgba(243,156,18,0.08)', label: 'WARNING', color: '#f39c12' },
};

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      flex: 1, height: 80, borderRadius: 10,
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
    }}>
      <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1px', color: '#9ca3af', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

export default function AndonBoardPage() {
  const params = useParams<{ flowId: string }>();
  const search = useSearchParams();
  const flowId = params?.flowId;
  const token = search?.get('token') ?? '';
  const company = search?.get('company') ?? ''; // legacy fallback

  const [data, setData] = useState<AndonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState('');
  const [today, setToday] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live clock (1s tick).
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-GB'));
      setToday(now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Real-time via the /andon Socket.io namespace (token-scoped), with a 30s
  // HTTP poll as a fallback if the socket can't connect (Sprint 4 / Task 3).
  useEffect(() => {
    if (!flowId || (!token && !company)) {
      setError(!flowId ? 'Missing flow id.' : 'Missing ?token= parameter.');
      return;
    }
    let cancelled = false;
    const query = token ? { token } : { company };

    const load = async () => {
      try {
        const { data: d } = await apiClient.get<AndonData>(`/andon/${flowId}`, { params: query });
        if (!cancelled) { setData(d); setError(null); }
      } catch {
        if (!cancelled) setError('Could not reach the Andon service (invalid or expired token?).');
      }
    };

    // Immediate first paint + 30s safety poll (covers socket downtime).
    load();
    timerRef.current = setInterval(load, 30000);

    // Socket pushes fresh snapshots on machine events. Tokens only — the
    // legacy ?company= path has no socket auth and relies on the poll.
    let socket: Socket | null = null;
    if (token) {
      socket = io(`${SOCKET_URL}/andon`, {
        path: '/socket.io',
        auth: { token },
        transports: ['websocket'],
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30000,
      });
      socket.on('andon:snapshot', (d: AndonData) => { if (!cancelled) { setData(d); setError(null); } });
      socket.on('connect_error', () => { /* fall back to the HTTP poll */ });
    }

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      socket?.disconnect();
    };
  }, [flowId, token, company]);

  const tickerText = data?.ticker.length
    ? data.ticker.map((t) => `⚠ ${t.text}`).join('     ·     ')
    : 'No stops recorded today.';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#111827', color: '#e5e7eb',
      fontFamily: POPPINS, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes andon-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(221,75,57,0.45); }
          70%  { box-shadow: 0 0 0 14px rgba(221,75,57,0); }
          100% { box-shadow: 0 0 0 0 rgba(221,75,57,0); }
        }
        @keyframes andon-marquee {
          0%   { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>

      {/* TOP BAR */}
      <div style={{
        height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)', gap: 16,
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#01b9d0', letterSpacing: '0.5px', flexShrink: 0 }}>
          FP ANALYZER
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 600, color: '#f3f4f6' }}>
          {data?.flowName ?? (error ? '—' : 'Loading…')}
        </div>
        <div style={{ textAlign: 'right', lineHeight: 1.2, flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{clock}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{today}</div>
        </div>
        <div style={{
          flexShrink: 0, padding: '6px 12px', borderRadius: 8,
          background: 'rgba(1,185,208,0.12)', border: '1px solid rgba(1,185,208,0.35)',
        }}>
          <span style={{ fontSize: 11, color: '#9ca3af', marginRight: 6 }}>OEE</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#01b9d0' }}>{data ? `${data.oee}%` : '—'}</span>
        </div>
      </div>

      {/* STAT ROW */}
      <div style={{ display: 'flex', gap: 12, padding: 16, flexShrink: 0 }}>
        <StatBox label="OEE" value={data ? `${data.oee}%` : '—'} color="#01b9d0" />
        <StatBox label="Running" value={data ? String(data.counts.running) : '—'} color="#00a65a" />
        <StatBox label="Stopped" value={data ? String(data.counts.stopped) : '—'} color="#dd4b39" />
        <StatBox label="Lost (h) Today" value={data ? String(data.lostHoursToday) : '—'} color="#f39c12" />
      </div>

      {/* MACHINE GRID */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 12px' }}>
        {error ? (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#9ca3af', textAlign: 'center', padding: 24 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#dd4b39', marginBottom: 8 }}>{error}</div>
              <div style={{ fontSize: 13 }}>URL format: <code>/andon/&lt;flowId&gt;?token=&lt;token&gt;</code> — generate from the admin Flow Monitor.</div>
            </div>
          </div>
        ) : !data ? (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#9ca3af' }}>Loading machines…</div>
        ) : data.machines.length === 0 ? (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#9ca3af' }}>No machines in this flow.</div>
        ) : (
          <div style={{
            display: 'grid', gap: 12,
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
          }}>
            {data.machines.map((m) => {
              const s = NODE_STYLE[m.status];
              return (
                <div key={m.equipmentId} style={{
                  borderRadius: 12, border: `2px solid ${s.border}`, background: s.bg,
                  padding: 16, minHeight: 150,
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  animation: m.status === 'stopped' ? 'andon-pulse 1.6s infinite' : undefined,
                }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: '#f3f4f6',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{m.name}</div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 38, fontWeight: 800, color: s.color, lineHeight: 1 }}>{m.oee}%</div>
                    {m.lostMinutesToday > 0 && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{m.lostMinutesToday} min lost</div>
                    )}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: s.color, textAlign: 'center',
                  }}>{s.label}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BOTTOM TICKER */}
      <div style={{
        height: 40, flexShrink: 0, background: 'rgba(221,75,57,0.15)',
        borderTop: '1px solid rgba(221,75,57,0.25)', display: 'flex', alignItems: 'center', overflow: 'hidden',
      }}>
        <div style={{
          whiteSpace: 'nowrap', fontSize: 14, fontWeight: 600, color: '#fca5a5',
          animation: 'andon-marquee 30s linear infinite', willChange: 'transform',
        }}>
          {tickerText}
        </div>
      </div>
    </div>
  );
}
