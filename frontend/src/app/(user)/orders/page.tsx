import { ComingSoon } from '../../../components/ComingSoon';

export default function OrdersPage() {
  return (
    <ComingSoon
      title="Orders"
      description="Production orders for the current tenant — create, edit, status (open/in-progress/done), and link to production data."
      legacyRef="backend/orders/orders.blade.php"
    />
  );
}
