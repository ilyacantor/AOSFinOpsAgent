#!/bin/bash
set -e

echo "🚀 Starting FinOps Autopilot in production mode..."

# Step 1: Run database migrations
echo "📊 Running database migrations..."
npm run db:push --force || {
  echo "❌ Database migration failed!"
  exit 1
}

echo "✅ Database migrations complete"

# Step 2: Start the application
echo "🌐 Starting application server..."
NODE_ENV=production tsx server/index.ts
