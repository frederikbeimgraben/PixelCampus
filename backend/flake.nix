{
  description = "PixelCampus API: read-only service fronting PLAN and ServerTap";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        nodejs = pkgs.nodejs_24;
      in
      {
        packages = rec {
          default = pixelcampus-api;

          pixelcampus-api = pkgs.buildNpmPackage {
            pname = "pixelcampus-api";
            version = "1.0.0";
            src = ./.;

            inherit nodejs;
            npmDepsHash = "sha256-f/doChUNaG/ymWT7D4RAE0soBjPtiRh2LbJHSvsSzK8=";

            npmBuildScript = "build";

            # dist/ plus the runtime dependencies; a wrapper puts node on PATH.
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
        };

        apps.default = {
          type = "app";
          program = "${self.packages.${system}.pixelcampus-api}/bin/pixelcampus-api";
        };

        devShells.default = pkgs.mkShell {
          packages = [
            nodejs
          ];

          shellHook = ''
            echo "PixelCampus API - node ${nodejs.version}"
            [ -f .env ] || echo "no .env yet; cp .env.example .env"
          '';
        };
      }
    )
    // {
      # Runs the API as a systemd service. Credentials come from an
      # environment file outside the store, so they never reach /nix/store,
      # which is world readable.
      nixosModules.default =
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
              default = self.packages.${pkgs.stdenv.hostPlatform.system}.pixelcampus-api;
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
}
