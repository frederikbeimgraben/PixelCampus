{
  description = "PixelCampus: Minecraft server website and API";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        nodejs = pkgs.nodejs_24;

        /*
          Each package keeps its own lock file and is built from its own
          directory, with the whole repository as the source so that shared/ is
          reachable: the contract is compiled from source by both halves rather
          than installed as a package.

          npm workspaces were tried first and abandoned. npm 11 writes workspace
          lock entries with neither a resolved URL nor an integrity hash, and
          the Nix fetcher can use neither.
        */

        backendPkg = pkgs.buildNpmPackage {
          pname = "pixelcampus-api";
          version = "1.0.0";
          src = ./.;

          inherit nodejs;
          # Fetched from the package directory; sourceRoot would otherwise be
          # applied to the deps derivation too, where that path does not exist.
          npmDeps = pkgs.fetchNpmDeps {
            src = ./backend;
            hash = "sha256-Vqxc5k4DXddip2HRh0TQInuLQwmP+YK+f53W2pu6xLU=";
          };
          # The unpacked directory name is not fixed, so find it rather than assume it.
          setSourceRoot = "sourceRoot=$(echo */backend)";

          preBuild = ''
            node ../scripts/sync-contract.mjs backend
          '';

          installPhase = ''
            runHook preInstall

            mkdir -p $out/lib/pixelcampus-api
            cp -r dist package.json $out/lib/pixelcampus-api/
            cp -r node_modules $out/lib/pixelcampus-api/node_modules

            mkdir -p $out/bin
            makeWrapper ${nodejs}/bin/node $out/bin/pixelcampus-api \
              --add-flags $out/lib/pixelcampus-api/dist/server.js

            runHook postInstall
          '';

          nativeBuildInputs = [ pkgs.makeWrapper ];
        };

        frontendPkg = pkgs.buildNpmPackage {
          pname = "pixelcampus-frontend";
          version = "1.0.0";
          src = ./.;

          inherit nodejs;
          npmDeps = pkgs.fetchNpmDeps {
            src = ./frontend;
            hash = "sha256-SBg5GI74/JPEIeRhxssQHs5VlCea2wW4/EsgjaaJ+04=";
          };
          setSourceRoot = "sourceRoot=$(echo */frontend)";

          # sharp backs the texture script and playwright the end-to-end tests;
          # neither is needed to build the site, and both want to fetch binaries
          # the sandbox forbids.
          npmFlags = [ "--ignore-scripts" ];

          preBuild = ''
            # --ignore-scripts also suppresses the prebuild hook, which copies
            # the contract in and writes env.generated.ts.
            node ../scripts/sync-contract.mjs frontend
            node scripts/generate-env.mjs
          '';

          installPhase = ''
            runHook preInstall
            cp -r dist/PixelCampus/browser $out
            runHook postInstall
          '';
        };

        /*
          Local preview, running the same nginx config as production so the
          headers, the caching rules, the single-page fallback and the /api
          proxy are all exercised rather than approximated. The placeholders are
          substituted at start-up because nginx reads no environment.
        */
        previewConf = pkgs.writeText "pixelcampus-preview.conf" ''
          daemon off;
          error_log stderr info;
          pid @dir@/nginx.pid;
          events { }

          http {
            include ${pkgs.nginx}/conf/mime.types;
            access_log /dev/stdout;

            client_body_temp_path @dir@/body;
            proxy_temp_path @dir@/proxy;
            fastcgi_temp_path @dir@/fastcgi;
            uwsgi_temp_path @dir@/uwsgi;
            scgi_temp_path @dir@/scgi;

            server {
              listen @port@;
              root ${frontendPkg};

              ${builtins.readFile ./frontend/deploy/nginx-site.conf}

              location ^~ /api/v1/ {
                proxy_pass @api@;
                proxy_set_header Host $host;
              }

              location ^~ /api/minecraft/ {
                proxy_pass @legacy@;
                proxy_set_header Host @legacyHost@;
                # Without SNI a shared host answers with the wrong certificate.
                proxy_ssl_server_name on;
              }
            }
          }
        '';

        preview = pkgs.writeShellApplication {
          name = "pixelcampus-preview";
          runtimeInputs = [
            pkgs.nginx
            pkgs.gnused
          ];
          text = ''
            port=''${PORT:-8000}
            api=''${API_URL:-http://127.0.0.1:8080}
            legacy=''${LEGACY_API_URL:-https://api.pixelcampus.space}

            # The old API is a virtual host on a shared server, so it needs its
            # own name in the Host header rather than the one asked for here.
            legacy_host=''${legacy#*://}
            legacy_host=''${legacy_host%%/*}

            dir=$(mktemp -d)
            trap 'rm -rf "$dir"' EXIT

            sed \
              -e "s|@dir@|$dir|g" \
              -e "s|@port@|$port|g" \
              -e "s|@api@|$api|g" \
              -e "s|@legacy@|$legacy|g" \
              -e "s|@legacyHost@|$legacy_host|g" \
              ${previewConf} > "$dir/nginx.conf"

            echo "Serving ${frontendPkg} on http://localhost:$port (API at $api)"
            exec nginx -c "$dir/nginx.conf" -p "$dir" -e stderr
          '';
        };

        stack = pkgs.writeShellApplication {
          name = "pixelcampus-stack";
          runtimeInputs = [
            backendPkg
            preview
          ];
          text = ''
            pixelcampus-api &
            api=$!
            trap 'kill $api 2>/dev/null || true' EXIT
            PORT=''${PORT:-8000} pixelcampus-preview
          '';
        };
      in
      {
        packages = {
          default = frontendPkg;
          frontend = frontendPkg;
          backend = backendPkg;
          inherit preview stack;
        };

        apps = {
          default = {
            type = "app";
            program = "${stack}/bin/pixelcampus-stack";
          };
          preview = {
            type = "app";
            program = "${preview}/bin/pixelcampus-preview";
          };
          backend = {
            type = "app";
            program = "${backendPkg}/bin/pixelcampus-api";
          };
        };

        # `nix flake check` builds both halves.
        checks = {
          inherit frontendPkg backendPkg;
        };

        devShells.default = pkgs.mkShell {
          packages = [
            nodejs
            pkgs.playwright-driver.browsers
            pkgs.jq
          ];

          env = {
            # NixOS cannot run the browsers Playwright downloads.
            PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
            PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
          };

          shellHook = ''
            echo "PixelCampus monorepo"
            echo "  shared/    API contract    (npm --prefix shared run build)"
            echo "  frontend/  Angular app     (npm --prefix frontend start)"
            echo "  backend/   API             (npm --prefix backend run dev)"
            echo ""
            echo "  nix run .#preview    serve the built site behind nginx"
            echo "  nix run .#backend    run the built API"
            echo "  nix flake check      build both halves"
          '';
        };
      }
    )
    // {
      nixosModules = rec {
        default = {
          imports = [
            backend
            web
          ];
        };

        # Runs the API as a systemd service. Credentials come from an
        # environment file outside the store, so they never reach /nix/store,
        # which is world readable.
        backend =
          {
            config,
            lib,
            pkgs,
            ...
          }:
          let
            cfg = config.services.pixelcampus-api;
          in
          {
            options.services.pixelcampus-api = {
              enable = lib.mkEnableOption "the PixelCampus API";

              package = lib.mkOption {
                type = lib.types.package;
                default = self.packages.${pkgs.stdenv.hostPlatform.system}.backend;
                description = "Package to run.";
              };

              port = lib.mkOption {
                type = lib.types.port;
                default = 8080;
                description = "Port to listen on.";
              };

              host = lib.mkOption {
                type = lib.types.str;
                default = "127.0.0.1";
                description = ''
                  Address to bind. Loopback by default: nginx proxies the API at
                  /api/v1, so it needs no address of its own.
                '';
              };

              environmentFile = lib.mkOption {
                type = lib.types.nullOr lib.types.path;
                default = null;
                example = "/run/secrets/pixelcampus-api.env";
                description = ''
                  File holding SERVERTAP_KEY, PLAN_PASSWORD and the other
                  settings from .env.example. Keep it out of the Nix store.
                '';
              };
            };

            config = lib.mkIf cfg.enable {
              systemd.services.pixelcampus-api = {
                description = "PixelCampus API";
                wantedBy = [ "multi-user.target" ];
                after = [ "network-online.target" ];
                wants = [ "network-online.target" ];

                environment = {
                  PORT = toString cfg.port;
                  HOST = cfg.host;
                };

                serviceConfig = {
                  ExecStart = "${cfg.package}/bin/pixelcampus-api";
                  EnvironmentFile = lib.mkIf (cfg.environmentFile != null) cfg.environmentFile;
                  Restart = "on-failure";
                  RestartSec = "5s";

                  DynamicUser = true;
                  # The service reads two HTTP upstreams and writes nothing.
                  ProtectSystem = "strict";
                  ProtectHome = true;
                  PrivateTmp = true;
                  PrivateDevices = true;
                  NoNewPrivileges = true;
                  RestrictAddressFamilies = [
                    "AF_INET"
                    "AF_INET6"
                  ];
                  MemoryDenyWriteExecute = false; # V8 needs writable+executable pages.
                  SystemCallFilter = [ "@system-service" ];
                };
              };
            };
          };

        # Serves the built site and puts both APIs under /api on the same
        # origin. Nothing the browser fetches is cross-origin, so the policy in
        # deploy/nginx-site.conf needs no third-party host and the API needs no
        # CORS exception.
        web =
          {
            config,
            lib,
            pkgs,
            ...
          }:
          let
            cfg = config.services.pixelcampus-web;

            # Host and port of a URL, for the proxied Host header.
            legacyHost =
              url: lib.head (lib.splitString "/" (lib.last (lib.splitString "://" url)));
          in
          {
            options.services.pixelcampus-web = {
              enable = lib.mkEnableOption "the PixelCampus web front end";

              package = lib.mkOption {
                type = lib.types.package;
                default = self.packages.${pkgs.stdenv.hostPlatform.system}.frontend;
                description = "Built site to serve.";
              };

              domain = lib.mkOption {
                type = lib.types.str;
                default = "pixelcampus.space";
                description = "Host name of the virtual host.";
              };

              apiPort = lib.mkOption {
                type = lib.types.port;
                default = 8080;
                description = ''
                  Port pixelcampus-api listens on, proxied at /api/v1. Keep equal
                  to services.pixelcampus-api.port.
                '';
              };

              legacyApiUrl = lib.mkOption {
                type = lib.types.nullOr lib.types.str;
                default = "https://api.pixelcampus.space";
                description = ''
                  Upstream of the old API that still serves the server status and
                  icon, proxied at /api/minecraft. Null drops that location.
                '';
              };

              useACME = lib.mkOption {
                type = lib.types.bool;
                default = true;
                description = "Get a certificate from Let's Encrypt and redirect to HTTPS.";
              };
            };

            config = lib.mkIf cfg.enable {
              services.nginx = {
                enable = true;
                recommendedGzipSettings = true;
                recommendedOptimisation = true;
                recommendedProxySettings = true;
                recommendedTlsSettings = true;

                virtualHosts.${cfg.domain} = {
                  root = cfg.package;
                  enableACME = cfg.useACME;
                  forceSSL = cfg.useACME;

                  # Headers, caching and the single-page fallback, shared with
                  # deployments that are not built from this flake.
                  extraConfig = builtins.readFile ./frontend/deploy/nginx-site.conf;

                  # ^~ so the caching regex in that file does not claim
                  # /api/minecraft/icon.png and serve it from the site root.
                  locations = {
                    "^~ /api/v1/".proxyPass = "http://127.0.0.1:${toString cfg.apiPort}";
                  }
                  // lib.optionalAttrs (cfg.legacyApiUrl != null) {
                    "^~ /api/minecraft/" = {
                      proxyPass = cfg.legacyApiUrl;
                      # The old API is a virtual host on a shared server: it
                      # needs its own name in the Host header, and SNI, or it
                      # answers with someone else's site and certificate.
                      extraConfig = ''
                        proxy_set_header Host ${legacyHost cfg.legacyApiUrl};
                        proxy_ssl_server_name on;
                      '';
                    };
                  };
                };
              };
            };
          };
      };

      overlays.default = final: _prev: {
        pixelcampus-frontend = self.packages.${final.stdenv.hostPlatform.system}.frontend;
        pixelcampus-api = self.packages.${final.stdenv.hostPlatform.system}.backend;
      };
    };
}
