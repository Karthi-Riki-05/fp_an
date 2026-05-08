import { ComingSoon } from '../../../../../components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Users (admin)"
      description="User CRUD, deactivate/reactivate, login-as, password change."
      legacyRef="backend/access/user/user.blade.php"
    />
  );
}
