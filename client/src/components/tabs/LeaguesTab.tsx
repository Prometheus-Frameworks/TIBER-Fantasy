import ComingSoon from '../shared/ComingSoon';

export default function LeaguesTab() {
  return (
    <ComingSoon
      title="League Management"
      description="League sync is in early prototype mode. Features may be incomplete or unstable while we rebuild the engine behind it with FORGE-powered analytics."
      features={[
        'Sleeper league auto-sync (beta)',
        'Multi-league roster dashboard',
        'Team value comparison tools',
        'Personalized trade targets',
        'League-context rankings',
        'Roster gap analysis'
      ]}
    />
  );
}
