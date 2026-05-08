import { ComingSoon } from '../../../../components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Loss model"
      description="Loss-by-order-number breakdown. Stop categories vs. duration."
      legacyRef="backend/loss_model/byOrderNr.blade.php"
    />
  );
}
