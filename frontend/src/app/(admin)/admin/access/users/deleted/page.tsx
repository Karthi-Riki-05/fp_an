import { redirect } from 'next/navigation';

export default function DeletedUsersRedirect() {
  redirect('/admin/access/users?status=deleted');
}
