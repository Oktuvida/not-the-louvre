{ pkgs, lib, config, ... }:

let
  projectRoot = config.devenv.root;
in {
  name = "not-the-louvre";

  packages = [
    pkgs.curl
    pkgs.docker
    pkgs.git
    pkgs.wget
  ];

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
    bun.enable = true;
    bun.package = pkgs.bun;
  };

  languages.rust = {
    enable = true;
    toolchainFile = ./rust-toolchain.toml;
  };

  enterShell = ''
    echo "devenv ready for not-the-louvre"
    echo "Use 'devenv up' for the app + local Supabase stack."
    echo "Use 'devenv tasks run ntl:check' for the root typecheck pipeline."

    if ! docker info >/dev/null 2>&1; then
      echo "Docker Engine is not running or not reachable."
      echo "Start Docker on the host before using 'devenv up' or 'devenv tasks run ntl:db-start'."
    fi
  '';

  enterTest = ''
    command -v bun >/dev/null
    command -v node >/dev/null
    command -v cargo >/dev/null
    command -v rustc >/dev/null
    command -v docker >/dev/null
    command -v git >/dev/null
    command -v curl >/dev/null
    command -v wget >/dev/null

    node --version | grep '^v22\.'
    rustc --version | grep '1.94.1'
  '';

  scripts = {
    "ntl:dev".exec = "exec devenv tasks run ntl:dev";
    "ntl:format".exec = "exec devenv tasks run ntl:format";
    "ntl:lint".exec = "exec devenv tasks run ntl:lint";
    "ntl:check".exec = "exec devenv tasks run ntl:check";
    "ntl:test".exec = "exec devenv tasks run ntl:test";
    "ntl:db-start".exec = "exec devenv tasks run ntl:db-start";
    "ntl:db-stop".exec = "exec devenv tasks run ntl:db-stop";
    "ntl:db-reset".exec = "exec devenv tasks run ntl:db-reset";
    "ntl:db-migrate".exec = "exec devenv tasks run ntl:db-migrate";
  };

  tasks = {
    "ntl:docker-check" = {
      description = "Fail fast when Docker Engine is unavailable";
      cwd = projectRoot;
      exec = ''
        if ! docker info >/dev/null 2>&1; then
          echo "Docker Engine is not running or not reachable."
          echo "Start Docker on the host, then rerun 'devenv up' or 'devenv tasks run ntl:db-start'."
          exit 1
        fi
      '';
    };

    "ntl:dev" = {
      description = "Run the root development server";
      cwd = projectRoot;
      exec = "bun run dev";
    };

    "ntl:format" = {
      description = "Run the root formatting pipeline";
      cwd = projectRoot;
      exec = "bun run format";
    };

    "ntl:lint" = {
      description = "Run the root lint pipeline";
      cwd = projectRoot;
      exec = "bun run lint";
    };

    "ntl:check" = {
      description = "Run the root typecheck pipeline";
      cwd = projectRoot;
      exec = "bun run check";
    };

    "ntl:test" = {
      description = "Run the root test pipeline";
      cwd = projectRoot;
      exec = "bun run test";
    };

    "ntl:db-start" = {
      description = "Start the local Supabase stack through the root wrapper";
      cwd = projectRoot;
      after = [ "ntl:docker-check@succeeded" ];
      exec = "bun run db:start";
    };

    "ntl:db-stop" = {
      description = "Stop the local Supabase stack through the root wrapper";
      cwd = projectRoot;
      exec = "bun run db:stop";
    };

    "ntl:db-reset" = {
      description = "Reset the local Supabase stack through the root wrapper";
      cwd = projectRoot;
      after = [ "ntl:docker-check@succeeded" ];
      exec = "bun run db:reset";
    };

    "ntl:db-migrate" = {
      description = "Run the root database migration wrapper";
      cwd = projectRoot;
      after = [ "ntl:db-start@succeeded" ];
      exec = "bun run db:migrate";
    };
  };

  processes.app = {
    cwd = projectRoot;
    after = [ "ntl:db-migrate@succeeded" ];
    exec = "bun run dev";
  };
}
