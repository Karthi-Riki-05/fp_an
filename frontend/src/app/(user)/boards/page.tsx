import { ComingSoon } from '../../../components/ComingSoon';

export default function BoardsPage() {
  return (
    <ComingSoon
      title="Boards"
      description="Custom dashboards built by users. Pick a board to display KPIs, charts, and shift summaries side-by-side. Boards are tenant-scoped."
      legacyRef="backend/board/listDashboard.blade.php"
    />
  );
}
