'use client';

import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App as AntApp, ConfigProvider } from 'antd';
import { ReactNode } from 'react';
import { QueryProvider } from '../components/QueryProvider';
import { antdTheme } from '../lib/theme/antd-theme';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider theme={antdTheme}>
        {/* AntApp adds context for message/notification/modal hooks. */}
        <AntApp>
          <QueryProvider>{children}</QueryProvider>
        </AntApp>
      </ConfigProvider>
    </AntdRegistry>
  );
}
