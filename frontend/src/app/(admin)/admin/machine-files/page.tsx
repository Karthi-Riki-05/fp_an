import { ComingSoon } from '../../../../components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Machine files"
      description="Files attached to machine documents. Upload, lock, version history."
      legacyRef="backend/machines/machine_files.blade.php"
    />
  );
}
