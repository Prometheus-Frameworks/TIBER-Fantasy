import ComingSoon from '../shared/ComingSoon';

export default function MovesTab() {
  return (
    <ComingSoon
      title="Trade & Move Analyzer"
      description="Evaluate trades, waiver pickups, and roster moves with AI-powered analysis and real-time value calculations."
      features={[
        'Trade evaluation & fairness scoring',
        'Multi-team trade scenarios',
        'Waiver wire recommendations',
        'Drop/Add suggestions',
        'Buy-low / Sell-high targets',
        'Dynasty future value projection'
      ]}
    />
  );
}
