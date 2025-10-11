import ComingSoon from '../shared/ComingSoon';

export default function LeaguesTab() {
  return (
    <ComingSoon
      title="League Management"
      description="Connect your leagues, track rosters, and get personalized insights based on your actual team."
      features={[
        'Sleeper league sync',
        'Multi-league dashboard',
        'Roster analysis & gaps',
        'Personalized trade targets',
        'League-specific rankings',
        'Waiver wire priorities'
      ]}
    />
  );
}
