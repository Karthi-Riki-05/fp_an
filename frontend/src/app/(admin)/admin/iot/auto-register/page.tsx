import { ComingSoon } from '../../../../../components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="IoT auto-register"
      description="Configuration for auto-registering machines from IoT signals."
      legacyRef="backend/machine/auto_stop_reg.blade.php"
    />
  );
}
