#!/bin/bash
# Launch Weave applet development with a configurable number of agents.
# Usage: AGENTS=3 ./weave/applet-dev.sh

AGENTS=${AGENTS:-2}

if [ "$AGENTS" -lt 1 ] || [ "$AGENTS" -gt 10 ]; then
  echo "Error: AGENTS must be between 1 and 10"
  exit 1
fi

cmds=("UI_PORT=8888 bun run --filter ui start")
cmds+=("weave --agent-idx 1 --dev-config ./weave/weave.dev.config.json")

for i in $(seq 2 "$AGENTS"); do
  delay=$((5 * (i - 1)))
  cmds+=("sleep $delay && weave --agent-idx $i --dev-config ./weave/weave.dev.config.json --sync-time 20000")
done

concurrently "${cmds[@]}"
