-- Phase A: Facts Schema Extension
-- Extend player_week_facts table with FPG-centric analytics columns
-- Provides foundation for advanced scoring system with real data

ALTER TABLE player_week_facts
  ADD COLUMN fpg NUMERIC DEFAULT 0,              -- Fantasy points per game (raw)
  ADD COLUMN xfpg NUMERIC DEFAULT 0,             -- Expected FPG from usage/DeepSeek
  ADD COLUMN proj_fpg NUMERIC DEFAULT 0,         -- External projections
  ADD COLUMN beat_proj NUMERIC DEFAULT 0,        -- Scaled 0-100: how much player beats projections
  ADD COLUMN upside_index NUMERIC DEFAULT 0,     -- 0-100: position-specific upside potential
  ADD COLUMN features JSONB DEFAULT '{}'::JSONB; -- Raw feature key/values for audit trail

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_week_facts_fpg ON player_week_facts(fpg);
CREATE INDEX IF NOT EXISTS idx_player_week_facts_upside_index ON player_week_facts(upside_index);
CREATE INDEX IF NOT EXISTS idx_player_week_facts_features ON player_week_facts USING GIN(features);

-- Add comments for clarity
COMMENT ON COLUMN player_week_facts.fpg IS 'Fantasy points per game (raw points)';
COMMENT ON COLUMN player_week_facts.xfpg IS 'Expected fantasy points from usage patterns';
COMMENT ON COLUMN player_week_facts.proj_fpg IS 'External projection consensus';
COMMENT ON COLUMN player_week_facts.beat_proj IS 'Performance vs projections (0-100 scale)';
COMMENT ON COLUMN player_week_facts.upside_index IS 'Position-specific upside potential (0-100)';
COMMENT ON COLUMN player_week_facts.features IS 'Raw feature values for audit trail and debugging';