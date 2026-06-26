'use client';

import { Card, DatePicker, Select, Skeleton, Table, Tag, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
dayjs.extend(isoWeek);
import { useState } from 'react';
import { useMe } from '../../../../lib/api/auth';
import { useEquipmentList } from '../../../../lib/api/equipment';
import { useLossModel, type LossRow } from '../../../../lib/api/loss-model';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const FACTOR_COLOR = {
  availability: '#dd4b39',
  performance: '#f39c12',
  quality: '#954cfe',
  oee: '#01b9d0',
  ideal: '#94a3b8',
} as const;

const LOSS_TAG_COLOR: Record<string, string> = {
  Availability: 'red',
  Performance: 'orange',
  Quality: 'purple',
  Excluded: 'default',
};

/** One horizontal waterfall row: a track with a coloured fill = value%. */
function WaterfallBar({
  label, value, color, lossPct, lossMinutes,
}: { label: string; value: number; color: string; lossPct?: number; lossMinutes?: number }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <Text strong style={{ fontSize: 13 }}>{label}</Text>
        <span>
          <span style={{ fontSize: 18, fontWeight: 700, color }}>{value}%</span>
          {lossPct !== undefined && lossPct > 0 && (
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
              −{lossPct}%{lossMinutes ? ` · ${lossMinutes} min` : ''}
            </Text>
          )}
        </span>
      </div>
      <div style={{ height: 22, borderRadius: 6, background: '#f0f2f5', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.max(0, Math.min(100, value))}%`, height: '100%',
          background: color, borderRadius: 6, transition: 'width .3s',
        }} />
      </div>
    </div>
  );
}

export default function LossModelPage() {
  const { data: me } = useMe();
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('isoWeek'),
    dayjs().endOf('isoWeek'),
  ]);
  const [machineId, setMachineId] = useState<number | undefined>(undefined);

  const equipment = useEquipmentList(me?.activeTenantId ?? null);
  const { data, isLoading } = useLossModel({
    from: range[0].format('YYYY-MM-DD'),
    to: range[1].format('YYYY-MM-DD'),
    machineId,
    enabled: !me?.isAdmin,
  });

  const m = data?.metrics;
  const perfLossMin = data?.losses.filter((l) => l.lossType === 'Performance').reduce((s, l) => s + l.minutesLost, 0) ?? 0;
  const qualLossMin = data?.losses.filter((l) => l.lossType === 'Quality').reduce((s, l) => s + l.minutesLost, 0) ?? 0;

  const columns = [
    {
      title: 'Loss Type', dataIndex: 'lossType', key: 'lossType',
      render: (v: string) => <Tag color={LOSS_TAG_COLOR[v] ?? 'default'}>{v}</Tag>,
    },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    {
      title: 'Minutes Lost', dataIndex: 'minutesLost', key: 'minutesLost',
      align: 'right' as const, sorter: (a: LossRow, b: LossRow) => a.minutesLost - b.minutesLost,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '% of Planned', dataIndex: 'pctOfPlanned', key: 'pctOfPlanned',
      align: 'right' as const, render: (v: number) => `${v}%`,
    },
    {
      title: 'Occurrences', dataIndex: 'occurrences', key: 'occurrences',
      align: 'right' as const, render: (v: number | null) => (v == null ? '—' : v),
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 4 }}>Loss Model</Title>
      <Text type="secondary">OEE waterfall and loss breakdown from stop, scrap and production data.</Text>

      {/* Controls */}
      <Card style={{ marginTop: 16, borderRadius: 8 }} bodyStyle={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>Period</Text>
          <RangePicker
            value={range}
            allowClear={false}
            onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
          />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>Machine</Text>
          <Select
            style={{ minWidth: 220 }}
            value={machineId ?? 0}
            onChange={(v) => setMachineId(v === 0 ? undefined : v)}
            loading={equipment.isLoading}
            options={[
              { value: 0, label: 'All machines' },
              ...(equipment.data ?? []).map((e) => ({ value: e.id, label: e.name ?? `#${e.id}` })),
            ]}
          />
        </div>
      </Card>

      {/* Section 1 — Waterfall */}
      <Card title={<span style={{ fontSize: 16, fontWeight: 600 }}>OEE Waterfall</span>} style={{ marginTop: 16, borderRadius: 8 }}>
        {isLoading || !m ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : (
          <>
            <WaterfallBar label="Ideal" value={100} color={FACTOR_COLOR.ideal} />
            <WaterfallBar label="Availability" value={m.availability} color={FACTOR_COLOR.availability}
              lossPct={Math.round((100 - m.availability) * 10) / 10} lossMinutes={data?.inputs.downtimeMinutes} />
            <WaterfallBar label="Performance" value={m.performance} color={FACTOR_COLOR.performance}
              lossPct={Math.round((100 - m.performance) * 10) / 10} lossMinutes={perfLossMin} />
            <WaterfallBar label="Quality" value={m.quality} color={FACTOR_COLOR.quality}
              lossPct={Math.round((100 - m.quality) * 10) / 10} lossMinutes={qualLossMin} />
            <div style={{ borderTop: '1px dashed #e2e6eb', margin: '8px 0 14px' }} />
            <WaterfallBar label="OEE" value={m.oee} color={FACTOR_COLOR.oee} />
          </>
        )}
      </Card>

      {/* Section 2 — Loss categories table */}
      <Card title={<span style={{ fontSize: 16, fontWeight: 600 }}>Loss Categories</span>} style={{ marginTop: 16, borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="key"
          loading={isLoading}
          columns={columns}
          dataSource={(data?.losses ?? []).map((l, i) => ({ ...l, key: `${l.lossType}-${l.category}-${i}` }))}
          pagination={false}
          size="middle"
          locale={{ emptyText: 'No losses recorded for this period.' }}
        />
      </Card>
    </div>
  );
}
