{
  description = "Flake for Holochain app development";

  inputs = {
    holonix.url = "github:holochain/holonix?ref=main-0.6";

    nixpkgs.follows = "holonix/nixpkgs";
    flake-parts.follows = "holonix/flake-parts";
  };

  outputs = inputs@{ flake-parts, ... }: flake-parts.lib.mkFlake { inherit inputs; } {
    systems = builtins.attrNames inputs.holonix.devShells;
    perSystem = { inputs', pkgs, ... }: {
      formatter = pkgs.nixpkgs-fmt;

      devShells.default = pkgs.mkShell {
        # NOTE: We cannot use inputsFrom = [ inputs'.holonix.devShells.default ]
        # because hc-playground has a hash mismatch issue upstream.
        # Instead, we explicitly list the packages we need.
        # When the playground issue is fixed, you can revert to:
        #   inputsFrom = [ inputs'.holonix.devShells.default ];
        
        packages = (with inputs'.holonix.packages; [
          bootstrap-srv
          hc
          hc-scaffold
          hcterm
          hn-introspect
          holochain
          lair-keystore
          rust
          # hc-playground  # EXCLUDED: hash mismatch issue upstream
        ]) ++ (with pkgs; [
          nodejs_22
          binaryen
          bun
        ]);

        shellHook = ''
          export PS1='\[\033[1;34m\][holonix:\w]\$\[\033[0m\] '
        '';
      };
    };
  };
}
