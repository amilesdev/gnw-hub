#!/bin/bash
# Wrapper invoked by the launchd job (com.gnw.hub.backup) to run a DB backup.
# launchd runs with a bare environment, so we set PATH and cd into the app first.
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "/Users/alonzomilesjr./Desktop/App Developing/GNW Hub App/GNW-Hub" || exit 1
mkdir -p backups
{
  echo "=== backup run: $(date) ==="
  npm run db:backup
  echo "exit: $? ($(date))"
  echo
} >> backups/backup.log 2>&1
