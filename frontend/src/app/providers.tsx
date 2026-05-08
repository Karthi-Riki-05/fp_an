'use client';

import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider, theme } from 'antd';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            // Brand colors from legacy public/assets/sass/ — refined in Phase 4.
            colorPrimary: '#954cfe',
            colorInfo: '#01b9d0',
          },
        }}
      >
        {children}
      </ConfigProvider>
    </AntdRegistry>
  );
}
