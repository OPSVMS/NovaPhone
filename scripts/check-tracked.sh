#!/bin/sh
# Falla si hay código fuente sin versionar o ignorado por error: Docker construye con archivos locales,
# pero Vercel solo con lo que está en git.
bad=$(git status --porcelain --ignored -- src public drizzle e2e/mock e2e/tests | grep -E '^(\?\?|!!)' || true)
if [ -n "$bad" ]; then
  echo "Archivos de código fuera de git (no llegarían a producción):"
  echo "$bad"
  exit 1
fi
