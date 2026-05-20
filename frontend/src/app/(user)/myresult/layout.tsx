'use client';

import { LeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { DateRangeSlider } from '../../../components/myresult/DateRangeSlider';
import { TabStrip } from '../../../components/myresult/TabStrip';

export default function MyResultLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{
        background: '#003e4e', color: '#fff',
        padding: '10px 14px',
        borderTopLeftRadius: 4, borderTopRightRadius: 4,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Link href="/dashboard" style={{ color: '#fff' }}><LeftOutlined /> </Link>
        <span style={{ fontWeight: 600 }}>Results</span>
      </div>
      <div style={{ background: '#fff', border: '1px solid #ddd', borderTop: 'none' }}>
        <TabStrip />
        <div style={{ padding: 12 }}>
          <DateRangeSlider />
        </div>
        <div style={{ padding: 12 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
