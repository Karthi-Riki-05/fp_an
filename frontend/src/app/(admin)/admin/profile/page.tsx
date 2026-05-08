import { ComingSoon } from '../../../../components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Admin profile"
      description="Update your name, email, password, language, timezone."
      legacyRef="backend/access/user/edit.blade.php"
    />
  );
}
