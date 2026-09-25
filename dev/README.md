# Local stack

A Minecraft server with the plugin the API reads, so the site can be tested
against live data.

The API reads the server itself with a **server list ping**, the way a game
client does, and talks to **PLAN** for what happened before. Neither answers
anything until a real server runs. This directory starts one.

## Start

```sh
./dev/up.sh
```

The first start downloads Paper and PLAN, and takes about a minute.
`dev/data/` holds the world and is gitignored.

Then start the two processes the site needs:

```sh
npm --prefix backend run dev &       # port 8090
npm --prefix frontend start -- --port 4300
```

Open http://localhost:4300 and join `localhost` in the game.

## Ports

| Port  | What         | Reachable from |
| ----- | ------------ | -------------- |
| 25565 | Java edition | anywhere       |
| 8804  | PLAN         | this machine   |
| 8090  | API          | this machine   |
| 4300  | dev server   | this machine   |

Only the game port is open. The API pings that same port for the server
status and the server icon, so it needs no port of its own on the server.

The API and the dev server use 8090 and 4300, not the 8080 and 4200 in
`.env.example`. Another project holds the usual two on this machine. Change
`backend/.env` and `frontend/.env` together if you move them.

## The server banner

The banner reads `/api/v1/server` and `/api/v1/server/icon.png` from the API.
Both come from the same server list ping, so the description tree, the player
sample, the icon and the latency are all real.

If the server sends no icon, the API answers 404, and the site falls back to
its own asset.

## Versions

No plugin holds the version back any more. ServerTap did: its newest release is
built against the 1.20 API. The site now reads the server with a ping, which
every version answers.

The default stays at Paper 1.20.4 because that is where the world in
`dev/data/` was made, and a newer server upgrades a world and cannot undo it.
Copy `dev/data/` first, then:

```sh
MC_VERSION=1.21.4 ./dev/up.sh
```

PLAN 5.8 build 3579 is the release the adapter was read against. Check the log
afterwards. A plugin that fails to load leaves the API with an upstream that
never answers.

## Joining

The server runs in online mode, so it keeps the real account UUIDs. PLAN keys
its records on those, and the skin renders are looked up by them.

To join with any name, and without an account:

```sh
MC_ONLINE_MODE=FALSE ./dev/up.sh
```

To give yourself operator rights, set `MC_OPS` to your name.

## Stop

```sh
docker compose -f dev/docker-compose.yml down
```

Add `-v` to drop the world as well. `rm -rf dev/data` does the same.
