'use client';

import { Spin } from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useMyResultTabs } from '../../../lib/api/myresult';

const SLUG_FOR_ID: Record<number, string> = {
  0: 'production', 1: 'scrap', 2: 'stop', 3: 'warning', 4: 'unregistered',
};

export default function MyResultDispatch() {
  const router = useRouter();
  const tabsQ = useMyResultTabs();

  useEffect(() => {
    if (!tabsQ.data) return;
    const first = tabsQ.data.tabs.find((t) => t.visible);
    const slug = first ? first.slug : 'stop';
    router.replace(`/myresult/${slug}`);
  }, [tabsQ.data, router]);

  return <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>;
}
