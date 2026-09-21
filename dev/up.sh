#!/usr/bin/env bash
# Starts the local Minecraft server with PLAN.
set -euo pipefail

cd "$(dirname "$0")"

docker compose up -d

echo
echo "Java edition:  localhost:25565"
echo "PLAN:          http://127.0.0.1:8804"
echo
echo "docker compose -f dev/docker-compose.yml logs -f mc"
