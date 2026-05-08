import { ComingSoon } from '../../../../../components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Roles (admin)"
      description="Role definitions + permission matrix."
      legacyRef="backend/access/roles/role.blade.php"
    />
  );
}
