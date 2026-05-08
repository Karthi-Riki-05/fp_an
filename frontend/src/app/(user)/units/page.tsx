import { ComingSoon } from '../../../components/ComingSoon';

export default function UnitsPage() {
  return (
    <ComingSoon
      title="Units"
      description="Live status of every IoT unit registered to your tenant. Register stops, view connection status, manage per-unit notification settings."
      legacyRef="frontend/units/index.blade.php"
    />
  );
}
