import { ComingSoon } from '../../../components/ComingSoon';

export default function FlowAnalyzerPage() {
  return (
    <ComingSoon
      title="Flow Analyzer"
      description="HighCharts-driven analysis of production, scrap, stop, OEE, and loss-model data over time. Pick a flow + date range; chart drills down to per-equipment KPIs."
      legacyRef="frontend/flow_analyzer/flow_analyzer.blade.php"
    />
  );
}
