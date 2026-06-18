// Migration script: Create Default watchlists and migrate existing data
// Usage: wrangler d1 execute streamlist-preview-db --remote --command="$(cat scripts/migrate-watchlists.js)"
// Or pipe via: cat scripts/migrate-watchlists.js | npx wrangler d1 execute streamlist-preview-db --remote

// This script is written as raw SQL for D1, and handles the transition
// from the flat `watchlist` table to the `watchlists` + `watchlist_items` structure.

-- Step 1: Create a Default watchlist for every user who has items in watchlist
INSERT OR IGNORE INTO watchlists (id, user_id, name, created_at)
SELECT
  'default_' || user_id as id,
  user_id,
  'Default',
  MIN(added_at) as created_at
FROM watchlist
GROUP BY user_id;

-- Step 2: Copy existing watchlist items to watchlist_items
INSERT OR IGNORE INTO watchlist_items (list_id, tmdb_id, media_type, added_at)
SELECT
  'default_' || w.user_id as list_id,
  w.tmdb_id,
  w.media_type,
  w.added_at
FROM watchlist w;

-- Step 3: Create Default lists for users who have NO items yet (so Default always exists)
INSERT OR IGNORE INTO watchlists (id, user_id, name, created_at)
SELECT
  'default_' || u.id as id,
  u.id,
  'Default',
  CURRENT_TIMESTAMP
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM watchlists wl WHERE wl.user_id = u.id
);
