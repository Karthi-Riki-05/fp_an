import { ComingSoon } from '../../../../components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Shift schedules"
      description="Calendar-based shift assignment. Recurring rules, equipment binding."
      legacyRef="backend/shift_schedule/shift_schedule.blade.php"
    />
  );
}
