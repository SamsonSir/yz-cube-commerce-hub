#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root'; exit 1; }
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l
base=/opt/yz-commerce
install -d -m 755 "$base/runtime" "$base/releases" /var/cache/yz-commerce
getent passwd yz-hub >/dev/null || useradd --system --create-home --home-dir /var/lib/yz-commerce --shell /usr/sbin/nologin yz-hub
install -d -m 750 -o root -g yz-hub /etc/yz-commerce
install -d -m 700 -o yz-hub -g yz-hub /var/lib/yz-commerce/backups

if [[ ! -x "$base/runtime/node-v22.22.2-linux-x64/bin/node" ]]; then
  [[ $(uname -m) == x86_64 ]] || { echo 'Unsupported architecture'; exit 1; }
  cd /var/cache/yz-commerce
  curl --fail --location --retry 2 --max-time 180 -o node-v22.22.2-linux-x64.tar.xz https://nodejs.org/download/release/v22.22.2/node-v22.22.2-linux-x64.tar.xz
  printf '%s  %s\n' 88fd1ce767091fd8d4a99fdb2356e98c819f93f3b1f8663853a2dee9b438068a node-v22.22.2-linux-x64.tar.xz | sha256sum --check -
  tar -xJf node-v22.22.2-linux-x64.tar.xz -C "$base/runtime"
fi
export PATH="$base/runtime/node-v22.22.2-linux-x64/bin:$base/runtime/tools/bin:$PATH"
if [[ ! -x "$base/runtime/tools/bin/pnpm" ]]; then npm install --global --prefix "$base/runtime/tools" pnpm@9.12.0; fi

if [[ ! -x /usr/lib/postgresql/16/bin/postgres ]]; then
  install -d /usr/share/postgresql-common/pgdg
  curl --fail --location --max-time 30 -o /usr/share/postgresql-common/pgdg/yz-commerce-postgresql.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
  fingerprint=$(gpg --show-keys --with-colons /usr/share/postgresql-common/pgdg/yz-commerce-postgresql.asc 2>/dev/null | awk -F: '$1=="fpr" {print $10; exit}')
  [[ "$fingerprint" == B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8 ]] || { echo 'PGDG signing-key mismatch'; exit 1; }
  cat > /etc/apt/sources.list.d/yz-commerce-pgdg.sources <<'PGDG'
Types: deb
URIs: https://apt.postgresql.org/pub/repos/apt
Suites: jammy-pgdg
Architectures: amd64
Components: main
Signed-By: /usr/share/postgresql-common/pgdg/yz-commerce-postgresql.asc
PGDG
  apt-get update -qq
  apt-get install -y --no-install-recommends postgresql-16 postgresql-client-16
fi
node --version
pnpm --version
pg_lsclusters
echo 'Runtime ready; existing Nginx and FRP configuration untouched.'
