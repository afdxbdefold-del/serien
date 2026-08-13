# Emergent SSR - Exakter Nachbau: serien.de

**Zielprojekt:** serien.de - Serien News Platform mit SSR, ISR-Cache, SEO & Google News

**Tech Stack:** React 19 + Express SSR + FastAPI + MongoDB + Redis Cache

---

## 📋 ANWEISUNGEN FÜR AGENT

Kopiere diese Anweisungen komplett und folge jedem Schritt genau:

---

## PHASE 1: Backend Setup (FastAPI + MongoDB) [60 min]

### 1.1 Backend Struktur erstellen

```bash
# Erstelle folgende Verzeichnisstruktur:
/app/backend/
├── routes/
│   ├── articles.py
│   ├── series.py
│   ├── sitemaps.py
│   └── admin.py
├── models/
│   ├── article.py
│   ├── series.py
│   └── user.py
├── services/
│   ├── tmdb_service.py
│   ├── cache_service.py
│   └── image_service.py
├── utils/
│   ├── slug.py
│   └── seo.py
├── server.py
└── requirements.txt
```

### 1.2 Dependencies (`requirements.txt`)

```txt
fastapi==0.115.0
uvicorn==0.32.0
motor==3.6.0
pydantic==2.10.0
python-dotenv==1.0.0
httpx==0.27.0
redis==5.0.0
bcrypt==4.2.0
python-jose==3.3.0
```

### 1.3 Database Models

**File: `/app/backend/models/article.py`**

```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ArticleModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    slug: str
    title: str
    excerpt: Optional[str] = None
    content_html: str
    hero_image_url: Optional[str] = None
    hero_video_url: Optional[str] = None
    streamer: Optional[str] = None  # netflix, disney, etc.
    category: Optional[str] = None
    tags: List[str] = []
    tmdb_series_id: Optional[int] = None
    author_id: str
    published_at: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "draft"  # draft, published, archived
    reading_time: Optional[int] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "title": "Ist Black Rabbit sehenswert? Netflix Serie Review",
                "slug": "ist-black-rabbit-sehenswert-netflix",
                "excerpt": "Unsere Review zur neuen Netflix Serie...",
                "status": "published"
            }
        }

class ArticleResponse(BaseModel):
    id: str
    slug: str
    title: str
    excerpt: Optional[str]
    hero_image_url: Optional[str]
    published_at: Optional[datetime]
    reading_time: Optional[int]
```

**File: `/app/backend/models/series.py`**

```python
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime

class SeriesModel(BaseModel):
    tmdb_id: int
    title: str
    slug: str
    overview: Optional[str] = None
    poster_url: Optional[str] = None
    backdrop_url: Optional[str] = None
    status: Optional[str] = None
    first_air_date: Optional[datetime] = None
    genres: List[str] = []
    networks: List[str] = []
    tmdb_data: Optional[Dict] = None  # Full TMDB response
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

### 1.4 TMDB Service

**File: `/app/backend/services/tmdb_service.py`**

```python
import httpx
from typing import Optional, List, Dict
import os

class TMDBService:
    def __init__(self):
        self.api_key = os.getenv("TMDB_API_KEY", "YOUR_TMDB_API_KEY_HERE")
        self.base_url = "https://api.themoviedb.org/3"
        self.image_base = "https://image.tmdb.org/t/p"
    
    async def get_series(self, tmdb_id: int) -> Optional[Dict]:
        """Fetch series from TMDB"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/tv/{tmdb_id}",
                params={"api_key": self.api_key, "language": "de-DE"}
            )
            if response.status_code == 200:
                return response.json()
            return None
    
    async def search_series(self, query: str) -> List[Dict]:
        """Search series on TMDB"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/search/tv",
                params={"api_key": self.api_key, "language": "de-DE", "query": query}
            )
            if response.status_code == 200:
                return response.json().get("results", [])
            return []
    
    def get_image_url(self, path: Optional[str], size: str = "w500") -> Optional[str]:
        """Generate TMDB image URL"""
        if not path:
            return None
        return f"{self.image_base}/{size}{path}"

tmdb_service = TMDBService()
```

### 1.5 Cache Service (Redis)

**File: `/app/backend/services/cache_service.py`**

```python
import redis
import json
from typing import Optional, Any
import os

class CacheService:
    def __init__(self):
        redis_host = os.getenv("REDIS_HOST", "localhost")
        redis_port = int(os.getenv("REDIS_PORT", 6379))
        self.client = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
    
    def get(self, key: str) -> Optional[Any]:
        """Get from cache"""
        value = self.client.get(key)
        if value:
            return json.loads(value)
        return None
    
    def set(self, key: str, value: Any, ttl: int = 300):
        """Set to cache with TTL (default 5 min)"""
        self.client.setex(key, ttl, json.dumps(value, default=str))
    
    def delete(self, key: str):
        """Delete from cache"""
        self.client.delete(key)
    
    def clear_pattern(self, pattern: str):
        """Clear all keys matching pattern"""
        for key in self.client.scan_iter(pattern):
            self.client.delete(key)

cache = CacheService()
```

### 1.6 Articles API Routes

**File: `/app/backend/routes/articles.py`**

```python
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from models.article import ArticleModel, ArticleResponse
from services.cache_service import cache
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/api/articles", tags=["articles"])

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "serien_db")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

@router.get("/", response_model=List[ArticleResponse])
async def get_articles(
    limit: int = Query(20, le=100),
    page: int = Query(1, ge=1),
    status: str = Query("published"),
    streamer: Optional[str] = None,
    category: Optional[str] = None
):
    """Get paginated articles with filters"""
    cache_key = f"articles:list:{status}:{streamer}:{category}:page:{page}"
    
    # Check cache
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    # Build query
    query = {"status": status}
    if streamer:
        query["streamer"] = streamer
    if category:
        query["category"] = category
    
    # Fetch from DB
    skip = (page - 1) * limit
    cursor = db.articles.find(query, {"_id": 0}).sort("published_at", -1).skip(skip).limit(limit)
    articles = await cursor.to_list(length=limit)
    
    # Cache for 2 minutes
    cache.set(cache_key, articles, ttl=120)
    
    return articles

@router.get("/{slug}", response_model=ArticleModel)
async def get_article(slug: str):
    """Get single article by slug"""
    cache_key = f"article:{slug}"
    
    # Check cache
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    # Fetch from DB
    article = await db.articles.find_one({"slug": slug, "status": "published"}, {"_id": 0})
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Cache for 5 minutes
    cache.set(cache_key, article, ttl=300)
    
    return article

@router.post("/", response_model=ArticleModel)
async def create_article(article: ArticleModel):
    """Create new article (admin only)"""
    # Check if slug exists
    existing = await db.articles.find_one({"slug": article.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Slug already exists")
    
    # Insert
    await db.articles.insert_one(article.dict())
    
    # Clear cache
    cache.clear_pattern("articles:list:*")
    
    return article
```

### 1.7 Sitemaps API

**File: `/app/backend/routes/sitemaps.py`**

```python
from fastapi import APIRouter
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import os

router = APIRouter(prefix="/api/sitemap", tags=["sitemaps"])

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "serien_db")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

@router.get("/urls")
async def get_sitemap_urls():
    """Get all URLs for sitemap (used by SSR server)"""
    articles = await db.articles.find(
        {"status": "published"},
        {"_id": 0, "slug": 1, "updated_at": 1}
    ).to_list(10000)
    
    series = await db.series.find(
        {},
        {"_id": 0, "tmdb_id": 1, "slug": 1, "updated_at": 1}
    ).to_list(10000)
    
    return {
        "articles": articles,
        "series": series
    }

@router.get("/news-xml")
async def get_news_sitemap():
    """Google News Sitemap (last 48h)"""
    two_days_ago = datetime.utcnow() - timedelta(days=2)
    
    articles = await db.articles.find(
        {"status": "published", "published_at": {"$gte": two_days_ago}},
        {"_id": 0, "slug": 1, "title": 1, "published_at": 1, "updated_at": 1}
    ).sort("published_at", -1).to_list(1000)
    
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
    xml += '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n'
    
    for article in articles:
        xml += '  <url>\n'
        xml += f'    <loc>https://serien.de/{article["slug"]}/</loc>\n'
        xml += '    <news:news>\n'
        xml += '      <news:publication>\n'
        xml += '        <news:name>serien.de</news:name>\n'
        xml += '        <news:language>de</news:language>\n'
        xml += '      </news:publication>\n'
        xml += f'      <news:publication_date>{article["published_at"].isoformat()}</news:publication_date>\n'
        xml += f'      <news:title>{escape_xml(article["title"])}</news:title>\n'
        xml += '    </news:news>\n'
        xml += f'    <lastmod>{article["updated_at"].isoformat()}</lastmod>\n'
        xml += '  </url>\n'
    
    xml += '</urlset>'
    
    return Response(content=xml, media_type="application/xml")

def escape_xml(text: str) -> str:
    return (text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;")
                .replace("'", "&apos;"))
```

### 1.8 Main Server

**File: `/app/backend/server.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import articles, sitemaps, series, admin
import os

app = FastAPI(title="serien.de API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(articles.router)
app.include_router(sitemaps.router)
# app.include_router(series.router)
# app.include_router(admin.router)

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "serien.de API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
```

### 1.9 Environment Variables

**File: `/app/backend/.env`**

```bash
MONGO_URL=mongodb://localhost:27017
DB_NAME=serien_db
TMDB_API_KEY=YOUR_TMDB_API_KEY_HERE
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 1.10 Installation & Testing

```bash
# Install dependencies
cd /app/backend
pip install -r requirements.txt

# Start server
python server.py

# Test
curl http://localhost:8001/api/health
curl http://localhost:8001/api/articles
```

---

## PHASE 2: Frontend SSR Setup (React + Express) [90 min]

### 2.1 Frontend Struktur

```bash
/app/frontend/
├── server/
│   ├── ssr.js              # Express SSR Server (MAIN)
│   ├── render.js           # React Rendering Logic
│   └── cache.js            # SSR Cache Layer
├── src/
│   ├── pages/
│   │   ├── HomePage.jsx
│   │   ├── ArticlePage.jsx
│   │   ├── NewsPage.jsx
│   │   └── SeriesPage.jsx
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── Footer.jsx
│   │   └── ArticleCard.jsx
│   ├── utils/
│   │   ├── api.js          # API Client
│   │   └── seo.js          # SEO Helpers
│   ├── App.jsx             # React Router
│   ├── index.js            # Client Entry
│   └── index.css           # Tailwind
├── public/
│   ├── robots.txt
│   └── favicon.ico
├── package.json
└── craco.config.js
```

### 2.2 Package.json

**File: `/app/frontend/package.json`**

```json
{
  "name": "serien-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "craco start",
    "build": "craco build",
    "ssr": "node server/ssr.js",
    "start": "npm run ssr"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^6.28.0",
    "express": "^4.21.0",
    "axios": "^1.7.0",
    "marked": "^17.0.0",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "@craco/craco": "^7.1.0",
    "react-scripts": "5.0.1",
    "tailwindcss": "^3.4.17",
    "postcss": "^8.4.49",
    "autoprefixer": "^10.4.20"
  }
}
```

### 2.3 Express SSR Server (KERN-DATEI!)

**File: `/app/frontend/server/ssr.js`**

```javascript
const express = require('express');
const path = require('path');
const fs = require('fs');
const { renderToString } = require('react-dom/server');
const React = require('react');
const { StaticRouter } = require('react-router-dom/server');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Serve static files
app.use('/static', express.static(path.join(__dirname, '../build/static')));
app.use(express.static(path.join(__dirname, '../build')));

// SSR Cache (simple in-memory)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const item = cache.get(key);
  if (item && Date.now() < item.expires) {
    return item.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data, ttl = CACHE_TTL) {
  cache.set(key, { data, expires: Date.now() + ttl });
}

// Helper: Generate SEO Meta Tags
function generateMetaTags(data, url) {
  if (data.article) {
    const article = data.article;
    return `
      <title>${article.title} | serien.de</title>
      <meta name="description" content="${article.excerpt || ''}">
      <link rel="canonical" href="https://serien.de/${article.slug}/">
      <meta property="og:title" content="${article.title}">
      <meta property="og:description" content="${article.excerpt || ''}">
      <meta property="og:url" content="https://serien.de/${article.slug}/">
      <meta property="og:type" content="article">
      ${article.hero_image_url ? `<meta property="og:image" content="${article.hero_image_url}">` : ''}
      <meta name="twitter:card" content="summary_large_image">
      <script type="application/ld+json">
      ${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": article.title,
        "datePublished": article.published_at,
        "dateModified": article.updated_at,
        "author": { "@type": "Person", "name": "Redaktion" },
        "publisher": {
          "@type": "Organization",
          "name": "serien.de",
          "logo": { "@type": "ImageObject", "url": "https://serien.de/logo.png" }
        },
        "image": article.hero_image_url || "",
        "mainEntityOfPage": `https://serien.de/${article.slug}/`
      })}
      </script>
    `;
  }
  return `<title>serien.de | Serien-News & Updates</title>
          <meta name="description" content="Aktuelle News zu deinen Lieblings-Serien">`;
}

// SSR Routes
const SSR_ROUTES = [
  '/',
  '/news',
  '/serie/:id/',
  '/streamer/:slug',
  '/genre/:slug'
];

// Dynamic article route
app.get('/:slug/', async (req, res) => {
  const slug = req.params.slug;
  const cacheKey = `ssr:article:${slug}`;
  
  // Check cache
  const cached = getCached(cacheKey);
  if (cached) {
    return res.send(cached);
  }
  
  try {
    // Fetch article data
    const response = await axios.get(`${BACKEND_URL}/api/articles/${slug}`);
    const article = response.data;
    
    // Load React App component
    const App = require('../build/static/js/main.js').default || require('../src/App').default;
    
    // Render React
    const appHtml = renderToString(
      React.createElement(StaticRouter, { location: req.url },
        React.createElement(App, { initialData: { article } })
      )
    );
    
    // Generate full HTML
    const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${generateMetaTags({ article }, req.url)}
  <link rel="stylesheet" href="/static/css/main.css">
</head>
<body>
  <div id="root">${appHtml}</div>
  <script>window.__INITIAL_DATA__ = ${JSON.stringify({ article })};</script>
  <script src="/static/js/main.js"></script>
</body>
</html>`;
    
    // Cache for 5 minutes
    setCache(cacheKey, html);
    
    res.send(html);
  } catch (error) {
    console.error('SSR Error:', error);
    res.status(404).send('Article not found');
  }
});

// Static routes
SSR_ROUTES.forEach(route => {
  app.get(route, (req, res) => {
    const indexHtml = fs.readFileSync(path.join(__dirname, '../build/index.html'), 'utf8');
    res.send(indexHtml);
  });
});

// Sitemap routes (proxy to backend)
app.get('/sitemap.xml', async (req, res) => {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/sitemap/urls`);
    const data = response.data;
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    xml += '  <url><loc>https://serien.de/</loc><priority>1.0</priority></url>\n';
    
    data.articles.forEach(article => {
      xml += `  <url>\n`;
      xml += `    <loc>https://serien.de/${article.slug}/</loc>\n`;
      xml += `    <lastmod>${new Date(article.updated_at).toISOString()}</lastmod>\n`;
      xml += `  </url>\n`;
    });
    
    xml += '</urlset>';
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    res.status(500).send('Sitemap error');
  }
});

app.get('/news-sitemap.xml', async (req, res) => {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/sitemap/news-xml`);
    res.header('Content-Type', 'application/xml');
    res.send(response.data);
  } catch (error) {
    res.status(500).send('News sitemap error');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ssr: true });
});

// Fallback
app.get('*', (req, res) => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '../build/index.html'), 'utf8');
  res.send(indexHtml);
});

app.listen(PORT, () => {
  console.log(`🚀 SSR Server running on http://localhost:${PORT}`);
  console.log(`📡 Backend API: ${BACKEND_URL}`);
});
```

### 2.4 React App Setup

**File: `/app/frontend/src/App.jsx`**

```javascript
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ArticlePage from './pages/ArticlePage';
import NewsPage from './pages/NewsPage';

export default function App({ initialData = {} }) {
  return (
    <div className="min-h-screen bg-white">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:slug/" element={<ArticlePage initialData={initialData.article} />} />
        <Route path="/news" element={<NewsPage />} />
      </Routes>
    </div>
  );
}
```

**File: `/app/frontend/src/pages/ArticlePage.jsx`**

```javascript
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function ArticlePage({ initialData }) {
  const { slug } = useParams();
  const [article, setArticle] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  
  useEffect(() => {
    // If no initial data (client-side navigation), fetch it
    if (!initialData && slug) {
      axios.get(`${BACKEND_URL}/api/articles/${slug}`)
        .then(res => {
          setArticle(res.data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [slug, initialData]);
  
  if (loading) return <div className="p-8">Lädt...</div>;
  if (!article) return <div className="p-8">Artikel nicht gefunden</div>;
  
  return (
    <article className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{article.title}</h1>
        {article.excerpt && (
          <p className="text-xl text-gray-600">{article.excerpt}</p>
        )}
        {article.published_at && (
          <time className="text-sm text-gray-500">
            {new Date(article.published_at).toLocaleDateString('de-DE')}
          </time>
        )}
      </header>
      
      {article.hero_image_url && (
        <img 
          src={article.hero_image_url} 
          alt={article.title}
          className="w-full rounded-lg mb-8"
        />
      )}
      
      <div 
        className="prose prose-lg max-w-none"
        dangerouslySetInnerHTML={{ __html: article.content_html }}
      />
    </article>
  );
}
```

### 2.5 Tailwind Setup

**File: `/app/frontend/tailwind.config.js`**

```javascript
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

**File: `/app/frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 2.6 Environment

**File: `/app/frontend/.env`**

```bash
REACT_APP_BACKEND_URL=https://streamer-dev.preview.emergentagent.com
PORT=3000
```

### 2.7 Build & Run

```bash
# Install
cd /app/frontend
npm install

# Build React app
npm run build

# Start SSR server
npm run ssr

# Test
curl http://localhost:3000/
curl http://localhost:3000/sitemap.xml
```

---

## PHASE 3: Deployment & Integration [30 min]

### 3.1 Supervisor Configuration

**File: `/etc/supervisor/conf.d/serien.conf`**

```ini
[program:backend]
command=python server.py
directory=/app/backend
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisor/backend.out.log
stderr_logfile=/var/log/supervisor/backend.err.log

[program:ssr]
command=node server/ssr.js
directory=/app/frontend
autostart=true
autorestart=true
environment=NODE_ENV=production,REACT_APP_BACKEND_URL=https://streamer-dev.preview.emergentagent.com
stdout_logfile=/var/log/supervisor/ssr.out.log
stderr_logfile=/var/log/supervisor/ssr.err.log
```

### 3.2 Redis Installation

```bash
# Install Redis (if not present)
sudo apt-get update
sudo apt-get install redis-server -y
sudo systemctl start redis
sudo systemctl enable redis

# Test
redis-cli ping  # Should return PONG
```

### 3.3 Start Services

```bash
# Reload supervisor
sudo supervisorctl reread
sudo supervisorctl update

# Start all
sudo supervisorctl restart backend
sudo supervisorctl restart ssr

# Check status
sudo supervisorctl status
```

### 3.4 Testing Full Stack

```bash
# Backend
curl http://localhost:8001/api/health

# Frontend SSR
curl http://localhost:3000/health

# Sitemap
curl http://localhost:3000/sitemap.xml

# News Sitemap
curl http://localhost:3000/news-sitemap.xml
```

---

## PHASE 4: Seed Data & Testing [20 min]

### 4.1 Create Seed Data Script

**File: `/app/backend/seed_data.py`**

```python
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import asyncio
import os

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "serien_db")

async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Sample articles
    articles = [
        {
            "id": "1",
            "slug": "ist-black-rabbit-sehenswert-netflix",
            "title": "Ist Black Rabbit sehenswert? Netflix Serie Review",
            "excerpt": "Unsere ausführliche Review zur neuen Netflix Thriller-Serie Black Rabbit.",
            "content_html": "<p>Black Rabbit ist eine spannende neue Netflix-Serie...</p>",
            "hero_image_url": "https://image.tmdb.org/t/p/w780/example.jpg",
            "streamer": "netflix",
            "category": "review",
            "tags": ["thriller", "netflix", "2026"],
            "author_id": "admin",
            "published_at": datetime.utcnow() - timedelta(hours=2),
            "updated_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "status": "published",
            "reading_time": 5
        },
        {
            "id": "2",
            "slug": "breaking-bad-sequel-kommt-2026",
            "title": "Breaking Bad Sequel kommt 2026",
            "excerpt": "Vince Gilligan kündigt offiziell das Breaking Bad Sequel an.",
            "content_html": "<p>Nach Jahren der Spekulationen ist es offiziell...</p>",
            "streamer": "netflix",
            "category": "news",
            "tags": ["breaking-bad", "sequel", "2026"],
            "author_id": "admin",
            "published_at": datetime.utcnow() - timedelta(days=1),
            "updated_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "status": "published",
            "reading_time": 3
        }
    ]
    
    # Insert articles
    await db.articles.delete_many({})  # Clear existing
    await db.articles.insert_many(articles)
    
    print(f"✅ Seeded {len(articles)} articles")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed())
```

### 4.2 Run Seed

```bash
cd /app/backend
python seed_data.py
```

### 4.3 Test Complete Flow

```bash
# 1. Test Backend API
curl http://localhost:8001/api/articles | jq

# 2. Test SSR Rendering
curl http://localhost:3000/ist-black-rabbit-sehenswert-netflix/ | grep "Black Rabbit"

# 3. Test Sitemap
curl http://localhost:3000/sitemap.xml | grep "ist-black-rabbit"

# 4. Test Cache
curl -w "Time: %{time_total}s\n" http://localhost:3000/ist-black-rabbit-sehenswert-netflix/
# Run again - should be faster (cached)
curl -w "Time: %{time_total}s\n" http://localhost:3000/ist-black-rabbit-sehenswert-netflix/
```

---

## FINAL CHECKLIST

✅ **Backend (FastAPI):**
- [ ] Articles API funktioniert
- [ ] TMDB Service funktioniert
- [ ] Redis Cache funktioniert
- [ ] Sitemaps API funktioniert

✅ **Frontend (React SSR):**
- [ ] Express Server läuft auf Port 3000
- [ ] SSR für Artikel-Seiten funktioniert
- [ ] Client-Side Hydration funktioniert
- [ ] Sitemap.xml generiert korrekt
- [ ] News-Sitemap.xml generiert korrekt

✅ **Integration:**
- [ ] Backend + Frontend kommunizieren
- [ ] Cache-Layer funktioniert (5 Min TTL)
- [ ] SEO Meta Tags werden generiert
- [ ] JSON-LD Schema wird eingebettet

✅ **Deployment:**
- [ ] Supervisor läuft beide Services
- [ ] Redis läuft
- [ ] MongoDB läuft
- [ ] Preview URL funktioniert

---

## SUCCESS CRITERIA

1. **SSR funktioniert:** `view-source:http://localhost:3000/artikel-slug/` zeigt vollständigen HTML Content
2. **SEO Tags vorhanden:** HTML enthält `<title>`, Meta Tags, JSON-LD
3. **Sitemaps gültig:** XML validiert bei validator.w3.org
4. **Cache funktioniert:** Zweiter Request ist schneller
5. **News-Sitemap:** Enthält nur Artikel der letzten 48h

---

## DEPLOYMENT URL

Nach erfolgreichem Setup:
- Preview: https://streamer-dev.preview.emergentagent.com
- Backend: https://streamer-dev.preview.emergentagent.com/api
- Sitemap: https://streamer-dev.preview.emergentagent.com/sitemap.xml

---

## GESCHÄTZTE ZEIT

- Phase 1 (Backend): 60 min
- Phase 2 (Frontend): 90 min
- Phase 3 (Deployment): 30 min
- Phase 4 (Testing): 20 min

**Total: ~3.5 Stunden**

---

## SUPPORT

Bei Problemen:
- Backend Logs: `tail -f /var/log/supervisor/backend.err.log`
- SSR Logs: `tail -f /var/log/supervisor/ssr.err.log`
- Redis Status: `redis-cli ping`
- MongoDB Status: `mongo --eval "db.stats()"`

---

**Ende der Anweisungen. Folge jedem Schritt exakt!**
