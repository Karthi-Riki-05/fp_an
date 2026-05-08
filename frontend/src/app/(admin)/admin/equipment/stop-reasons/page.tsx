import { ComingSoon } from '../../../../../components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Equipment stop reasons"
      description="Per-equipment stop-reason mapping. Drag-to-reorder, status toggle."
      legacyRef="backend/equipments/stop_reasons.blade.php"
    />
  );
}
