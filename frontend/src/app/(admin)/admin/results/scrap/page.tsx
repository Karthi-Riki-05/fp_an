import { ComingSoon } from '../../../../../components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Scrap data (admin)"
      description="All scrap entries with reason, quantity, picture."
      legacyRef="backend/result/result_scrap.blade.php"
    />
  );
}
