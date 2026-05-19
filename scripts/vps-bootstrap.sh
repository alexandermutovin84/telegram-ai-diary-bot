#!/usr/bin/env bash
# Run ONCE on a fresh Ubuntu 22.04/24.04 VPS as root:
#   curl -fsSL ... | bash
# Or: scp scripts/vps-bootstrap.sh root@SERVER:/tmp/ && ssh root@SERVER bash /tmp/vps-bootstrap.sh
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

if ! command -v docker >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "${VERSION_CODENAME:-$VERSION}") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

systemctl enable docker
systemctl start docker

DEPLOY_DIR="${DEPLOY_DIR:-/opt/diary-bot}"
mkdir -p "$DEPLOY_DIR"
chown -R "${SUDO_USER:-root}:${SUDO_USER:-root}" "$DEPLOY_DIR" 2>/dev/null || true

# Basic firewall: SSH + optional local health only
if command -v ufw >/dev/null 2>&1 && ! ufw status | grep -q 'Status: active'; then
  ufw allow OpenSSH
  ufw --force enable
fi

echo "Docker ready. Deploy dir: $DEPLOY_DIR"
echo "Next: copy project + .env, then: cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml up -d --build"
