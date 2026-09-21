# Local stack

A Minecraft server with the two plugins the API reads, so the site can be
tested against live data.

The API talks to **ServerTap** for what is true now, and to **PLAN** for what
happened before. Neither answers anything until a real server runs. This
directory starts one.

## Start

```sh
./dev/up.sh
```

The first start downloads Paper and both plugins, and takes about a minute.
`dev/data/` holds the world and is gitignored.

Then start the three processes the site needs:

```sh
node dev/legacy-api.mjs &            # port 8091
npm --prefix backend run dev &       # port 8090
npm --prefix frontend start -- --port 4300
```

Open http://localhost:4300 and join `localhost` in the game.

## Ports

| Port  | What         | Reachable from |
| ----- | ------------ | -------------- |
| 25565 | Java edition | anywhere       |
| 4567  | ServerTap    | this machine   |
| 8804  | PLAN         | this machine   |
| 8091  | legacy API   | this machine   |
| 8090  | API          | this machine   |
| 4300  | dev server   | this machine   |

The ServerTap key also authorizes console commands. That port stays on
loopback. Only the game port is open.

The API and the dev server use 8090 and 4300, not the 8080 and 4200 in
`.env.example`. Another project holds the usual two on this machine. Change
`backend/.env` and `frontend/.env` together if you move them.

## The legacy stand-in

The site reads the server status and the server icon from an older service at
`/api/minecraft`. That service is not in this repository, and it answers for
the real server.

`legacy-api.mjs` answers the same two paths for the local server. It reads the
server the way a game client does, with a server list ping. The description
tree, the player sample, the icon and the latency are all real.

The icon comes from the ping. If the server sends none, the stand-in answers
404, and the site falls back to its own asset.

## Versions

ServerTap 0.6.1 is the newest release, and it dates from 2023. It is built
against the 1.20 API, so the stack pins Paper 1.20.4. PLAN 5.8 build 3579 is
the release the adapters were read against.

To try another release:

```sh
MC_VERSION=1.21.4 ./dev/up.sh
```

Check the log afterwards. A plugin that fails to load leaves the API with an
upstream that never answers.

## Joining

The server runs in online mode, so it keeps the real account UUIDs. Both
plugins key their records on those.

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
