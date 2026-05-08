import { ComingSoon } from '../../../../components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Flow monitor (admin)"
      description="Live status of every flow across all equipment in the tenant."
      legacyRef="backend/flow_control/flow_monitor.blade.php"
    />
  );
}
