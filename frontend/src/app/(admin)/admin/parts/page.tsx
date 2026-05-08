import { ComingSoon } from '../../../../components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Parts"
      description="Parts catalog with type, prices, sort order. Excel import/export."
      legacyRef="backend/parts/parts.blade.php"
    />
  );
}
