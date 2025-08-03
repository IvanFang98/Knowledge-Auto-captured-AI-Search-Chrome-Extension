# Cloud Run Proxy for Vertex AI Text Embeddings
# Handles authentication and rate limiting for Chrome Extension

import os
import json
import time
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.auth import default
from google.auth.transport.requests import Request
import numpy as np
from functools import wraps
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app, origins=["chrome-extension://*"])  # Allow Chrome extensions

# Configuration
PROJECT_ID = os.environ.get('PROJECT_ID', 'chrome-ext-knowledge-base')
LOCATION = os.environ.get('LOCATION', 'us-central1')
MODEL_NAME = os.environ.get('MODEL_NAME', 'text-embedding-004')
REDIS_URL = os.environ.get('REDIS_URL')  # Optional for rate limiting

# Initialize Google Cloud credentials
credentials, project = default()
if not credentials.valid:
    credentials.refresh(Request())

# Redis client for rate limiting (optional)
redis_client = None
if REDIS_URL:
    try:
        import redis
        redis_client = redis.from_url(REDIS_URL)
    except ImportError:
        print("Redis not available, using in-memory rate limiting")

# In-memory rate limiting fallback
rate_limit_cache = {}

def rate_limit(max_requests=100, window_minutes=1):
    """Rate limiting decorator"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get client identifier (could be IP or extension ID)
            client_id = request.headers.get('X-Extension-ID', request.remote_addr)
            current_time = datetime.now()
            window_start = current_time - timedelta(minutes=window_minutes)
            
            if redis_client:
                # Use Redis for distributed rate limiting
                key = f"rate_limit:{client_id}"
                current_requests = redis_client.zcount(key, window_start.timestamp(), current_time.timestamp())
                
                if current_requests >= max_requests:
                    return jsonify({'error': 'Rate limit exceeded'}), 429
                
                # Add current request
                redis_client.zadd(key, {str(current_time.timestamp()): current_time.timestamp()})
                redis_client.expire(key, window_minutes * 60)
            else:
                # Use in-memory rate limiting
                if client_id not in rate_limit_cache:
                    rate_limit_cache[client_id] = []
                
                # Clean old requests
                rate_limit_cache[client_id] = [
                    req_time for req_time in rate_limit_cache[client_id]
                    if req_time > window_start
                ]
                
                if len(rate_limit_cache[client_id]) >= max_requests:
                    return jsonify({'error': 'Rate limit exceeded'}), 429
                
                rate_limit_cache[client_id].append(current_time)
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'project': PROJECT_ID,
        'location': LOCATION,
        'model': MODEL_NAME,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/embed', methods=['POST'])
@rate_limit(max_requests=50, window_minutes=1)  # 50 requests per minute per client
def generate_embedding():
    """Generate text embedding using Vertex AI REST API"""
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing text field'}), 400
        
        text = data['text']
        task_type = data.get('task_type', 'RETRIEVAL_DOCUMENT')
        
        if not text.strip():
            return jsonify({'error': 'Text cannot be empty'}), 400
        
        # Truncate text to Vertex AI limits
        text = text[:3000]
        
        # Refresh credentials if needed
        if not credentials.valid:
            credentials.refresh(Request())
        
        # Prepare the REST API request
        url = f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/{MODEL_NAME}:predict"
        
        headers = {
            'Authorization': f'Bearer {credentials.token}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            "instances": [{
                "content": text,
                "task_type": task_type
            }]
        }
        
        # Call Vertex AI REST API
        start_time = time.time()
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        end_time = time.time()
        
        if not response.ok:
            print(f"Vertex AI API error: {response.status_code} - {response.text}")
            return jsonify({'error': f'Vertex AI API error: {response.status_code}'}), 500
        
        result = response.json()
        
        # Extract embedding
        if not result.get('predictions') or not result['predictions'][0].get('embeddings'):
            print(f"Invalid Vertex AI response: {result}")
            return jsonify({'error': 'Invalid response from Vertex AI'}), 500
        
        embedding = result['predictions'][0]['embeddings']['values']
        
        return jsonify({
            'embedding': embedding,
            'dimensions': len(embedding),
            'model': MODEL_NAME,
            'task_type': task_type,
            'processing_time_ms': round((end_time - start_time) * 1000, 2)
        })
        
    except Exception as e:
        print(f"Error generating embedding: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/embed/batch', methods=['POST'])
@rate_limit(max_requests=10, window_minutes=1)  # Lower limit for batch requests
def generate_embeddings_batch():
    """Generate multiple embeddings in batch"""
    try:
        data = request.get_json()
        
        if not data or 'texts' not in data:
            return jsonify({'error': 'Missing texts field'}), 400
        
        texts = data['texts']
        task_type = data.get('task_type', 'RETRIEVAL_DOCUMENT')
        
        if not isinstance(texts, list) or len(texts) == 0:
            return jsonify({'error': 'texts must be a non-empty array'}), 400
        
        if len(texts) > 10:  # Limit batch size
            return jsonify({'error': 'Maximum 10 texts per batch'}), 400
        
        # Process each text
        results = []
        for i, text in enumerate(texts):
            if not text or not text.strip():
                results.append({'error': 'Empty text', 'index': i})
                continue
            
            try:
                # Truncate text
                text = text[:3000]
                
                # Prepare the request
                endpoint = aiplatform.Endpoint(
                    f"projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/{MODEL_NAME}"
                )
                
                instances = [{
                    "content": text,
                    "task_type": task_type
                }]
                
                # Call Vertex AI
                response = endpoint.predict(instances=instances)
                
                if response.predictions and response.predictions[0].get('embeddings'):
                    embedding = response.predictions[0]['embeddings']['values']
                    results.append({
                        'embedding': embedding,
                        'dimensions': len(embedding),
                        'index': i
                    })
                else:
                    results.append({'error': 'Invalid response from Vertex AI', 'index': i})
                
                # Small delay between requests in batch
                time.sleep(0.1)
                
            except Exception as e:
                results.append({'error': str(e), 'index': i})
        
        return jsonify({
            'results': results,
            'model': MODEL_NAME,
            'task_type': task_type,
            'processed_count': len([r for r in results if 'embedding' in r])
        })
        
    except Exception as e:
        print(f"Error in batch embedding: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/similarity', methods=['POST'])
@rate_limit(max_requests=100, window_minutes=1)
def calculate_similarity():
    """Calculate cosine similarity between two embeddings"""
    try:
        data = request.get_json()
        
        if not data or 'embedding1' not in data or 'embedding2' not in data:
            return jsonify({'error': 'Missing embedding1 or embedding2 fields'}), 400
        
        emb1 = np.array(data['embedding1'])
        emb2 = np.array(data['embedding2'])
        
        if emb1.shape != emb2.shape:
            return jsonify({'error': 'Embeddings must have the same dimensions'}), 400
        
        # Calculate cosine similarity
        dot_product = np.dot(emb1, emb2)
        norm1 = np.linalg.norm(emb1)
        norm2 = np.linalg.norm(emb2)
        
        if norm1 == 0 or norm2 == 0:
            similarity = 0.0
        else:
            similarity = dot_product / (norm1 * norm2)
        
        return jsonify({
            'similarity': float(similarity),
            'dimensions': len(emb1)
        })
        
    except Exception as e:
        print(f"Error calculating similarity: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)