import { NormalizedOffensiveUsageProfile, PlayerRole } from "./batchAssignRoles";

export interface LabeledRoleFixture {
  fixtureId: string;
  expectedRole: PlayerRole;
  profile: NormalizedOffensiveUsageProfile;
}

export const CALIBRATION_FIXTURES: LabeledRoleFixture[] = [
  {
    fixtureId: "qb-lamar-dual-threat",
    expectedRole: "QB_DUAL_THREAT",
    profile: {
      playerId: "qb_001",
      playerName: "Lamar Jackson (fixture)",
      position: "QB",
      metrics: {
        passAttemptShare: 0.72,
        designedRushShare: 0.9,
        redZoneShare: 0.75,
        airYardsShare: 0.58,
      },
    },
  },
  {
    fixtureId: "qb-purdy-game-manager",
    expectedRole: "QB_GAME_MANAGER",
    profile: {
      playerId: "qb_002",
      playerName: "Brock Purdy (fixture)",
      position: "QB",
      metrics: {
        passAttemptShare: 0.62,
        designedRushShare: 0.16,
        redZoneShare: 0.56,
        airYardsShare: 0.5,
      },
    },
  },
  {
    fixtureId: "rb-mccaffrey-workhorse",
    expectedRole: "RB_WORKHORSE",
    profile: {
      playerId: "rb_001",
      playerName: "Christian McCaffrey (fixture)",
      position: "RB",
      metrics: {
        snapShare: 0.84,
        carryShare: 0.86,
        routeParticipation: 0.58,
        targetShare: 0.62,
      },
    },
  },
  {
    fixtureId: "rb-kamara-pass-catching",
    expectedRole: "RB_PASS_CATCHING",
    profile: {
      playerId: "rb_002",
      playerName: "Alvin Kamara (fixture)",
      position: "RB",
      metrics: {
        routeParticipation: 0.84,
        targetShare: 0.72,
        carryShare: 0.35,
        snapShare: 0.68,
      },
    },
  },
  {
    fixtureId: "wr-jefferson-alpha",
    expectedRole: "WR_ALPHA",
    profile: {
      playerId: "wr_001",
      playerName: "Justin Jefferson (fixture)",
      position: "WR",
      metrics: {
        snapShare: 0.9,
        targetShare: 0.88,
        airYardsShare: 0.8,
        routeParticipation: 0.86,
      },
    },
  },
  {
    fixtureId: "wr-shaheed-deep-threat",
    expectedRole: "WR_DEEP_THREAT",
    profile: {
      playerId: "wr_002",
      playerName: "Rashid Shaheed (fixture)",
      position: "WR",
      metrics: {
        airYardsShare: 0.9,
        adot: 0.88,
        targetShare: 0.46,
        routeParticipation: 0.62,
      },
    },
  },
  {
    fixtureId: "te-kelce-move",
    expectedRole: "TE_MOVE",
    profile: {
      playerId: "te_001",
      playerName: "Travis Kelce (fixture)",
      position: "TE",
      metrics: {
        routeParticipation: 0.82,
        targetShare: 0.69,
        airYardsShare: 0.46,
        redZoneShare: 0.58,
      },
    },
  },
  {
    fixtureId: "te-kmet-inline",
    expectedRole: "TE_INLINE",
    profile: {
      playerId: "te_002",
      playerName: "Cole Kmet (fixture)",
      position: "TE",
      metrics: {
        snapShare: 0.82,
        routeParticipation: 0.52,
        redZoneShare: 0.52,
        targetShare: 0.34,
      },
    },
  },
  {
    fixtureId: "wr-unknown-profile",
    expectedRole: "UNKNOWN",
    profile: {
      playerId: "wr_003",
      playerName: "Unknown WR (fixture)",
      position: "WR",
      metrics: {
        routeParticipation: 0.5,
      },
    },
  },
];
