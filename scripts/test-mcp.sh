#!/bin/bash

API_KEY="orqknR2aa2PcJXYWOBp6B8aGsC1QbaId"
BASE_URL="https://preview.streamlist-40n.pages.dev/api/mcp"

call_tool() {
  local name="$1"
  local args="$2"
  echo "Testing: $name"
  response=$(curl -s -H "x-api-key: $API_KEY" -X POST "$BASE_URL" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$args},\"id\":1}")
  
  # Check for errors
  if echo "$response" | grep -q '"error"'; then
    echo "  ERROR: $(echo "$response" | grep -o '"message":"[^"]*"' | head -1)"
  else
    echo "  OK"
  fi
  echo ""
}

echo "=== StreamList MCP Tool Tests ==="
echo ""

# Watchlist
call_tool "get_watchlist" "{}"
call_tool "add_to_watchlist" "{\"tmdb_id\": 550, \"media_type\": \"movie\"}"
call_tool "remove_from_watchlist" "{\"tmdb_id\": 550}"

# Preferences
call_tool "get_preferences" "{}"
call_tool "update_streaming_services" "{\"services\": [{\"id\": \"8\", \"name\": \"Netflix\"}, {\"id\": \"119\", \"name\": \"Amazon\"}]}"
call_tool "update_genres" "{\"genres\": [28, 12, 35]}"
call_tool "update_country" "{\"countries\": [\"US\", \"GB\"]}"

# Likes
call_tool "add_like" "{\"tmdb_id\": 550, \"media_type\": \"movie\", \"title\": \"Fight Club\"}"
call_tool "remove_like" "{\"tmdb_id\": 550}"

# Watch History
call_tool "get_watch_history" "{}"
call_tool "mark_as_watched" "{\"tmdb_id\": 550, \"media_type\": \"movie\", \"title\": \"Fight Club\"}"
call_tool "remove_from_watch_history" "{\"tmdb_id\": 550}"

# Discovery
call_tool "search_media" "{\"query\": \"Inception\"}"
call_tool "get_media_details" "{\"tmdb_id\": 550, \"media_type\": \"movie\"}"
call_tool "get_trending" "{\"media_type\": \"movie\"}"
call_tool "get_recommendations" "{}"
call_tool "get_watch_providers" "{\"tmdb_id\": 550, \"media_type\": \"movie\"}"

# Groups
call_tool "list_groups" "{}"
call_tool "create_group" "{\"name\": \"Test Group\"}"
call_tool "get_group_watchlist" "{\"group_id\": \"T5ECP56vQP3i3He4\"}"
call_tool "create_group_invite" "{\"group_id\": \"T5ECP56vQP3i3He4\"}"
call_tool "join_group" "{\"token\": \"invalid_token_123\"}"
call_tool "get_group_invites" "{\"group_id\": \"T5ECP56vQP3i3He4\"}"

# Polls
call_tool "create_poll" "{\"group_id\": \"T5ECP56vQP3i3He4\", \"candidates\": [{\"tmdb_id\": 550, \"media_type\": \"movie\", \"title\": \"Fight Club\"}]}"
call_tool "list_group_polls" "{\"group_id\": \"T5ECP56vQP3i3He4\"}"

# Access Codes
call_tool "verify_access_code" "{\"code\": \"TEST123\"}"

echo "=== Tests Complete ==="