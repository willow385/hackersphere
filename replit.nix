{ pkgs }: {
    deps = [
        pkgs.iproute2
        pkgs.less
        pkgs.nano
        pkgs.nettools
        pkgs.certbot-full
        pkgs.yarn
        pkgs.esbuild
        pkgs.nodejs-16_x

        pkgs.nodePackages.typescript
        pkgs.nodePackages.typescript-language-server
    ];
}