#!/bin/bash

# =============================================================================
# MAB AI Strategies Twitter SEO Agent
# Deployment Script
# =============================================================================

set -e

echo "=============================================="
echo "MAB AI Strategies - Deployment Script"
echo "=============================================="
echo

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "Error: Wrangler CLI not found"
    echo "Install with: npm install -g wrangler"
    exit 1
fi

# Check if logged in to Cloudflare
echo "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "Not logged in to Cloudflare"
    echo "Running: wrangler login"
    wrangler login
fi

echo

# Check for required secrets
echo "Checking environment secrets..."
echo "(These should be set in Cloudflare dashboard or via 'wrangler secret put')"
echo

REQUIRED_SECRETS=(
    "PERPLEXITY_API_KEY"
    "NEWSAPI_KEY"
    "TWITTER_API_KEY"
    "TWITTER_API_SECRET"
    "TWITTER_ACCESS_TOKEN"
    "TWITTER_ACCESS_SECRET"
    "GOOGLE_SHEETS_CREDENTIALS"
    "GOOGLE_SHEET_ID"
)

echo "Required secrets:"
for secret in "${REQUIRED_SECRETS[@]}"; do
    echo "  - $secret"
done

echo
read -p "Have you configured all secrets in Cloudflare? (y/n) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo
    echo "Please set secrets using:"
    echo "  wrangler secret put SECRET_NAME"
    echo
    echo "Or set them in the Cloudflare dashboard:"
    echo "  Workers & Pages > Your Worker > Settings > Variables"
    exit 1
fi

echo

# Deploy Worker
echo "=============================================="
echo "Deploying Cloudflare Worker..."
echo "=============================================="

wrangler deploy

echo
echo "Worker deployed successfully!"
echo

# Deploy Dashboard (optional)
read -p "Deploy dashboard to Cloudflare Pages? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo
    echo "=============================================="
    echo "Deploying Dashboard to Cloudflare Pages..."
    echo "=============================================="

    # Check if pages project exists
    PROJECT_NAME="mab-twitter-dashboard"

    if ! wrangler pages project list | grep -q "$PROJECT_NAME"; then
        echo "Creating Pages project: $PROJECT_NAME"
        wrangler pages project create "$PROJECT_NAME" --production-branch main
    fi

    wrangler pages deploy dashboard/ --project-name="$PROJECT_NAME"

    echo
    echo "Dashboard deployed!"
    echo "URL: https://$PROJECT_NAME.pages.dev"
fi

echo
echo "=============================================="
echo "Deployment Complete!"
echo "=============================================="
echo
echo "Next steps:"
echo "1. Test the worker: curl https://mab-twitter-seo-agent.YOUR_SUBDOMAIN.workers.dev/health"
echo "2. Monitor logs: wrangler tail"
echo "3. Check cron triggers are active in Cloudflare dashboard"
echo
echo "Useful commands:"
echo "  wrangler tail              - View real-time logs"
echo "  wrangler dev               - Run locally for testing"
echo "  wrangler secret list       - List configured secrets"
echo
