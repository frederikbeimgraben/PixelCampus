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

        # Serves the built site the way the production nginx does, so the SPA
        # fallback can be exercised locally.
        preview = pkgs.writeShellApplication {
          name = "pixelcampus-preview";
          runtimeInputs = [ pkgs.static-web-server ];
          text = ''
            echo "Serving ${frontendPkg} on http://localhost:''${PORT:-8000}"
            static-web-server \
              --root ${frontendPkg} \
              --port "''${PORT:-8000}" \
              --page-fallback ${frontendPkg}/index.html
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
            echo "  shared/    API contract    (npm run build --workspace=shared)"
            echo "  frontend/  Angular app     (npm start --workspace=frontend)"
            echo "  backend/   API             (npm run dev --workspace=backend)"
            echo ""
            echo "  nix run .#preview    serve the built site"
            echo "  nix run .#backend    run the built API"
            echo "  nix flake check      build both halves"
          '';
        };
      }
    )
    // {
      nixosModules = rec {
        default = backend;

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

                environment.PORT = toString cfg.port;

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
      };

      overlays.default = final: _prev: {
        pixelcampus-frontend = self.packages.${final.stdenv.hostPlatform.system}.frontend;
        pixelcampus-api = self.packages.${final.stdenv.hostPlatform.system}.backend;
      };
    };
}
