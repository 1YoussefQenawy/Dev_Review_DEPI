#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy --config=prisma.config.ts

echo "Starting server..."
exec npx tsx src/server.ts
