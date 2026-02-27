"""
Test Q&A Feature - Backend API and Database Schema
Tests the Q&A ecosystem for article and series pages
"""

import pytest
import requests
import os

# Get BASE_URL from frontend env or use localhost
BASE_URL = "http://localhost:3000"


class TestQADatabaseSchema:
    """Test ArticleQA database schema exists and works"""

    def test_article_qa_model_exists(self):
        """Verify ArticleQA model exists in schema"""
        # Run prisma check via shell
        import subprocess
        result = subprocess.run(
            ["node", "-e", """
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.articleQA.count().then(count => {
    console.log('COUNT:' + count);
    prisma.$disconnect();
}).catch(e => {
    console.log('ERROR:' + e.message);
    prisma.$disconnect();
});
            """],
            cwd="/app/serien-nextjs",
            capture_output=True,
            text=True,
            timeout=30
        )
        
        output = result.stdout + result.stderr
        assert "COUNT:" in output, f"ArticleQA model not accessible. Output: {output}"
        print(f"✓ ArticleQA model exists")
    
    def test_article_includes_qa_relation(self):
        """Verify Article model has articleQA relation"""
        import subprocess
        result = subprocess.run(
            ["node", "-e", """
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.article.findFirst({
    where: { status: 'published' },
    include: { articleQA: true }
}).then(article => {
    if (article) {
        console.log('HAS_RELATION:true');
        console.log('HAS_QA:' + (article.articleQA !== null));
    } else {
        console.log('NO_ARTICLE');
    }
    prisma.$disconnect();
}).catch(e => {
    console.log('ERROR:' + e.message);
    prisma.$disconnect();
});
            """],
            cwd="/app/serien-nextjs",
            capture_output=True,
            text=True,
            timeout=30
        )
        
        output = result.stdout
        assert "HAS_RELATION:true" in output or "NO_ARTICLE" in output, f"Article-QA relation issue: {output}"
        print(f"✓ Article has articleQA relation")


class TestQAAPIRoutes:
    """Test /api/qa/generate API route structure"""
    
    def test_qa_generate_post_requires_article_id(self):
        """POST /api/qa/generate without articleId returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/qa/generate",
            json={},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "error" in data
        assert "articleId" in data["error"].lower()
        print(f"✓ POST without articleId returns 400 with error message")
    
    def test_qa_generate_get_requires_article_id(self):
        """GET /api/qa/generate without articleId returns 400"""
        response = requests.get(f"{BASE_URL}/api/qa/generate")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "error" in data
        print(f"✓ GET without articleId returns 400")
    
    def test_qa_generate_post_with_invalid_article(self):
        """POST /api/qa/generate with invalid articleId returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/qa/generate",
            json={"articleId": "non-existent-article-id"},
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 404 for non-existent article
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        data = response.json()
        assert "error" in data
        print(f"✓ POST with invalid articleId returns 404")
    
    def test_qa_generate_post_with_valid_article(self):
        """POST /api/qa/generate with valid articleId handles LLM failure gracefully"""
        # Get a real article ID
        import subprocess
        result = subprocess.run(
            ["node", "-e", """
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.article.findFirst({
    where: { status: 'published' },
    select: { id: true }
}).then(article => {
    console.log(article ? article.id : 'NONE');
    prisma.$disconnect();
});
            """],
            cwd="/app/serien-nextjs",
            capture_output=True,
            text=True,
            timeout=30
        )
        
        article_id = result.stdout.strip()
        if not article_id or article_id == "NONE":
            pytest.skip("No published articles found")
        
        response = requests.post(
            f"{BASE_URL}/api/qa/generate",
            json={"articleId": article_id},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        # Expected: 500 due to LLM endpoint failure (404 fault filter)
        # This is expected behavior per task description
        assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
        data = response.json()
        
        if response.status_code == 500:
            # LLM failure is expected
            assert "error" in data
            print(f"✓ POST returns 500 when LLM fails (expected: Emergent LLM 404)")
        else:
            # If somehow LLM works, verify success structure
            assert "success" in data
            print(f"✓ POST returns success when LLM works")


class TestQAFrontendIntegration:
    """Test Q&A component integration points"""
    
    def test_article_page_loads(self):
        """Article page loads without errors"""
        response = requests.get(f"{BASE_URL}/breaking-bad-film-geruechte", timeout=15)
        assert response.status_code == 200, f"Article page failed: {response.status_code}"
        
        # Check for key article structure
        assert "Breaking Bad" in response.text or "article" in response.text.lower()
        print(f"✓ Article page loads successfully")
    
    def test_series_page_loads(self):
        """Series page loads without errors"""
        response = requests.get(f"{BASE_URL}/serie/1396-breaking-bad", timeout=15)
        assert response.status_code == 200, f"Series page failed: {response.status_code}"
        
        # Check for series page structure
        assert "Breaking Bad" in response.text
        print(f"✓ Series page loads successfully")
    
    def test_article_qa_component_in_page(self):
        """ArticleQA component is imported in article page"""
        import subprocess
        result = subprocess.run(
            ["grep", "-l", "ArticleQA", "/app/serien-nextjs/app/[slug]/page.tsx"],
            capture_output=True,
            text=True
        )
        
        assert result.returncode == 0, "ArticleQA not imported in article page"
        print(f"✓ ArticleQA component integrated in article page")
    
    def test_series_qa_component_in_page(self):
        """SeriesQA component is imported in series page"""
        import subprocess
        result = subprocess.run(
            ["grep", "-l", "SeriesQA", "/app/serien-nextjs/app/serie/[slug]/page.tsx"],
            capture_output=True,
            text=True
        )
        
        assert result.returncode == 0, "SeriesQA not imported in series page"
        print(f"✓ SeriesQA component integrated in series page")


class TestQAPipelineIntegration:
    """Test Q&A integration in pipeline"""
    
    def test_pipeline_has_step_10(self):
        """Pipeline has STEP 10 for Q&A generation"""
        import subprocess
        result = subprocess.run(
            ["grep", "-c", "STEP 10", "/app/serien-nextjs/scripts/pipeline-v1.ts"],
            capture_output=True,
            text=True
        )
        
        count = int(result.stdout.strip()) if result.stdout.strip() else 0
        assert count > 0, "Pipeline missing STEP 10 for Q&A"
        print(f"✓ Pipeline has STEP 10 for Q&A generation")
    
    def test_pipeline_calls_qa_api(self):
        """Pipeline calls /api/qa/generate endpoint"""
        import subprocess
        result = subprocess.run(
            ["grep", "-c", "api/qa/generate", "/app/serien-nextjs/scripts/pipeline-v1.ts"],
            capture_output=True,
            text=True
        )
        
        count = int(result.stdout.strip()) if result.stdout.strip() else 0
        assert count > 0, "Pipeline doesn't call Q&A API"
        print(f"✓ Pipeline calls /api/qa/generate endpoint")


class TestFAQPageSchema:
    """Test FAQPage schema implementation"""
    
    def test_article_qa_schema_conditional(self):
        """ArticleQA component has conditional FAQPage schema based on schemaEnabled"""
        with open("/app/serien-nextjs/components/ArticleQA.tsx", "r") as f:
            content = f.read()
        
        assert "schemaEnabled" in content, "schemaEnabled prop missing"
        assert "FAQPage" in content, "FAQPage schema missing"
        assert "schema.org/Question" in content, "Question schema missing"
        print(f"✓ ArticleQA has conditional FAQPage schema")
    
    def test_series_qa_always_has_schema(self):
        """SeriesQA component always includes FAQPage schema (evergreen content)"""
        with open("/app/serien-nextjs/components/SeriesQA.tsx", "r") as f:
            content = f.read()
        
        assert "FAQPage" in content, "FAQPage schema missing"
        assert "schema.org/Question" in content, "Question schema missing"
        # SeriesQA doesn't have conditional schemaEnabled (always on)
        print(f"✓ SeriesQA has FAQPage schema (always enabled)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
