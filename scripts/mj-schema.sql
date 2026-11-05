-- Schema for /mj. Run once in the Neon SQL editor (safe to re-run).

CREATE TABLE IF NOT EXISTS players (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Case-insensitive, so "shane" and "Shane" can't both exist.
CREATE UNIQUE INDEX IF NOT EXISTS players_name_key ON players (lower(name));

-- Zha hu (false win) tally, adjusted one at a time by the admin.
ALTER TABLE players ADD COLUMN IF NOT EXISTS zha_hu int NOT NULL DEFAULT 0 CHECK (zha_hu >= 0);

CREATE TABLE IF NOT EXISTS sessions (
  id         serial PRIMARY KEY,
  played_on  date NOT NULL,
  notes      text,
  -- False only when saved with "save anyway" while the nets didn't sum to 0.
  balanced   boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The "where" field was removed; drops it from databases created before that.
ALTER TABLE sessions DROP COLUMN IF EXISTS location;

-- Extra names a player can be entered under, e.g. "sb" for "Shane". Unique
-- case-insensitively; the app also stops an alias matching another player's name.
CREATE TABLE IF NOT EXISTS player_aliases (
  player_id int NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  alias     text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS player_aliases_alias_key ON player_aliases (lower(alias));

CREATE TABLE IF NOT EXISTS results (
  session_id int NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  player_id  int NOT NULL REFERENCES players (id),
  -- Integer cents: +1240 is +$12.40.
  net_cents  int NOT NULL,
  PRIMARY KEY (session_id, player_id)
);
CREATE INDEX IF NOT EXISTS results_player_idx ON results (player_id);
