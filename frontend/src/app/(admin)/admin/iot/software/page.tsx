import { ComingSoon } from '../../../../../components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="IoT firmware"
      description="Upload + version IoT firmware ZIPs."
      legacyRef="backend/machine/showIotSoftwares.blade.php"
    />
  );
}
