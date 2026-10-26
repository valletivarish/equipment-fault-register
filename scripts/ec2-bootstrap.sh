#!/bin/bash
# EC2 user data: runs once when the instance is first created. It installs the
# runtime only; the application itself arrives later through the CD pipeline.
set -euo pipefail

dnf -y update
dnf -y install nginx postgresql16
dnf -y install python3.12 || dnf -y install python3.11

useradd --system --home-dir /opt/fault-register --shell /sbin/nologin faultreg || true
mkdir -p /opt/fault-register/releases /opt/fault-register/venvs
systemctl enable nginx
