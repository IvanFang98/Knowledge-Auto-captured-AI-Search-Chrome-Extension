#!/bin/bash
# Deploy script for Cloud Run Vertex AI Proxy

set -e

# Configuration
PROJECT_ID="chrome-ext-knowledge-base"
SERVICE_NAME="vertex-ai-proxy"
REGION="us-central1"
SERVICE_ACCOUNT_EMAIL="smartgrab-embeddings@${PROJECT_ID}.iam.gserviceaccount.com"

echo "🚀 Deploying Vertex AI Proxy to Cloud Run..."

# Build and deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
    --source . \
    --platform managed \
    --region $REGION \
    --project $PROJECT_ID \
    --service-account $SERVICE_ACCOUNT_EMAIL \
    --set-env-vars "PROJECT_ID=${PROJECT_ID},LOCATION=global,MODEL_NAME=text-embedding-004" \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --concurrency 100 \
    --max-instances 10 \
    --timeout 60s \
    --port 8080

echo "✅ Deployment complete!"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format "value(status.url)")
echo "🌐 Service URL: $SERVICE_URL"

# Test the health endpoint
echo "🔍 Testing health endpoint..."
curl -s "$SERVICE_URL/health" | jq .

echo "📝 Update your Chrome extension with this URL:"
echo "PROXY_URL = '$SERVICE_URL'"