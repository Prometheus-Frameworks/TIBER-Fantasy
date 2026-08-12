/** @jest-environment jsdom */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server.node";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StressLab from "@/pages/StressLab";
import {
  buildMockOperatorSignalNoteArtifact,
  buildSuggestedTiberHandoffs,
  serializeOperatorSignalNoteArtifactToCsv,
} from "@/lib/stressLab";
import {
  getTeamEnvironmentMovementSignalStatus,
  type TeamEnvironmentMovementResponse,
} from "@/lib/teamEnvironmentMovement";

function renderStressLab(): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    React.createElement(QueryClientProvider, { client }, React.createElement(StressLab)),
  );
}

function renderInteractiveStressLab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(QueryClientProvider, { client }, React.createElement(StressLab)),
  );
}

afterEach(cleanup);

describe("Stress Lab v0 mock artifact builder", () => {
  it("builds deterministic operator_signal_note_v0 artifacts with contract-aligned metrics and guardrails", () => {
    const note =
      "2026 NFC North WR note: EPA/Play is improving, Catchable Target quality is up, Red Zone route usage and target share need verification.";
    const first = buildMockOperatorSignalNoteArtifact(note);
    const second = buildMockOperatorSignalNoteArtifact(note);

    expect(first).toEqual(second);
    expect(first.source_type).toBe("operator_entered_note");
    expect(first.raw_note).toBe(note);
    expect(first.reasoning_status).toBe("requires_followup");
    expect(first.detected_metrics).toEqual([
      expect.objectContaining({
        metric: "epa_per_play",
        value: null,
        unit: null,
        confidence: "heuristic",
        sample_filter: "operator_note_keyword_match",
      }),
      expect.objectContaining({
        metric: "catchable_target_rate",
        value: null,
        unit: null,
        confidence: "heuristic",
        sample_filter: "operator_note_keyword_match",
      }),
      expect.objectContaining({
        metric: "route_participation",
        value: null,
        unit: null,
        confidence: "heuristic",
        sample_filter: "operator_note_keyword_match",
      }),
      expect.objectContaining({
        metric: "target_share",
        value: null,
        unit: null,
        confidence: "heuristic",
        sample_filter: "operator_note_keyword_match",
      }),
    ]);
    expect(first.detected_metrics[0]).toHaveProperty(
      "context",
      expect.stringContaining("Matched cue: EPA/Play."),
    );
    expect(first.signal_tags).toEqual([
      "epa_context_signal",
      "target_quality_signal",
      "route_role_signal",
      "usage_signal",
      "red_zone_context",
      "division_strength_context",
      "operator_hypothesis",
    ]);
    expect(first.entities).toEqual([
      {
        label: "NFC North",
        entity_type: "division",
      },
      {
        label: "2026",
        entity_type: "season",
      },
    ]);
    expect(first.do_not_apply).toContain(
      "Do not mutate rankings from this note alone.",
    );
    expect(first.do_not_apply).toContain(
      "Do not treat operator notes as verified source truth.",
    );
    expect(first.do_not_apply).toContain("Do not fabricate missing context.");
    expect(first.uncertainty).toContain(
      "Automated parsing is not implemented in v0.",
    );
    expect(first.uncertainty).toContain(
      "Source verification is required before downstream application.",
    );
  });

  it("extracts conservative teamstate, transaction, and fantasy-context cues from a Jets operator note", () => {
    const note =
      "New York Jets 2026 teamstate note:\nJets extended Breece Hall, traded for T’Vondre Sweat, added draft capital from Sauce Gardner/Quinnen Williams trades, signed Geno Smith, and invested premium picks into EDGE/WR. Hypothesis: organizational coherence and offensive environment are improving. Garrett Wilson may be an environment rebound candidate if Geno stabilizes QB play. Breece Hall gains insulation from extension. Risks: defensive talent teardown, new regime volatility, and unknown offensive efficiency.";

    const artifact = buildMockOperatorSignalNoteArtifact(note);
    const entityLabelsByType = (entityType: string) =>
      artifact.entities
        .filter((entity) => entity.entity_type === entityType)
        .map((entity) => entity.label);

    expect(entityLabelsByType("team")).toEqual(
      expect.arrayContaining(["New York Jets", "Jets"]),
    );
    expect(entityLabelsByType("player")).toEqual(
      expect.arrayContaining([
        "Breece Hall",
        "Garrett Wilson",
        "Geno Smith",
        "T’Vondre Sweat",
        "Sauce Gardner",
        "Quinnen Williams",
      ]),
    );
    expect(artifact.entities).toContainEqual({
      label: "2026",
      entity_type: "season",
    });
    expect(artifact.signal_tags).toEqual(
      expect.arrayContaining([
        "teamstate_context",
        "contract_extension_signal",
        "trade_context_signal",
        "draft_capital_signal",
        "offensive_environment_signal",
        "environment_rebound_candidate",
        "player_insulation_signal",
        "defensive_teardown_risk",
        "regime_volatility_risk",
      ]),
    );
    expect(artifact.detected_metrics.map((metric) => metric.metric)).toEqual(
      expect.arrayContaining([
        "teamstate_context",
        "offensive_environment",
        "draft_capital_context",
        "player_insulation",
        "regime_volatility",
        "offensive_efficiency",
      ]),
    );
    expect(artifact.detected_metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: "teamstate_context",
          value: null,
          unit: null,
          confidence: "heuristic",
          sample_filter: "operator_note_keyword_match",
        }),
      ]),
    );
    expect(artifact.required_followups).toEqual(
      expect.arrayContaining([
        "Verify transactions against governed source metadata.",
        "Check whether Teamstate has current offensive environment data for the referenced team.",
        "Check whether downstream fantasy modules already represent QB/environment changes.",
        "Preserve this as hypothesis scaffolding until source truth and season window are verified.",
      ]),
    );
    expect(artifact.uncertainty).toEqual(
      expect.arrayContaining([
        "Player names were detected heuristically but canonical IDs were not resolved in v0.",
        "Team was detected heuristically; canonical team ID resolution is not implemented in v0.",
        "Transaction claims require source verification before downstream use.",
      ]),
    );
    expect(artifact.do_not_apply).toEqual([
      "Do not mutate rankings from this note alone.",
      "Do not treat operator notes as verified source truth.",
      "Do not fabricate missing context.",
    ]);
    expect(
      artifact.entities.every((entity) =>
        ["player", "team", "division", "season"].includes(entity.entity_type),
      ),
    ).toBe(true);
  });

  it("extracts fantasy RB role, usage, market, and insulation cues from an RJ Harvey dynasty note", () => {
    const note =
      "Dynasty note:\nRJ Harvey may become one of the biggest ADP swing players of the offseason if Denver gives him real receiving work early. Efficiency profile and explosive traits are interesting, but pass protection and role stability still feel fragile. If Sean Payton trusts him on third downs, FORGE may need to treat him differently than a normal committee RB. Need to compare projected role opportunity, receiving usage, offensive environment, and insulation risk against current dynasty market price.";

    const artifact = buildMockOperatorSignalNoteArtifact(note);
    const handoffs = buildSuggestedTiberHandoffs(artifact);
    const entityLabelsByType = (entityType: string) =>
      artifact.entities
        .filter((entity) => entity.entity_type === entityType)
        .map((entity) => entity.label);
    const detectedMetricNames = artifact.detected_metrics.map(
      (metric) => metric.metric,
    );

    expect(entityLabelsByType("player")).toEqual(
      expect.arrayContaining(["RJ Harvey"]),
    );
    expect(entityLabelsByType("team")).toEqual(
      expect.arrayContaining(["Denver"]),
    );
    expect(artifact.entities).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Sean Payton",
        }),
      ]),
    );
    expect(
      artifact.entities.every((entity) =>
        ["player", "team", "division", "season"].includes(entity.entity_type),
      ),
    ).toBe(true);
    expect(artifact.signal_tags).toEqual(
      expect.arrayContaining([
        "dynasty_context",
        "adp_market_signal",
        "receiving_usage_signal",
        "receiving_role_context",
        "pass_protection_risk",
        "explosive_traits_signal",
        "role_stability_risk",
        "third_down_role_context",
        "committee_rb_context",
        "forge_model_reference",
        "dynasty_market_price_context",
        "rb_role_competition_context",
        "coaching_trust_context",
      ]),
    );
    expect(detectedMetricNames).toEqual(
      expect.arrayContaining([
        "adp_market_context",
        "receiving_usage",
        "pass_protection",
        "explosive_traits",
        "role_stability",
        "third_down_role",
        "committee_context",
        "dynasty_market_price",
        "forge_model_context",
        "coaching_trust",
        "rb_role_competition",
      ]),
    );
    expect(artifact.detected_metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: "receiving_usage",
          value: null,
          unit: null,
          confidence: "heuristic",
          sample_filter: "operator_note_keyword_match",
        }),
        expect.objectContaining({
          metric: "pass_protection",
          value: null,
          unit: null,
          confidence: "heuristic",
          sample_filter: "operator_note_keyword_match",
        }),
      ]),
    );
    expect(handoffs.map((handoff) => handoff.repo)).toEqual(
      expect.arrayContaining([
        "TIBER-Data",
        "Role & Opportunity",
        "TIBER-Teamstate",
        "TIBER-FORGE",
        "TIBER-Fantasy / Observatory",
      ]),
    );
    expect(handoffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repo: "Role & Opportunity",
          required_artifact_types: expect.arrayContaining([
            "rb_receiving_role_snapshot_v0",
            "third_down_usage_context_v0",
            "backfield_committee_context_v0",
            "role_opportunity_snapshot_v0",
          ]),
        }),
        expect.objectContaining({
          repo: "TIBER-FORGE",
          required_artifact_types: expect.arrayContaining([
            "rb_insulation_risk_signal_v0",
            "dynasty_market_delta_context_v0",
            "player_fantasy_signal_snapshot_v0",
            "offensive_environment_adjustment_v0",
          ]),
        }),
        expect.objectContaining({
          repo: "TIBER-Teamstate",
          required_artifact_types: expect.arrayContaining([
            "coaching_tendency_context_v0",
            "offensive_environment_snapshot_v0",
            "team_backfield_context_v0",
          ]),
        }),
      ]),
    );
    expect(artifact.required_followups).toEqual(
      expect.arrayContaining([
        "Resolve player, team, and game context against canonical TIBER-Data identifiers.",
        "Check Role & Opportunity for receiving usage and third-down role.",
        "Check whether Teamstate has current offensive environment data for the referenced team.",
        "Check FORGE for insulation risk and dynasty market delta.",
        "Preserve ADP/market notes as market context, not source truth.",
      ]),
    );
    expect(artifact.uncertainty).toEqual(
      expect.arrayContaining([
        "ADP/market price can be source-sensitive and time-sensitive.",
        "Receiving role claims require role/opportunity artifact verification.",
        "Pass protection and coaching trust are context-heavy and are not inferred from the note alone.",
      ]),
    );
    expect(artifact.do_not_apply).toEqual([
      "Do not mutate rankings from this note alone.",
      "Do not treat operator notes as verified source truth.",
      "Do not fabricate missing context.",
    ]);
  });

  it("extracts player/team on-off EPA split context without applying ranking mutations", () => {
    const note =
      "San Francisco 49ers [2025]\n" +
      "w/ CMC on the field: 0.157 EPA/Play\n" +
      "w/out CMC: 0.061\n" +
      "Delta: +157%\n\n" +
      "Minnesota Vikings [2025]\n" +
      "w/ Justin Jefferson on the field: -0.009 EPA/Play\n" +
      "w/out Jefferson: 0.081\n" +
      "Delta: -111%";

    const artifact = buildMockOperatorSignalNoteArtifact(note);
    const handoffs = buildSuggestedTiberHandoffs(artifact);
    const labelsByType = (entityType: string) =>
      artifact.entities
        .filter((entity) => entity.entity_type === entityType)
        .map((entity) => entity.label);
    const detectedMetricNames = artifact.detected_metrics.map(
      (metric) => metric.metric,
    );

    expect(labelsByType("team")).toEqual(
      expect.arrayContaining([
        "San Francisco 49ers",
        "49ers",
        "Minnesota Vikings",
        "Vikings",
      ]),
    );
    expect(labelsByType("player")).toEqual(
      expect.arrayContaining(["CMC", "Justin Jefferson"]),
    );
    expect(detectedMetricNames).toEqual(
      expect.arrayContaining([
        "epa_per_play",
        "on_field_epa_per_play",
        "off_field_epa_per_play",
        "efficiency_delta_percentage",
        "on_off_split_context",
      ]),
    );
    expect(artifact.detected_metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: "on_field_epa_per_play",
          value: null,
          unit: null,
          confidence: "heuristic",
          sample_filter: "operator_note_keyword_match",
        }),
        expect.objectContaining({
          metric: "efficiency_delta_percentage",
          value: null,
          unit: null,
          confidence: "heuristic",
          sample_filter: "operator_note_keyword_match",
        }),
      ]),
    );
    expect(artifact.signal_tags).toEqual(
      expect.arrayContaining([
        "on_off_split_context",
        "epa_on_off_signal",
        "player_on_field_context",
        "player_off_field_context",
        "team_efficiency_context",
        "efficiency_delta_signal",
        "counterintuitive_split_context",
      ]),
    );
    expect(artifact.required_followups).toEqual(
      expect.arrayContaining([
        "Verify on/off split source and sample window.",
        "Resolve player/team IDs through TIBER-Data.",
        "Check whether Teamstate has team efficiency context for the referenced season.",
        "Check whether FORGE already accounts for player environment dependency.",
        "Preserve counterintuitive splits as context-required, not automatic player blame.",
      ]),
    );
    expect(artifact.uncertainty).toEqual(
      expect.arrayContaining([
        "On/off splits may be sample-size sensitive and require source-window verification.",
        "Negative on/off deltas require context before interpretation and are not automatic player blame.",
        "CMC alias detected heuristically; canonical player ID is not resolved in v0.",
      ]),
    );
    expect(handoffs.map((handoff) => handoff.repo)).toEqual(
      expect.arrayContaining([
        "TIBER-Data",
        "TIBER-Teamstate",
        "TIBER-FORGE",
        "TIBER-Fantasy / Observatory",
      ]),
    );
    expect(handoffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repo: "TIBER-Teamstate",
          required_artifact_types: expect.arrayContaining([
            "team_efficiency_context_v0",
            "offensive_environment_snapshot_v0",
          ]),
        }),
        expect.objectContaining({
          repo: "TIBER-FORGE",
          required_artifact_types: expect.arrayContaining([
            "player_fantasy_signal_snapshot_v0",
          ]),
        }),
        expect.objectContaining({
          repo: "TIBER-Fantasy / Observatory",
          required_artifact_types: expect.arrayContaining([
            "player_on_off_split_snapshot_v0",
          ]),
        }),
      ]),
    );
    expect(artifact.do_not_apply).toEqual([
      "Do not mutate rankings from this note alone.",
      "Do not treat operator notes as verified source truth.",
      "Do not fabricate missing context.",
    ]);
  });

  it("routes rookie/prospect notes toward TIBER-Rookies while preserving identity and hypothesis guardrails", () => {
    const note =
      "Rookie note:\nTetairoa McMillan has elite prospect capital and strong early career target-earning profile, but I want to compare him against Luther Burden and Travis Hunter using the rookie model. Check draft capital, production profile, landing spot, team environment, and early role opportunity before making dynasty ranking movement.";

    const artifact = buildMockOperatorSignalNoteArtifact(note);
    const handoffs = buildSuggestedTiberHandoffs(artifact);
    const playerLabels = artifact.entities
      .filter((entity) => entity.entity_type === "player")
      .map((entity) => entity.label);
    const detectedMetricNames = artifact.detected_metrics.map(
      (metric) => metric.metric,
    );

    expect(playerLabels).toEqual(
      expect.arrayContaining([
        "Tetairoa McMillan",
        "Luther Burden",
        "Travis Hunter",
      ]),
    );
    expect(artifact.signal_tags).toEqual(
      expect.arrayContaining([
        "rookie_context",
        "rookie_model_reference",
        "prospect_capital_signal",
        "production_profile_signal",
        "landing_spot_context",
        "early_role_opportunity_signal",
        "dynasty_ranking_movement_request",
      ]),
    );
    expect(detectedMetricNames).toEqual(
      expect.arrayContaining([
        "rookie_model_context",
        "prospect_capital",
        "production_profile",
        "landing_spot_context",
        "early_role_opportunity",
        "dynasty_ranking_context",
      ]),
    );
    expect(artifact.detected_metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: "rookie_model_context",
          value: null,
          unit: null,
          confidence: "heuristic",
          sample_filter: "operator_note_keyword_match",
        }),
      ]),
    );
    expect(artifact.required_followups).toEqual(
      expect.arrayContaining([
        "Check TIBER-Rookies for source-backed rookie model outputs.",
        "Resolve rookie player identities through TIBER-Data before comparison.",
        "Treat dynasty ranking movement as downstream interpretation, not raw rookie truth.",
      ]),
    );
    expect(artifact.required_followups).not.toContain(
      "Verify transactions against governed source metadata.",
    );
    expect(artifact.required_followups).not.toContain(
      "Check whether Teamstate has current offensive environment data for the referenced team.",
    );
    expect(artifact.required_followups).not.toContain(
      "Check whether downstream fantasy modules already represent QB/environment changes.",
    );
    expect(artifact.uncertainty).toContain(
      "Rookie player names were detected heuristically but canonical IDs/model artifact links were not resolved in v0.",
    );
    expect(handoffs.map((handoff) => handoff.repo)).toEqual(
      expect.arrayContaining([
        "TIBER-Rookies",
        "TIBER-Data",
        "TIBER-Fantasy / Observatory",
      ]),
    );
    expect(handoffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repo: "TIBER-Rookies",
          domain: "rookie/prospect evaluation",
          claim_classification: "rookie_model_implication",
          required_artifact_types: expect.arrayContaining([
            "rookie_alpha_snapshot_v0",
            "rookie_prospect_profile_v0",
            "rookie_draft_capital_context_v0",
            "rookie_production_profile_v0",
            "rookie_landing_spot_context_v0",
          ]),
        }),
        expect.objectContaining({
          repo: "TIBER-Data",
          claim_classification: "truth_claim",
          required_artifact_types: expect.arrayContaining([
            "canonical_player_identity_v0",
          ]),
        }),
        expect.objectContaining({
          repo: "TIBER-Fantasy / Observatory",
          claim_classification: "operator_hypothesis",
          required_artifact_types: expect.arrayContaining([
            "operator_signal_note_v0",
          ]),
        }),
      ]),
    );
  });

  it("suggests repo handoffs for the Jets operator note", () => {
    const artifact = buildMockOperatorSignalNoteArtifact(
      "New York Jets 2026 teamstate note:\nJets extended Breece Hall, traded for T’Vondre Sweat, added draft capital from Sauce Gardner/Quinnen Williams trades, signed Geno Smith, and invested premium picks into EDGE/WR. Hypothesis: organizational coherence and offensive environment are improving. Garrett Wilson may be an environment rebound candidate if Geno stabilizes QB play. Breece Hall gains insulation from extension. Risks: defensive talent teardown, new regime volatility, and unknown offensive efficiency.",
    );

    const handoffs = buildSuggestedTiberHandoffs(artifact);

    expect(handoffs.map((handoff) => handoff.repo)).toEqual(
      expect.arrayContaining([
        "TIBER-Data",
        "TIBER-Teamstate",
        "TIBER-FORGE",
        "TIBER-Fantasy / Observatory",
      ]),
    );
    expect(artifact.required_followups).toEqual(
      expect.arrayContaining([
        "Verify transactions against governed source metadata.",
        "Check whether Teamstate has current offensive environment data for the referenced team.",
        "Check whether downstream fantasy modules already represent QB/environment changes.",
      ]),
    );
    expect(handoffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repo: "TIBER-Data",
          status: "suggested only",
          claim_classification: "truth_claim",
          required_artifact_types: expect.arrayContaining([
            "roster_snapshot_v0",
          ]),
          next_check:
            "Verify entities and transactions against governed TIBER-Data artifacts before downstream interpretation.",
        }),
        expect.objectContaining({
          repo: "TIBER-Teamstate",
          claim_classification: "team_interpretation",
          required_artifact_types: expect.arrayContaining([
            "team_environment_snapshot_v0",
          ]),
        }),
        expect.objectContaining({
          repo: "TIBER-FORGE",
          claim_classification: "fantasy_implication",
          required_artifact_types: expect.arrayContaining([
            "insulation_adjustment_signal_v0",
          ]),
        }),
        expect.objectContaining({
          repo: "TIBER-Fantasy / Observatory",
          claim_classification: "operator_hypothesis",
          required_artifact_types: expect.arrayContaining([
            "operator_signal_note_v0",
          ]),
        }),
      ]),
    );
  });

  it("suggests Role & Opportunity for role, route, and red-zone notes", () => {
    const artifact = buildMockOperatorSignalNoteArtifact(
      "2026 player note: Red Zone route role and target share need usage review before any downstream interpretation.",
    );

    const handoffs = buildSuggestedTiberHandoffs(artifact);

    expect(handoffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repo: "Role & Opportunity",
          domain: "usage/role signal",
          status: "suggested only",
          claim_classification: "usage_role_signal",
          required_artifact_types: expect.arrayContaining([
            "route_participation_signal_v0",
            "red_zone_usage_context_v0",
          ]),
        }),
      ]),
    );
  });

  it("does not emit non-contract entity types for unresolved context", () => {
    const artifact = buildMockOperatorSignalNoteArtifact(
      "Division strength matters here, but the note does not name a specific division.",
    );

    expect(artifact.entities).toEqual([]);
    expect(artifact.uncertainty).toContain(
      "Division context was mentioned, but no contract-supported division entity was resolved by v0 heuristics.",
    );
  });

  it("serializes operator_signal_note_v0 artifacts to a safely escaped flat CSV", () => {
    const artifact = buildMockOperatorSignalNoteArtifact(
      '2026 NFC North note: "EPA/Play", target share, and route usage need review.\nFollow source metadata.',
    );

    const csv = serializeOperatorSignalNoteArtifactToCsv(artifact);

    expect(csv).toContain(
      "note_id,created_at,source_type,reasoning_status,raw_note,interpretation_summary,entities,detected_metrics,signal_tags,required_followups,uncertainty,do_not_apply",
    );
    expect(csv).toContain(
      '"2026 NFC North note: ""EPA/Play"", target share, and route usage need review.\nFollow source metadata."',
    );
    expect(csv).toContain("NFC North:division|2026:season");
    expect(csv).toContain("epa_per_play:heuristic");
    expect(csv).toContain("operator_note_keyword_match");
    expect(csv).toContain(
      "epa_context_signal|route_role_signal|usage_signal|division_strength_context|operator_hypothesis",
    );
    expect(csv.endsWith("\n")).toBe(true);
  });

  it("renders the read-only Observatory stance", () => {
    const html = renderStressLab();

    expect(html).toContain("TIBER Observatory");
    expect(html).toContain("Turn a football observation into an explicit review path");
    expect(html).toContain("What are you seeing?");
    expect(html).toContain("Your review path will appear here");
    // PR A (#264): the declared system map must not overclaim live status.
    expect(html).toContain("Declared systems");
    expect(html).toContain("not a live health check");
    expect(html).toContain("TIBER-Data");
    expect(html).toContain("Repo boundary awareness");
    expect(html).toContain("Read-only control surface");
    expect(html).toContain("Inspect note");
    expect(html).not.toContain("bg-white shadow-sm");
  });

  // PR C (#264): the live signal inventory is a real read-only data path.
  it("renders the live signal inventory section", () => {
    const html = renderStressLab();

    expect(html).toContain("TIBER signal inventory (live)");
    expect(html).toContain("Teamstate Movement artifact");
    expect(html).toContain("only operator-wide artifact status currently measured here");
  });

  // PR D (#264): take-triage area is explicit about what it does NOT do.
  it("renders take-triage clarity copy", () => {
    const html = renderStressLab();

    expect(html).toContain("Local heuristic");
    expect(html).toContain("What this does not do");
    expect(html).toContain("Does not verify the analyst claim");
    expect(html).toContain("Does not check live NFL data");
    expect(html).toContain("No LLM or RAG");
    expect(html).toContain("does not generate fantasy advice");
    expect(html).toContain("remain responsible for the final judgment");
  });

  it("clears a prior review when the operator edits or replaces its source note", () => {
    renderInteractiveStressLab();

    const note = screen.getByLabelText("Football observation");
    fireEvent.change(note, { target: { value: "WR note: target share needs review." } });
    fireEvent.click(screen.getByRole("button", { name: "Inspect note" }));
    expect(screen.getByText("TIBER found a review path")).toBeTruthy();

    fireEvent.change(note, { target: { value: "A different observation." } });
    expect(screen.queryByText("TIBER found a review path")).toBeNull();
    expect(screen.getByText("Your review path will appear here")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Use an example" }));
    expect(screen.queryByText("TIBER found a review path")).toBeNull();
  });

});

describe("getTeamEnvironmentMovementSignalStatus", () => {
  const base: TeamEnvironmentMovementResponse = {
    ok: true,
    artifact: "team_environment_movement_v1",
    artifactAvailable: true,
    generatedAt: "2026-06-01T00:00:00.000Z",
    governance: null,
    provenanceStatus: null,
    inputSources: [],
    coverage: null,
    teams: [],
    selectedTeam: null,
    warnings: [],
    errors: [],
  };

  it("returns unavailable with no response or when errors are present", () => {
    expect(getTeamEnvironmentMovementSignalStatus(null).status).toBe("unavailable");
    expect(
      getTeamEnvironmentMovementSignalStatus({
        ...base,
        errors: [{ code: "X", message: "boom" }],
      }).status,
    ).toBe("unavailable");
  });

  it("returns missing for a genuine absence (NOT_FOUND, HTTP 200)", () => {
    expect(
      getTeamEnvironmentMovementSignalStatus({ ...base, artifactAvailable: false }).status,
    ).toBe("missing");
    expect(
      getTeamEnvironmentMovementSignalStatus({
        ...base,
        artifactAvailable: false,
        errors: [{ code: "TEAM_ENVIRONMENT_MOVEMENT_NOT_FOUND", message: "absent" }],
      }).status,
    ).toBe("missing");
  });

  it("returns unavailable for a reported failure (non-NOT_FOUND error code)", () => {
    expect(
      getTeamEnvironmentMovementSignalStatus({
        ...base,
        artifactAvailable: false,
        errors: [{ code: "TEAM_ENVIRONMENT_MOVEMENT_UNAVAILABLE", message: "boom" }],
      }).status,
    ).toBe("unavailable");
  });

  it("returns fixture-only for a fixture/synthetic scaffold (wins over governance)", () => {
    expect(
      getTeamEnvironmentMovementSignalStatus({ ...base, provenanceStatus: "fixture_scaffold" }).status,
    ).toBe("fixture-only");
    // fixture_scaffold still wins even if an explicit governed block is present.
    expect(
      getTeamEnvironmentMovementSignalStatus({
        ...base,
        provenanceStatus: "fixture_scaffold",
        governance: { governanceStatus: "governed", governanceSource: "explicit_marker", contractVersion: "v1" },
      }).status,
    ).toBe("fixture-only");
  });

  it("returns governed for explicit_marker + governed + contract version", () => {
    expect(
      getTeamEnvironmentMovementSignalStatus({
        ...base,
        governance: { governanceStatus: "governed", governanceSource: "explicit_marker", contractVersion: "v1" },
      }).status,
    ).toBe("governed");
  });

  it("fails closed to available when the governance source is missing", () => {
    expect(
      getTeamEnvironmentMovementSignalStatus({
        ...base,
        governance: { governanceStatus: "governed", contractVersion: "v1" },
      }).status,
    ).toBe("available");
  });

  it("fails closed to available for non-explicit governance sources (e.g. path_inference)", () => {
    for (const source of ["path_inference", "inferred", "producer", "promotion_pipeline", ""]) {
      expect(
        getTeamEnvironmentMovementSignalStatus({
          ...base,
          governance: { governanceStatus: "governed", governanceSource: source, contractVersion: "v1" },
        }).status,
      ).toBe("available");
    }
  });

  it("fails closed to available when explicit_marker is set but contract version is missing", () => {
    expect(
      getTeamEnvironmentMovementSignalStatus({
        ...base,
        governance: { governanceStatus: "governed", governanceSource: "explicit_marker" },
      }).status,
    ).toBe("available");
  });

  it("does NOT show governed for non-'governed' status tokens, even with explicit_marker + contract", () => {
    for (const token of ["promoted", "fixture", "ungoverned", "weird"]) {
      expect(
        getTeamEnvironmentMovementSignalStatus({
          ...base,
          governance: { governanceStatus: token, governanceSource: "explicit_marker", contractVersion: "v1" },
        }).status,
      ).toBe("available");
    }
  });

  it("returns available when present without an explicit governance block", () => {
    expect(getTeamEnvironmentMovementSignalStatus(base).status).toBe("available");
  });
});
