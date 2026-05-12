import { redirect } from 'next/navigation';

export default function DeactivatedUsersRedirect() {
  redirect('/admin/access/users?status=deactivated');
}
