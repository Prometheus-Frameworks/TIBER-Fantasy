import {
  buildPromotedModuleHref,
  buildPromotedModuleNavigationLabel,
  formatPromotedModuleProvenance,
  readDataLabPlayerCarryParams,
} from '@/lib/dataLabPromotedModules';

describe('dataLabPromotedModules helpers', () => {
  it('builds related-module deep links with player carry-through', () => {
    expect(buildPromotedModuleHref('age-curves', {
      playerId: '00-0036322',
      playerName: 'Justin Jefferson',
    })).toBe('/tiber-data-lab/age-curves?playerId=00-0036322&playerName=Justin+Jefferson');
  });

  it('builds point-scenario deep links with player carry-through', () => {
    expect(buildPromotedModuleHref('point-scenarios', {
      playerId: '00-0036322',
      playerName: 'Justin Jefferson',
    })).toBe('/tiber-data-lab/point-scenarios?playerId=00-0036322&playerName=Justin+Jefferson');
  });

  it('builds player-research deep links with carried season context', () => {
    expect(buildPromotedModuleHref('player-research', {
      playerId: '00-0036322',
      playerName: 'Justin Jefferson',
      season: '2025',
    })).toBe('/tiber-data-lab/player-research?playerId=00-0036322&playerName=Justin+Jefferson&season=2025');
  });

  it('parses player carry params from a query string', () => {
    expect(readDataLabPlayerCarryParams('?playerId=00-0042051&playerName=Malik+Nabers&team=NYG&season=2025')).toEqual({
      playerId: '00-0042051',
      playerName: 'Malik Nabers',
      team: 'NYG',
      season: '2025',
    });
  });

  it('builds team-research deep links and formats shared labels/provenance copy', () => {
    expect(buildPromotedModuleHref('team-research', { team: 'MIN', season: '2025' })).toBe('/tiber-data-lab/team-research?team=MIN&season=2025');
    expect(buildPromotedModuleNavigationLabel('command-center')).toBe('Go to command center');
    expect(buildPromotedModuleNavigationLabel('player-research')).toBe('Go to player research');
    expect(buildPromotedModuleNavigationLabel('team-research')).toBe('Go to team research');
    expect(buildPromotedModuleNavigationLabel('age-curves')).toBe('Go to module');
    expect(formatPromotedModuleProvenance({
      provider: 'arc-model',
      mode: 'artifact',
      location: '/exports/age_curve_lab.json',
    })).toBe('arc-model · artifact export · /exports/age_curve_lab.json');
  });
});
