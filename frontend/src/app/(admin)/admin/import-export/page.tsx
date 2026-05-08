import { ComingSoon } from '../../../../components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Import / Export"
      description="Excel import/export for equipments, parts, orders. Background processing via BullMQ."
      legacyRef="backend/result/import_export.blade.php"
    />
  );
}
