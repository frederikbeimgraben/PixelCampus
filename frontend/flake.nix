{
  description = "PixelCampus front end: Angular single-page app";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        nodejs = pkgs.nodejs_24;
      in
      {
        packages = rec {
          default = pixelcampus-frontend;

          # The built site: a directory of static files for any web server.
          pixelcampus-frontend = pkgs.buildNpmPackage {
            pname = "pixelcampus-frontend";
            version = "1.0.0";
            src = ./.;

            inherit nodejs;
            npmDepsHash = "sha256-sL1xKsRU56HQI49/qiQoHl+XfLd5ZtB5booeO7rUIyA=";

            # sharp only backs the texture refresh script, and playwright only
            # the end-to-end tests; neither is needed to build the site, and
            # both want to fetch binaries the sandbox forbids.
            npmFlags = [ "--ignore-scripts" ];

            # --ignore-scripts also suppresses the prebuild hook that writes
            # env.generated.ts, so it is generated here instead. Values come
            # from the defaults in the script unless PC_* variables are set.
            preBuild = ''
              node scripts/generate-env.mjs
            '';

            installPhase = ''
              runHook preInstall
              cp -r dist/PixelCampus/browser $out
              runHook postInstall
            '';
          };
        };

        devShells.default = pkgs.mkShell {
          packages = [
            nodejs
            pkgs.playwright-driver.browsers
          ];

          # NixOS cannot run the browsers Playwright downloads, so point it at
          # the ones nixpkgs builds. Keep @playwright/test in package.json on
          # the version below or the driver refuses to start them.
          env = {
            PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
            PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
          };

          shellHook = ''
            echo "PixelCampus front end - playwright ${pkgs.playwright-driver.version}"
          '';
        };
      }
    );
}
