-- Rankings Backend Database Schema
-- Simple, transparent infrastructure for fantasy football rankings system
-- Used by "On The Clock" website

-- =============================================================================
-- USERS TABLE
-- =============================================================================
-- Stores basic user information for attribution and filtering
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for fast username lookups
CREATE INDEX idx_users_username ON users(username);

-- =============================================================================
-- PLAYERS TABLE
-- =============================================================================
-- Master list of all fantasy football players
-- Simple structure focusing on essential identification
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    position VARCHAR(10) NOT NULL, -- QB, RB, WR, TE, K, DST
    team VARCHAR(10) NOT NULL,     -- NFL team abbreviation (e.g., KC, BUF)
    is_active BOOLEAN DEFAULT true, -- Track if player is currently active
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for common queries
CREATE INDEX idx_players_position ON players(position);
CREATE INDEX idx_players_team ON players(team);
CREATE INDEX idx_players_active ON players(is_active);

-- =============================================================================
-- INDIVIDUAL RANKINGS TABLE
-- =============================================================================
-- Stores personal rankings submitted by individual users
-- Each user can have one ranking per format (redraft/dynasty)
CREATE TABLE individual_rankings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    format VARCHAR(20) NOT NULL,        -- 'redraft' or 'dynasty'
    dynasty_type VARCHAR(20),           -- 'rebuilder' or 'contender' (only for dynasty)
    rank_position INTEGER NOT NULL,     -- 1-based ranking position
    notes TEXT,                         -- Optional user notes for this ranking
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one ranking per user per player per format/dynasty_type combo
    UNIQUE(user_id, player_id, format, dynasty_type)
);

-- Add indexes for efficient consensus calculations
CREATE INDEX idx_individual_format ON individual_rankings(format);
CREATE INDEX idx_individual_dynasty_type ON individual_rankings(dynasty_type);
CREATE INDEX idx_individual_player_format ON individual_rankings(player_id, format);
CREATE INDEX idx_individual_user_format ON individual_rankings(user_id, format);

-- =============================================================================
-- DYNAMIC CONSENSUS RANKINGS VIEW
-- =============================================================================
-- Dynamic view that calculates consensus rankings in real-time
-- Uses simple averages of individual rankings without storing static data
CREATE VIEW dynamic_consensus_rankings AS
SELECT
    ir.player_id,
    p.name as player_name,
    p.position,
    p.team,
    ir.format,
    ir.dynasty_type,
    AVG(ir.rank_position) as average_rank,
    COUNT(ir.rank_position) as rank_count,
    ROW_NUMBER() OVER (
        PARTITION BY ir.format, ir.dynasty_type 
        ORDER BY AVG(ir.rank_position)
    ) as consensus_rank
FROM individual_rankings ir
JOIN players p ON ir.player_id = p.id
GROUP BY ir.player_id, p.name, p.position, p.team, ir.format, ir.dynasty_type;

-- =============================================================================
-- RANKING SUBMISSIONS LOG
-- =============================================================================
-- Audit trail of all ranking submissions for transparency
-- Helps track when consensus needs to be recalculated
CREATE TABLE ranking_submissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    format VARCHAR(20) NOT NULL,
    dynasty_type VARCHAR(20),
    submission_type VARCHAR(20) NOT NULL, -- 'full_ranking', 'partial_update', 'delete'
    players_affected INTEGER NOT NULL,     -- Count of players in this submission
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for tracking recent submissions
CREATE INDEX idx_submissions_date ON ranking_submissions(submitted_at);

-- =============================================================================
-- VALIDATION CONSTRAINTS
-- =============================================================================
-- Add check constraints to ensure data integrity

-- Format must be either 'redraft' or 'dynasty'
ALTER TABLE individual_rankings 
ADD CONSTRAINT check_format 
CHECK (format IN ('redraft', 'dynasty'));

-- Dynasty type only valid for dynasty format
ALTER TABLE individual_rankings 
ADD CONSTRAINT check_dynasty_type 
CHECK (
    (format = 'dynasty' AND dynasty_type IN ('rebuilder', 'contender')) OR
    (format = 'redraft' AND dynasty_type IS NULL)
);

-- Rank position must be positive
ALTER TABLE individual_rankings 
ADD CONSTRAINT check_rank_positive 
CHECK (rank_position > 0);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to update consensus rankings for a specific format/dynasty_type
-- Called automatically when individual rankings change
CREATE OR REPLACE FUNCTION update_consensus_rankings(
    p_format VARCHAR(20),
    p_dynasty_type VARCHAR(20) DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    affected_rows INTEGER := 0;
BEGIN
    -- Delete existing consensus for this format/dynasty_type
    DELETE FROM consensus_rankings 
    WHERE format = p_format 
    AND (dynasty_type = p_dynasty_type OR (dynasty_type IS NULL AND p_dynasty_type IS NULL));
    
    -- Calculate new consensus using simple averages
    INSERT INTO consensus_rankings (player_id, format, dynasty_type, average_rank, rank_count, consensus_rank)
    SELECT 
        ir.player_id,
        ir.format,
        ir.dynasty_type,
        AVG(ir.rank_position) as average_rank,
        COUNT(ir.rank_position) as rank_count,
        ROW_NUMBER() OVER (ORDER BY AVG(ir.rank_position)) as consensus_rank
    FROM individual_rankings ir
    WHERE ir.format = p_format
    AND (ir.dynasty_type = p_dynasty_type OR (ir.dynasty_type IS NULL AND p_dynasty_type IS NULL))
    GROUP BY ir.player_id, ir.format, ir.dynasty_type;
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SAMPLE DATA INSERTION
-- =============================================================================
-- Basic sample data for testing (comment out in production)

-- Insert sample users
INSERT INTO users (username, email) VALUES 
('john_doe', 'john@example.com'),
('jane_smith', 'jane@example.com'),
('mike_jones', 'mike@example.com');

-- Insert sample players
INSERT INTO players (name, position, team) VALUES 
('Josh Allen', 'QB', 'BUF'),
('Lamar Jackson', 'QB', 'BAL'),
('Christian McCaffrey', 'RB', 'SF'),
('Tyreek Hill', 'WR', 'MIA'),
('Travis Kelce', 'TE', 'KC'),
('Cooper Kupp', 'WR', 'LAR'),
('Derrick Henry', 'RB', 'BAL'),
('Davante Adams', 'WR', 'LV');

-- =============================================================================
-- COMMENTS AND EXPLANATIONS
-- =============================================================================

/*
DESIGN DECISIONS EXPLAINED:

1. SIMPLE STRUCTURE: 
   - Four main tables with clear relationships
   - No complex joins or nested queries required
   - Each table has a single, focused purpose

2. CONSENSUS CALCULATION:
   - Uses simple averages (AVG function)
   - ROW_NUMBER() for final ranking order
   - Separate table for performance (no real-time calculation)

3. DYNASTY FORMAT HANDLING:
   - Optional dynasty_type field allows 'rebuilder' or 'contender'
   - Redraft format leaves dynasty_type as NULL
   - Separate consensus calculated for each dynasty type

4. DATA INTEGRITY:
   - Foreign key constraints ensure referential integrity
   - Check constraints validate business rules
   - Unique constraints prevent duplicate rankings

5. PERFORMANCE:
   - Strategic indexes on common query patterns
   - Separate consensus table avoids expensive real-time calculations
   - Audit log keeps history without slowing main queries

6. TRANSPARENCY:
   - All calculations are simple averages
   - Full audit trail of submissions
   - Clear separation of individual vs consensus data

7. SCALABILITY:
   - Serial primary keys for efficient inserts
   - Indexed foreign keys for fast joins
   - Batch consensus updates via stored function
*/