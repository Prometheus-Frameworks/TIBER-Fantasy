import { buildPromotedModuleHref, readDataLabPlayerCarryParams } from '@/lib/dataLabPromotedModules';

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

  it('parses player carry params from a query string', () => {
    expect(readDataLabPlayerCarryParams('?playerId=00-0042051&playerName=Malik+Nabers')).toEqual({
      playerId: '00-0042051',
      playerName: 'Malik Nabers',
    });
  });
});
