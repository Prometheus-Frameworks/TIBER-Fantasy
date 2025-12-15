ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS season integer;

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS scoring_format text;
