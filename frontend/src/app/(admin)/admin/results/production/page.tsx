import { ComingSoon } from '../../../../../components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Production data (admin)"
      description="All production entries across the tenant. Filter, edit, delete."
      legacyRef="backend/result/result_production.blade.php"
    />
  );
}
