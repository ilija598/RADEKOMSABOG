-- Old answers were never collected by the API: retain NULL, never invent a vote.
-- The API requires all three answers for every new submission.
ALTER TABLE challengers DROP COLUMN steam_link;
ALTER TABLE challengers ADD COLUMN immortal_worthy TEXT CHECK (immortal_worthy IN ('da', 'ne'));
ALTER TABLE challengers ADD COLUMN believes_rade_mortal TEXT CHECK (believes_rade_mortal IN ('da', 'ne'));
ALTER TABLE challengers ADD COLUMN better_than_rade TEXT CHECK (better_than_rade IN ('da', 'ne'));
