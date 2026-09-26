-- Preserve existing Steam-based records while allowing the current form without a link.
CREATE TABLE challengers_next (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    steam_nick TEXT NOT NULL,
    steam_link TEXT,
    description TEXT NOT NULL DEFAULT '',
    mmr INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO challengers_next (id, steam_nick, steam_link, mmr, created_at)
SELECT id, steam_nick, steam_link, mmr, created_at FROM challengers;

DROP TABLE challengers;
ALTER TABLE challengers_next RENAME TO challengers;
CREATE INDEX IF NOT EXISTS idx_challengers_created_at ON challengers(created_at);
