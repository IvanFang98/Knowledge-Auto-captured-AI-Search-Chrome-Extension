# Cloud Run Proxy Setup for Vertex AI

## 🎯 Architecture Overview

```
Chrome Extension → Cloud Run Proxy → Vertex AI
                   (with service account)
```

**Benefits:**
- ✅ No user authentication required
- ✅ No secrets in Chrome extension
- ✅ Global region support
- ✅ Rate limiting & cost control
- ✅ Secure service account authentication

## 🚀 Step 1: Create Service Account

```bash
# Set your project ID
PROJECT_ID="chrome-ext-knowledge-base"

# Create service account
gcloud iam service-accounts create smartgrab-embeddings \
    --display-name='SmartGrab Embeddings Service' \
    --project=$PROJECT_ID

# Grant Vertex AI permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member='serviceAccount:smartgrab-embeddings@'$PROJECT_ID'.iam.gserviceaccount.com' \
    --role='roles/aiplatform.user'

# Create and download service account key
gcloud iam service-accounts keys create smartgrab-key.json \
    --iam-account=smartgrab-embeddings@$PROJECT_ID.iam.gserviceaccount.com

echo "✅ Service account created and key saved to smartgrab-key.json"
```

## 🚀 Step 2: Deploy Cloud Run Proxy

```bash
# Navigate to the cloud-proxy directory
cd cloud-proxy

# Set environment variables
export PROJECT_ID="chrome-ext-knowledge-base"
export SERVICE_ACCOUNT_KEY=$(cat ../smartgrab-key.json | base64 -w 0)

# Deploy to Cloud Run
gcloud run deploy vertex-ai-proxy \
    --source . \
    --platform managed \
    --region us-central1 \
    --project $PROJECT_ID \
    --service-account smartgrab-embeddings@$PROJECT_ID.iam.gserviceaccount.com \
    --set-env-vars "PROJECT_ID=$PROJECT_ID,LOCATION=global,MODEL_NAME=text-embedding-004,SERVICE_ACCOUNT_KEY=$SERVICE_ACCOUNT_KEY" \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --concurrency 100 \
    --max-instances 10 \
    --timeout 60s \
    --port 8080

# Get the service URL
SERVICE_URL=$(gcloud run services describe vertex-ai-proxy --region us-central1 --project $PROJECT_ID --format "value(status.url)")
echo "🌐 Your Cloud Run URL: $SERVICE_URL"
```

## 🚀 Step 3: Update Chrome Extension Configuration

After deployment, you'll get a Cloud Run URL like:
```
https://vertex-ai-proxy-xxxx-uc.a.run.app
```

Update `vertex_config.js`:
```javascript
const VERTEX_CONFIG = {
  proxyUrl: 'https://vertex-ai-proxy-xxxx-uc.a.run.app',
  projectId: 'chrome-ext-knowledge-base',
  model: 'text-embedding-004',
  batchSize: 5,
  requestDelay: 1000,
};
```

## 🧪 Step 4: Test the Setup

### Test the proxy directly:
```bash
# Test health endpoint
curl https://your-proxy-url.run.app/health

# Test embedding generation
curl -X POST https://your-proxy-url.run.app/embed \
  -H "Content-Type: application/json" \
  -H "X-Extension-ID: test" \
  -d '{"text": "How to do great work", "task_type": "RETRIEVAL_QUERY"}'
```

### Test in Chrome Extension:
1. Load the extension in Chrome
2. Try a semantic search
3. Check the console for logs
4. Should see "VertexAISearch: Generated 768D embedding via proxy"

## 💰 Cost Management

### Pricing:
- **Text Embedding**: $0.00025 per 1,000 characters
- **Cloud Run**: $0.00002400 per vCPU-second (very minimal)
- **Typical usage**: $0.01-0.05 per month per active user

### Rate Limiting (built into proxy):
- **50 requests per minute per user**
- **10 batch requests per minute per user**
- **Maximum 10 texts per batch**

### Cost Controls:
- Set Cloud Run max instances to limit concurrent usage
- Monitor usage in Cloud Console
- Set up billing alerts

## 🔧 Advanced Configuration

### Environment Variables:
```bash
PROJECT_ID=chrome-ext-knowledge-base
LOCATION=global                    # Use global for best performance
MODEL_NAME=text-embedding-004      # Latest model
SERVICE_ACCOUNT_KEY=<base64-json>  # Service account credentials
REDIS_URL=redis://...              # Optional: for distributed rate limiting
```

### Scaling Configuration:
```bash
# Update Cloud Run service
gcloud run services update vertex-ai-proxy \
    --region us-central1 \
    --max-instances 20 \
    --memory 2Gi \
    --cpu 2 \
    --concurrency 200
```

## 🛡️ Security Features

### Built-in Security:
- ✅ **Rate limiting** per extension ID
- ✅ **CORS protection** (only Chrome extensions)
- ✅ **Service account isolation**
- ✅ **No secrets in client code**
- ✅ **Request validation**

### Monitoring:
- Cloud Run logs all requests
- Vertex AI usage tracked in Cloud Console
- Rate limiting events logged
- Error handling with proper HTTP status codes

## 🚨 Troubleshooting

### Common Issues:

1. **"Cannot connect to proxy"**
   - Check if Cloud Run service is deployed
   - Verify the proxy URL in `vertex_config.js`
   - Check network connectivity

2. **"Rate limit exceeded"**
   - Normal behavior, requests will succeed after rate limit window
   - Consider adjusting rate limits in `main.py`

3. **"Vertex AI API error"**
   - Check service account permissions
   - Verify Vertex AI API is enabled
   - Check Cloud Run logs for detailed errors

4. **"Invalid response format"**
   - Check if the model name is correct
   - Verify the proxy is using the right API version

### Debug Commands:
```bash
# Check Cloud Run logs
gcloud run services logs read vertex-ai-proxy --region us-central1

# Check service status
gcloud run services describe vertex-ai-proxy --region us-central1

# Test service account permissions
gcloud auth activate-service-account --key-file smartgrab-key.json
gcloud ai models list --region=global
```

## ✅ Final Checklist

- [ ] Service account created with Vertex AI permissions
- [ ] Cloud Run proxy deployed successfully  
- [ ] Service URL added to `vertex_config.js`
- [ ] Chrome extension loads without errors
- [ ] Semantic search returns results with similarity scores
- [ ] Rate limiting works (test with many requests)
- [ ] Billing alerts configured

**🎉 Once complete, you'll have enterprise-grade semantic search with zero user friction!**