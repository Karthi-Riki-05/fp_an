import { ComingSoon } from '../../../../components/ComingSoon';

export default function ProfileEditPage() {
  return (
    <ComingSoon
      title="Edit profile"
      description="Update your name, email, password, language, timezone, and FCM notification settings."
      legacyRef="frontend/user/profile/edit.blade.php"
    />
  );
}
