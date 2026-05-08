'use client';

import { MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { Space, Typography } from 'antd';
import Image from 'next/image';
import { brand } from '../../lib/assets';

const { Text } = Typography;

interface Props {
  locale?: 'en' | 'sv';
}

const FOOTER_LABELS = {
  sv: { contact: 'KONTAKTA OSS', address: 'Science Park Skövde, Växthuset\nKaplangatan 16B, 54134 Skövde\nSweden', copyright: 'FP Analyzer. Alla rättigheter förbehållna.' },
  en: { contact: 'CONTACT US',     address: 'Science Park Skövde, Växthuset\nKaplangatan 16B, 54134 Skövde\nSweden', copyright: 'FP Analyzer. All rights reserved.' },
} as const;

/**
 * The dark footer block at the bottom of every page (marketing + dashboard).
 * Mirrors the legacy frontend/includes/footer.blade.php.
 */
export function MarketingFooter({ locale = 'sv' }: Props) {
  const labels = FOOTER_LABELS[locale];
  const year = new Date().getFullYear();

  return (
    <footer style={{ background: '#0e2a30', color: '#cfd2d6' }}>
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '40px 24px 32px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 32,
        }}
      >
        <div>
          <Image
            src={brand.logo}
            alt="FP Analyzer"
            width={160}
            height={40}
            style={{ height: 40, width: 'auto', filter: 'brightness(1.1) opacity(0.85)' }}
          />
          <div style={{ height: 2, width: 60, background: '#01b9d0', margin: '12px 0 0' }} />
        </div>

        <div>
          <Text strong style={{ color: '#fff', letterSpacing: 0.6 }}>
            {labels.contact}
          </Text>
          <div style={{ height: 2, width: 60, background: '#01b9d0', margin: '8px 0 16px' }} />
          <Text style={{ color: '#cfd2d6', fontSize: 13, whiteSpace: 'pre-line', display: 'block', marginBottom: 12 }}>
            {labels.address}
          </Text>
          <Space direction="vertical" size={6}>
            <Text style={{ color: '#cfd2d6', fontSize: 13 }}>
              <PhoneOutlined style={{ color: '#01b9d0', marginRight: 8 }} />
              +46 (0)70 334 4688
            </Text>
            <Text style={{ color: '#cfd2d6', fontSize: 13 }}>
              <MailOutlined style={{ color: '#01b9d0', marginRight: 8 }} />
              <a href="mailto:info@fpanalyzer.se" style={{ color: '#cfd2d6' }}>
                info@fpanalyzer.se
              </a>
            </Text>
          </Space>
        </div>
      </div>

      <div
        style={{
          background: '#06121c',
          padding: '12px 24px',
          textAlign: 'left',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <Text style={{ color: '#5d6066', fontSize: 12 }}>
            Copyright © {year} {labels.copyright}
          </Text>
        </div>
      </div>
    </footer>
  );
}
