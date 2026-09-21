#!/usr/bin/env bash
# Starts the local Minecraft server with ServerTap and PLAN.
#
# ServerTap reads its configuration once, when it first starts, and writes the
# defaults if the file is absent. Put the template in place before that.
set -euo pipefail

cd "$(dirname "$0")"

config=data/plugins/ServerTap/config.yml
if [ ! -f "$config" ]; then
  mkdir -p "$(dirname "$config")"
  cp servertap-config.yml "$config"
  echo "installed $config"
fi

docker compose up -d

echo
echo "Java edition:  localhost:25565"
echo "ServerTap:     http://127.0.0.1:4567/v1/server"
echo "PLAN:          http://127.0.0.1:8804"
echo
echo "docker compose -f dev/docker-compose.yml logs -f mc"
