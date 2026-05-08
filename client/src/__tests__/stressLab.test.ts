import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StressLab from "@/pages/StressLab";
import {
  buildMockOperatorSignalNoteArtifact,
  serializeOperatorSignalNoteArtifactToCsv,
} from "@/lib/stressLab";

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

  it("renders the read-only reasoning sandbox stance", () => {
    const html = renderToStaticMarkup(React.createElement(StressLab));

    expect(html).toContain("TIBER Stress Lab");
    expect(html).toContain("operator_signal_note_v0");
    expect(html).toContain("Operator notes generate hypotheses, not truth.");
    expect(html).toContain(
      "Stress Lab is for testing reasoning integrity, not changing rankings.",
    );
    expect(html).toContain("No mutation path");
    expect(html).toContain("Inspect note");
  });
});
