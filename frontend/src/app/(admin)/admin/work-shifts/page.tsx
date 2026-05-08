import { ComingSoon } from '../../../../components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Work shifts"
      description="Shift definitions: start/end, breaks, working days."
      legacyRef="backend/work_shifts/work_shifts.blade.php"
    />
  );
}
