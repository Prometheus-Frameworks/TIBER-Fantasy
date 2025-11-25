import ComingSoon from '../shared/ComingSoon';

export default function MovesTab() {
  return (
    <ComingSoon
      title="Trade & Move Analyzer"
      description="This page will host the FORGE-powered trade engine: consolidation penalties, future value curves, and true dynasty leverage analysis. The current version is in preview and major upgrades are coming."
      features={[
        'FORGE-powered trade evaluation',
        'Consolidation penalty modeling',
        'Dynasty future value curves',
        'Multi-asset trade scenarios',
        'Buy-low / Sell-high detection',
        'League-context trade intelligence'
      ]}
    />
  );
}
