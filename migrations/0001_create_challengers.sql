CREATE TABLE IF NOT EXISTS challengers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    steam_nick TEXT NOT NULL,
    steam_link TEXT NOT NULL,
    mmr INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_challengers_created_at
ON challengers(created_at);
