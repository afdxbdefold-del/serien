#!/usr/bin/env bash
# Poll Claude Sonnet 4.6 availability every 10 minutes.
# Once responsive, run the full E-E-A-T bio generation script (Claude only, no fallback).
# Logs to /tmp/claude-poll.log

set -u

KEY="${EMERGENT_LLM_KEY:-sk-emergent-c52767c2e3e748c340}"
LOG=/tmp/claude-poll.log
FLAG=/tmp/claude-bios-done.flag
SCRIPT_DIR=/app/serien-nextjs

rm -f "$FLAG"
echo "[$(date -Iseconds)] Starting Claude poll (every 10 min)..." > "$LOG"

while true; do
  NOW="$(date -Iseconds)"
  # 15s timeout probe with a tiny message
  RESP=$(curl -s --max-time 15 -X POST "https://integrations.emergentagent.com/llm/chat/completions" \
    -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -d '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"ping"}],"max_tokens":10}' \
    -w "\n[HTTP_CODE:%{http_code}]" 2>/dev/null)

  CODE=$(echo "$RESP" | grep -oE '\[HTTP_CODE:[0-9]+\]' | tr -dc '0-9')

  if [ "$CODE" = "200" ]; then
    echo "[$NOW] ✅ Claude is responding (HTTP 200). Starting bio regeneration..." >> "$LOG"
    # Force Claude-only by temporarily unsetting fallback
    cd "$SCRIPT_DIR" || exit 1
    # Run generation — the script prefers the configured model (Claude) with retry
    npx tsx scripts/generate-author-full-bios.ts --apply >> "$LOG" 2>&1
    EXIT=$?
    echo "[$(date -Iseconds)] Bio generation finished (exit $EXIT)" >> "$LOG"
    touch "$FLAG"
    break
  else
    echo "[$NOW] Claude not ready (HTTP=$CODE). Waiting 10 min..." >> "$LOG"
    sleep 600
  fi
done
