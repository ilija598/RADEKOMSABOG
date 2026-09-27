-- Old applications have no verified SteamID; keep their data intact.
ALTER TABLE challengers ADD COLUMN steam_id TEXT;
CREATE INDEX IF NOT EXISTS idx_challengers_steam_id ON challengers(steam_id);
