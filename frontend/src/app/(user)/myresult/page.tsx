import { ComingSoon } from '../../../components/ComingSoon';

export default function MyResultPage() {
  return (
    <ComingSoon
      title="My Result"
      description="Your production / scrap / stop / warning data, filterable by date and shift. Edit and delete entries from one screen."
      legacyRef="frontend/user/myresult/index.blade.php"
      related={[
        { href: '/myresult/production_data', label: 'Production data' },
        { href: '/myresult/scrap_data',      label: 'Scrap data' },
        { href: '/myresult/stop_data',       label: 'Stop data' },
        { href: '/myresult/warning_log',     label: 'Warning log' },
      ]}
    />
  );
}
