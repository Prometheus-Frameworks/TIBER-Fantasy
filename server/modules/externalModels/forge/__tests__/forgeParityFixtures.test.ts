import { formatForgeParityFixtureSnapshot, forgeParityFixtures } from '../fixtures/forgeParityFixtures';

describe('forgeParityFixtures', () => {
  it('loads a compact but representative fixture pack', () => {
    expect(forgeParityFixtures).toHaveLength(8);
    expect(forgeParityFixtures.map((fixture) => fixture.id)).toEqual([
      'wr-justin-jefferson-elite-season',
      'wr-puka-nacua-elite-week',
      'rb-james-conner-stable-season',
      'wr-george-pickens-volatile-week',
      'rb-rachaad-white-weak-opportunity-season',
      'rb-nick-chubb-low-availability-season',
      'te-brock-bowers-dynasty-breakout',
      'rb-christian-mccaffrey-bestball-ceiling',
    ]);
  });

  it('keeps every fixture labeled and fully populated', () => {
    for (const fixture of forgeParityFixtures) {
      expect(fixture.name.length).toBeGreaterThan(0);
      expect(fixture.note.length).toBeGreaterThan(0);
      expect(fixture.request.playerId).toMatch(/^00-\d{7}$/);
      expect(['QB', 'RB', 'WR', 'TE']).toContain(fixture.request.position);
      expect(['redraft', 'dynasty', 'bestball']).toContain(fixture.request.mode);
      expect(fixture.request.includeSourceMeta).toBe(true);
      expect(fixture.request.includeRawCanonical).toBe(false);
    }
  });

  it('renders a deterministic fixture snapshot string', () => {
    expect(formatForgeParityFixtureSnapshot()).toMatchInlineSnapshot(`
"[
  {
    \"id\": \"wr-justin-jefferson-elite-season\",
    \"name\": \"Justin Jefferson elite season baseline\",
    \"note\": \"Clear high-end WR case used to check that both implementations stay aligned on obvious alpha profiles.\",
    \"request\": {
      \"includeRawCanonical\": false,
      \"includeSourceMeta\": true,
      \"mode\": \"redraft\",
      \"playerId\": \"00-0036322\",
      \"position\": \"WR\",
      \"season\": 2025,
      \"week\": \"season\"
    }
  },
  {
    \"id\": \"wr-puka-nacua-elite-week\",
    \"name\": \"Puka Nacua high-output weekly snapshot\",
    \"note\": \"Single-week elite WR case to catch parity drift on peak in-season scoring and component attribution.\",
    \"request\": {
      \"includeRawCanonical\": false,
      \"includeSourceMeta\": true,
      \"mode\": \"redraft\",
      \"playerId\": \"00-0039075\",
      \"position\": \"WR\",
      \"season\": 2025,
      \"week\": 10
    }
  },
  {
    \"id\": \"rb-james-conner-stable-season\",
    \"name\": \"James Conner stable mid-tier season\",
    \"note\": \"Mid-tier stable RB case meant to stay comparable without huge ceiling assumptions.\",
    \"request\": {
      \"includeRawCanonical\": false,
      \"includeSourceMeta\": true,
      \"mode\": \"redraft\",
      \"playerId\": \"00-0033553\",
      \"position\": \"RB\",
      \"season\": 2025,
      \"week\": \"season\"
    }
  },
  {
    \"id\": \"wr-george-pickens-volatile-week\",
    \"name\": \"George Pickens volatile weekly case\",
    \"note\": \"Boom/bust WR case used to detect migration drift around efficiency spikes and stability penalties.\",
    \"request\": {
      \"includeRawCanonical\": false,
      \"includeSourceMeta\": true,
      \"mode\": \"redraft\",
      \"playerId\": \"00-0037247\",
      \"position\": \"WR\",
      \"season\": 2025,
      \"week\": 8
    }
  },
  {
    \"id\": \"rb-rachaad-white-weak-opportunity-season\",
    \"name\": \"Rachaad White weak opportunity season\",
    \"note\": \"Lower-end opportunity case used to ensure the compare harness still reports parity for weaker profiles.\",
    \"request\": {
      \"includeRawCanonical\": false,
      \"includeSourceMeta\": true,
      \"mode\": \"redraft\",
      \"playerId\": \"00-0037256\",
      \"position\": \"RB\",
      \"season\": 2025,
      \"week\": \"season\"
    }
  },
  {
    \"id\": \"rb-nick-chubb-low-availability-season\",
    \"name\": \"Nick Chubb low-availability season\",
    \"note\": \"Injury and missed-time style case to test partial data, low availability, and fallback handling.\",
    \"request\": {
      \"includeRawCanonical\": false,
      \"includeSourceMeta\": true,
      \"mode\": \"redraft\",
      \"playerId\": \"00-0034791\",
      \"position\": \"RB\",
      \"season\": 2025,
      \"week\": \"season\"
    }
  },
  {
    \"id\": \"te-brock-bowers-dynasty-breakout\",
    \"name\": \"Brock Bowers dynasty breakout check\",
    \"note\": \"Young TE dynasty fixture to keep compare coverage from being only redraft WR/RB cases.\",
    \"request\": {
      \"includeRawCanonical\": false,
      \"includeSourceMeta\": true,
      \"mode\": \"dynasty\",
      \"playerId\": \"00-0039338\",
      \"position\": \"TE\",
      \"season\": 2025,
      \"week\": \"season\"
    }
  },
  {
    \"id\": \"rb-christian-mccaffrey-bestball-ceiling\",
    \"name\": \"Christian McCaffrey best ball ceiling check\",
    \"note\": \"High-end RB in best ball mode used to catch mode-specific parity drift in the compare path.\",
    \"request\": {
      \"includeRawCanonical\": false,
      \"includeSourceMeta\": true,
      \"mode\": \"bestball\",
      \"playerId\": \"00-0033280\",
      \"position\": \"RB\",
      \"season\": 2025,
      \"week\": \"season\"
    }
  }
]"
`);
  });
});
