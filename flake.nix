{
  description = "PixelCampus: Minecraft server website and API";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";

    frontend = {
      url = "path:./frontend";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.flake-utils.follows = "flake-utils";
    };

    backend = {
      url = "path:./backend";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.flake-utils.follows = "flake-utils";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      frontend,
      backend,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        nodejs = pkgs.nodejs_24;

        frontendPkg = frontend.packages.${system}.pixelcampus-frontend;
        backendPkg = backend.packages.${system}.pixelcampus-api;

        # Serves the built site the way the production nginx does, so the SPA
        # fallback and the security headers can be exercised locally.
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

        # Both halves at once, for working on a change that crosses them.
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
            echo "  frontend/  Angular app     (cd frontend && npm start)"
            echo "  backend/   API             (cd backend  && npm run dev)"
            echo ""
            echo "  nix run .#preview    serve the built site"
            echo "  nix run .#backend    run the built API"
            echo "  nix flake check      build both halves"
          '';
        };
      }
    )
    // {
      nixosModules = {
        default = backend.nixosModules.default;
        backend = backend.nixosModules.default;
      };

      overlays.default = final: _prev: {
        pixelcampus-frontend = self.packages.${final.stdenv.hostPlatform.system}.frontend;
        pixelcampus-api = self.packages.${final.stdenv.hostPlatform.system}.backend;
      };
    };
}
