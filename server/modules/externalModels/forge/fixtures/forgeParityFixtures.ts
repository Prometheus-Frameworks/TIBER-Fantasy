import stableStringify from 'json-stable-stringify';
import { TiberForgeComparisonRequest } from '../types';

export interface ForgeParityFixture {
  id: string;
  name: string;
  note: string;
  request: TiberForgeComparisonRequest;
}

export const forgeParityFixtures: ForgeParityFixture[] = [
  {
    id: 'wr-justin-jefferson-elite-season',
    name: 'Justin Jefferson elite season baseline',
    note: 'Clear high-end WR case used to check that both implementations stay aligned on obvious alpha profiles.',
    request: {
      playerId: '00-0036322',
      position: 'WR',
      season: 2025,
      week: 'season',
      mode: 'redraft',
      includeSourceMeta: true,
      includeRawCanonical: false,
    },
  },
  {
    id: 'wr-puka-nacua-elite-week',
    name: 'Puka Nacua high-output weekly snapshot',
    note: 'Single-week elite WR case to catch parity drift on peak in-season scoring and component attribution.',
    request: {
      playerId: '00-0039075',
      position: 'WR',
      season: 2025,
      week: 10,
      mode: 'redraft',
      includeSourceMeta: true,
      includeRawCanonical: false,
    },
  },
  {
    id: 'rb-james-conner-stable-season',
    name: 'James Conner stable mid-tier season',
    note: 'Mid-tier stable RB case meant to stay comparable without huge ceiling assumptions.',
    request: {
      playerId: '00-0033553',
      position: 'RB',
      season: 2025,
      week: 'season',
      mode: 'redraft',
      includeSourceMeta: true,
      includeRawCanonical: false,
    },
  },
  {
    id: 'wr-george-pickens-volatile-week',
    name: 'George Pickens volatile weekly case',
    note: 'Boom/bust WR case used to detect migration drift around efficiency spikes and stability penalties.',
    request: {
      playerId: '00-0037247',
      position: 'WR',
      season: 2025,
      week: 8,
      mode: 'redraft',
      includeSourceMeta: true,
      includeRawCanonical: false,
    },
  },
  {
    id: 'rb-rachaad-white-weak-opportunity-season',
    name: 'Rachaad White weak opportunity season',
    note: 'Lower-end opportunity case used to ensure the compare harness still reports parity for weaker profiles.',
    request: {
      playerId: '00-0037256',
      position: 'RB',
      season: 2025,
      week: 'season',
      mode: 'redraft',
      includeSourceMeta: true,
      includeRawCanonical: false,
    },
  },
  {
    id: 'rb-nick-chubb-low-availability-season',
    name: 'Nick Chubb low-availability season',
    note: 'Injury and missed-time style case to test partial data, low availability, and fallback handling.',
    request: {
      playerId: '00-0034791',
      position: 'RB',
      season: 2025,
      week: 'season',
      mode: 'redraft',
      includeSourceMeta: true,
      includeRawCanonical: false,
    },
  },
  {
    id: 'te-brock-bowers-dynasty-breakout',
    name: 'Brock Bowers dynasty breakout check',
    note: 'Young TE dynasty fixture to keep compare coverage from being only redraft WR/RB cases.',
    request: {
      playerId: '00-0039338',
      position: 'TE',
      season: 2025,
      week: 'season',
      mode: 'dynasty',
      includeSourceMeta: true,
      includeRawCanonical: false,
    },
  },
  {
    id: 'rb-christian-mccaffrey-bestball-ceiling',
    name: 'Christian McCaffrey best ball ceiling check',
    note: 'High-end RB in best ball mode used to catch mode-specific parity drift in the compare path.',
    request: {
      playerId: '00-0033280',
      position: 'RB',
      season: 2025,
      week: 'season',
      mode: 'bestball',
      includeSourceMeta: true,
      includeRawCanonical: false,
    },
  },
];

export function formatForgeParityFixtureSnapshot(fixtures: ForgeParityFixture[] = forgeParityFixtures): string {
  const projection = fixtures.map((fixture) => ({
    id: fixture.id,
    name: fixture.name,
    note: fixture.note,
    request: fixture.request,
  }));

  return stableStringify(projection, { space: 2 });
}
