#!/bin/bash
# Complete deployment script for Vertex AI proxy

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="chrome-ext-knowledge-base"
SERVICE_NAME="vertex-ai-proxy"
REGION="us-central1"
SERVICE_ACCOUNT_NAME="smartgrab-embeddings"

echo -e "${BLUE}🚀 Starting Vertex AI Proxy Deployment${NC}"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Step 1: Create service account if it doesn't exist
echo -e "${YELLOW}Step 1: Creating service account...${NC}"
if gcloud iam service-accounts describe ${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com --project=$PROJECT_ID &>/dev/null; then
    echo "✅ Service account already exists"
else
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
        --display-name='SmartGrab Embeddings Service' \
        --project=$PROJECT_ID
    echo "✅ Service account created"
fi

# Step 2: Grant permissions
echo -e "${YELLOW}Step 2: Granting Vertex AI permissions...${NC}"
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role='roles/aiplatform.user' \
    --quiet
echo "✅ Permissions granted"

# Step 3: Create service account key
echo -e "${YELLOW}Step 3: Creating service account key...${NC}"
if [ -f "smartgrab-key.json" ]; then
    echo "⚠️  Key file already exists, using existing key"
else
    gcloud iam service-accounts keys create smartgrab-key.json \
        --iam-account=${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com \
        --project=$PROJECT_ID
    echo "✅ Service account key created"
fi

# Step 4: Prepare environment variables
echo -e "${YELLOW}Step 4: Preparing deployment...${NC}"
export SERVICE_ACCOUNT_KEY=$(cat smartgrab-key.json | base64 -w 0)

# Step 5: Deploy to Cloud Run
echo -e "${YELLOW}Step 5: Deploying to Cloud Run...${NC}"
cd cloud-proxy

gcloud run deploy $SERVICE_NAME \
    --source . \
    --platform managed \
    --region $REGION \
    --project $PROJECT_ID \
    --service-account ${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com \
    --set-env-vars "PROJECT_ID=${PROJECT_ID},LOCATION=global,MODEL_NAME=text-embedding-004,SERVICE_ACCOUNT_KEY=${SERVICE_ACCOUNT_KEY}" \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --concurrency 100 \
    --max-instances 10 \
    --timeout 60s \
    --port 8080 \
    --quiet

cd ..

# Step 6: Get service URL
echo -e "${YELLOW}Step 6: Getting service URL...${NC}"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format "value(status.url)")

# Step 7: Test the deployment
echo -e "${YELLOW}Step 7: Testing deployment...${NC}"
HEALTH_RESPONSE=$(curl -s "$SERVICE_URL/health" || echo "ERROR")
if [[ $HEALTH_RESPONSE == *"healthy"* ]]; then
    echo "✅ Health check passed"
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo "Response: $HEALTH_RESPONSE"
    exit 1
fi

# Step 8: Update configuration file
echo -e "${YELLOW}Step 8: Updating Chrome extension configuration...${NC}"
sed -i.bak "s|proxyUrl: 'YOUR_CLOUD_RUN_URL'|proxyUrl: '$SERVICE_URL'|g" vertex_config.js
echo "✅ Configuration updated"

# Step 9: Clean up
echo -e "${YELLOW}Step 9: Cleaning up...${NC}"
rm -f smartgrab-key.json  # Remove the key file for security
echo "✅ Cleanup complete"

# Final output
echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo -e "${BLUE}Your Vertex AI proxy is running at:${NC}"
echo "$SERVICE_URL"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Load your Chrome extension"
echo "2. Try a semantic search"
echo "3. Check the console for 'Generated 768D embedding via proxy'"
echo ""
echo -e "${BLUE}Monitoring:${NC}"
echo "• Logs: gcloud run services logs read $SERVICE_NAME --region $REGION"
echo "• Status: gcloud run services describe $SERVICE_NAME --region $REGION"
echo ""
echo -e "${GREEN}✅ Your extension now has enterprise-grade semantic search!${NC}"