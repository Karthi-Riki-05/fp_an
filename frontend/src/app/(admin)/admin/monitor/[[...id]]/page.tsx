'use client';

// Admin-shell view of the Flow Monitor. Renders the SAME shared monitor page
// as `/monitor`, but adds the admin-only "Generate TV Link" affordance on top
// (Sprint 3 / Task 1). Keeping the shared page as the single source of truth.
import UserMonitorPage from '../../../../(user)/monitor/[[...id]]/page';
import { AndonTvLinkButton } from '../../../../../components/admin/AndonTvLinkButton';

export default function AdminMonitorPage() {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <AndonTvLinkButton />
      </div>
      <UserMonitorPage />
    </>
  );
}
