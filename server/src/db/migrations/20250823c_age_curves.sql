CREATE TABLE IF NOT EXISTS age_curves (
  position TEXT NOT NULL CHECK (position IN ('QB','RB','WR','TE')),
  age SMALLINT NOT NULL,
  multiplier NUMERIC NOT NULL,   -- e.g. 1.05 peak, 0.92 decline
  PRIMARY KEY (position, age)
);

-- RB rough curve (example — tweak later)
INSERT INTO age_curves(position, age, multiplier) VALUES
('RB',21,0.96),('RB',22,1.02),('RB',23,1.05),('RB',24,1.06),('RB',25,1.05),
('RB',26,1.02),('RB',27,0.98),('RB',28,0.95),('RB',29,0.92),('RB',30,0.88)
ON CONFLICT DO NOTHING;

-- WR
INSERT INTO age_curves(position, age, multiplier) VALUES
('WR',21,0.92),('WR',22,0.96),('WR',23,1.00),('WR',24,1.04),('WR',25,1.06),
('WR',26,1.06),('WR',27,1.05),('WR',28,1.02),('WR',29,0.98),('WR',30,0.94)
ON CONFLICT DO NOTHING;

-- TE (later peak)
INSERT INTO age_curves(position, age, multiplier) VALUES
('TE',22,0.92),('TE',23,0.95),('TE',24,0.98),('TE',25,1.02),('TE',26,1.05),
('TE',27,1.06),('TE',28,1.06),('TE',29,1.04),('TE',30,1.00),('TE',31,0.96)
ON CONFLICT DO NOTHING;

-- QB (long tail)
INSERT INTO age_curves(position, age, multiplier) VALUES
('QB',22,0.92),('QB',23,0.95),('QB',24,0.98),('QB',25,1.02),('QB',26,1.04),
('QB',27,1.05),('QB',28,1.05),('QB',29,1.05),('QB',30,1.04),('QB',31,1.02),
('QB',32,1.00),('QB',33,0.98),('QB',34,0.96),('QB',35,0.94)
ON CONFLICT DO NOTHING;