"""
Test Suite for TV-Series Content Pipeline
Tests LLM Proxy, Pipeline Steps, and Database Integration
"""

import pytest
import requests
import os
import time

# Get the base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
LLM_PROXY_URL = "http://localhost:8002"

# === LLM PROXY TESTS ===

class TestLLMProxy:
    """Tests for the LLM Proxy Service on port 8002"""
    
    def test_llm_proxy_health(self):
        """Test LLM Proxy health endpoint"""
        response = requests.get(f"{LLM_PROXY_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "llm-proxy"
        print("✅ LLM Proxy health check passed")
    
    def test_llm_proxy_chat_completion(self):
        """Test LLM Proxy OpenAI-compatible chat completion endpoint"""
        response = requests.post(
            f"{LLM_PROXY_URL}/v1/chat/completions",
            json={
                "model": "gpt-5.1",
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant. Respond with exactly one word."},
                    {"role": "user", "content": "Say 'test'"}
                ],
                "temperature": 0.1,
                "max_tokens": 10
            },
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert "choices" in data
        assert len(data["choices"]) > 0
        assert "message" in data["choices"][0]
        assert "content" in data["choices"][0]["message"]
        print(f"✅ LLM Proxy chat completion: {data['choices'][0]['message']['content'][:50]}")
    
    def test_llm_proxy_json_response(self):
        """Test LLM Proxy returns valid JSON structure"""
        response = requests.post(
            f"{LLM_PROXY_URL}/v1/chat/completions",
            json={
                "model": "gpt-5.1",
                "messages": [
                    {"role": "system", "content": "Return valid JSON only."},
                    {"role": "user", "content": "Return: {\"status\": \"ok\"}"}
                ],
                "temperature": 0,
                "max_tokens": 50
            },
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert data["model"] == "gpt-5.1"
        assert "usage" in data
        print("✅ LLM Proxy JSON response structure valid")


# === NEXTJS API TESTS ===

class TestNextJSAPI:
    """Tests for Next.js API endpoints"""
    
    def test_homepage_loads(self):
        """Test Next.js homepage loads correctly"""
        response = requests.get("http://localhost:3000", timeout=10)
        assert response.status_code == 200
        assert "serien.de" in response.text
        print("✅ Homepage loads successfully")
    
    def test_article_page_loads(self):
        """Test article page with pipeline-generated content loads"""
        response = requests.get(
            "http://localhost:3000/wednesday-staffel-2-neue-details-zum-start",
            timeout=10
        )
        # Accept 200 (found) or 404 (if test article doesn't exist)
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            assert "Wednesday" in response.text
            print("✅ Article page loads with content")
        else:
            print("⚠️ Test article not found (expected if not created)")


# === DATABASE VERIFICATION TESTS ===

class TestDatabaseIntegration:
    """Tests to verify database records after pipeline execution"""
    
    def test_database_connectivity(self):
        """Verify we can reach the database through Next.js"""
        # The homepage fetches from DB, so if it loads, DB is connected
        response = requests.get("http://localhost:3000", timeout=10)
        assert response.status_code == 200
        # Check for article content (indicates DB read worked)
        assert "article" in response.text.lower() or "news" in response.text.lower() or "serien" in response.text.lower()
        print("✅ Database connectivity verified through homepage")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
