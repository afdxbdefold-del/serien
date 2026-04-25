# Emergent-Only SSR - Projekt-Anweisungen

## 🎯 Ziel: serien.de mit nativem Emergent Stack

Statt Next.js + Vercel + Neon → **React SSR + FastAPI + MongoDB** (alles in Emergent)

---

## 📋 Stack-Vergleich

| Feature | Next.js/Vercel Setup | Emergent-Only Setup |
|---------|---------------------|---------------------|
| **Frontend** | Next.js 15 App Router | React 19 + Express SSR |
| **Backend** | Serverless Functions | FastAPI (Python) |
| **Database** | Neon Postgres | MongoDB (lokal) |
| **Deployment** | Vercel | Emergent Native |
| **Routing** | Next.js Router | React Router v6 |
| **SSR** | Built-in | Express + ReactDOMServer |
| **ISR** | Built-in | Custom Cache Layer |
| **ORM** | Prisma | Motor (MongoDB) |

---

## 🏗️ Architektur (Emergent-Only)

```
/app/
├── backend/
│   ├── routes/
│   │   ├── articles.py         # News-Artikel API
│   │   ├── series.py           # TMDB Series API
│   │   ├── sitemaps.py         # Sitemap Generation
│   │   └── admin.py            # Admin Panel API
│   ├── models/
│   │   ├── article.py          # Pydantic Models
│   │   └── series.py
│   ├── services/
│   │   ├── tmdb.py             # TMDB Integration
│   │   └── cache.py            # Redis Cache Layer
│   └── server.py               # FastAPI Main
│
└── frontend/
    ├── src/
    │   ├── pages/              # Route Components
    │   │   ├── HomePage.jsx
    │   │   ├── ArticlePage.jsx
    │   │   ├── NewsPage.jsx
    │   │   └── SeriesPage.jsx
    │   ├── components/         # React Components
    │   ├── utils/
    │   │   ├── api.js          # API Client
    │   │   └── seo.js          # SEO Helpers
    │   ├── App.jsx             # React Router Setup
    │   └── index.js            # Client Entry
    │
    ├── server/
    │   ├── ssr.js              # Express SSR Server
    │   ├── render.js           # React Rendering
    │   └── cache.js            # SSR Cache Layer
    │
    └── public/
        ├── sitemap.xml         # Static Sitemap
        └── robots.txt          # Static Robots
```

---

## 📝 Anweisungen für nächsten Task/Agent

### **Phase 1: Backend Setup (FastAPI + MongoDB)**

```markdown
**Aufgabe:** Erstelle eine FastAPI Backend mit MongoDB für serien.de

**Tech Stack:**
- FastAPI (Python)
- MongoDB (lokal, bereits in Emergent)
- Motor (async MongoDB driver)
- Pydantic für Validation

**Database Schema (MongoDB Collections):**

1. **users**
```python
{
    "id": str,  # UUID
    "name": str,
    "email": str (unique),
    "password_hash": str,  # bcrypt
    "created_at": datetime
}
```

2. **series**
```python
{
    "tmdb_id": int (unique),
    "title": str,
    "slug": str (unique),
    "overview": str,
    "poster_url": str,  # TMDB direct URL
    "backdrop_url": str,
    "genres": [str],
    "networks": [str],
    "tmdb_data": dict,  # Full TMDB response
    "updated_at": datetime
}
```

3. **articles**
```python
{
    "id": str,  # UUID
    "slug": str (unique),
    "title": str,
    "excerpt": str,
    "content_html": str,
    "hero_image_url": str,
    "streamer": str,  # netflix, disney, etc.
    "category": str,
    "tags": [str],
    "tmdb_series_id": int (nullable),
    "author_id": str,
    "published_at": datetime,
    "status": str,  # draft, published
    "reading_time": int,
    "created_at": datetime,
    "updated_at": datetime
}
```

**API Endpoints:**

```python
# Articles
GET  /api/articles?limit=20&page=1&status=published
GET  /api/articles/{slug}
POST /api/articles (admin)
PUT  /api/articles/{slug} (admin)

# Series
GET  /api/series?search=breaking+bad
GET  /api/series/{tmdb_id}
POST /api/series/import/{tmdb_id}  # Import from TMDB

# Sitemaps (for SSR server)
GET  /api/sitemap/urls  # Returns all URLs for sitemap
GET  /api/sitemap/news  # Last 48h for Google News

# TMDB Integration
GET  /api/tmdb/search?q=series+name
GET  /api/tmdb/series/{tmdb_id}
```

**TMDB Integration:**
- API Key: bereits vorhanden (YOUR_TMDB_API_KEY_HERE)
- Bilder: Verwende TMDB URLs direkt (kein lokales Speichern)
- Cache TMDB responses in MongoDB (series.tmdb_data)

**Caching:**
- Implementiere Redis-Cache für häufige Queries
- Cache-Keys: `articles:list:page:1`, `article:{slug}`, `series:{tmdb_id}`
- TTL: 5 Minuten für Artikel, 24h für Series

**Testing:**
Nach Implementierung: Teste mit curl alle Endpoints
```

---

### **Phase 2: Frontend Setup (React + SSR)**

```markdown
**Aufgabe:** Erstelle React Frontend mit Express SSR

**Tech Stack:**
- React 19
- React Router v6 (für Routing)
- Express (SSR Server)
- Tailwind CSS

**SSR Server (`frontend/server/ssr.js`):**

```javascript
const express = require('express');
const { renderToPipeableStream } = require('react-dom/server');
const { StaticRouter } = require('react-router-dom/server');
const App = require('../src/App');

const app = express();
const PORT = 3000;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Serve static files
app.use(express.static('build'));

// SSR Routes
const SSR_ROUTES = ['/', '/:slug/', '/news', '/serie/:id/', '/streamer/:slug', '/genre/:slug'];

app.get(SSR_ROUTES, async (req, res) => {
  const url = req.url;
  
  // Fetch data for SSR (optional)
  let initialData = {};
  if (url.match(/^\/[^/]+\/$/)) {
    // Article page
    const slug = url.replace(/\//g, '');
    try {
      const response = await fetch(`${BACKEND_URL}/api/articles/${slug}`);
      initialData.article = await response.json();
    } catch (e) {
      console.error('SSR data fetch failed:', e);
    }
  }
  
  // Render React to Stream
  const { pipe } = renderToPipeableStream(
    <StaticRouter location={url}>
      <App initialData={initialData} />
    </StaticRouter>,
    {
      onShellReady() {
        res.setHeader('Content-Type', 'text/html');
        
        // Send HTML head
        res.write(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${generateMetaTags(initialData)}
  <link rel="stylesheet" href="/static/css/main.css">
</head>
<body>
  <div id="root">`);
        
        // Stream React content
        pipe(res);
      },
      onAllReady() {
        res.write(`</div>
  <script>window.__INITIAL_DATA__ = ${JSON.stringify(initialData)};</script>
  <script src="/static/js/main.js"></script>
</body>
</html>`);
        res.end();
      }
    }
  );
});

app.listen(PORT);
```

**React Router Setup (`src/App.jsx`):**

```javascript
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ArticlePage from './pages/ArticlePage';
import NewsPage from './pages/NewsPage';
import SeriesPage from './pages/SeriesPage';

export default function App({ initialData = {} }) {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/:slug/" element={<ArticlePage initialData={initialData.article} />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/serie/:id/" element={<SeriesPage />} />
      {/* Add more routes */}
    </Routes>
  );
}
```

**SEO Implementation (`src/utils/seo.js`):**

```javascript
export function generateMetaTags(data) {
  if (data.article) {
    return `
      <title>${data.article.title} | serien.de</title>
      <meta name="description" content="${data.article.excerpt}">
      <link rel="canonical" href="https://serien.de/${data.article.slug}/">
      <meta property="og:title" content="${data.article.title}">
      <meta property="og:description" content="${data.article.excerpt}">
      <meta property="og:image" content="${data.article.hero_image_url}">
      <script type="application/ld+json">
      ${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": data.article.title,
        "datePublished": data.article.published_at,
        "author": { "@type": "Person", "name": "Redaktion" }
      })}
      </script>
    `;
  }
  return '<title>serien.de | Serien-News</title>';
}
```

**Sitemap Generation (Backend):**

```python
# backend/routes/sitemaps.py
from fastapi import APIRouter
from fastapi.responses import Response

router = APIRouter()

@router.get("/api/sitemap/xml")
async def sitemap_xml():
    articles = await db.articles.find({"status": "published"}).to_list(1000)
    
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    
    # Home
    xml += f'  <url><loc>https://serien.de/</loc><priority>1.0</priority></url>\n'
    
    # Articles
    for article in articles:
        xml += f'  <url>\n'
        xml += f'    <loc>https://serien.de/{article["slug"]}/</loc>\n'
        xml += f'    <lastmod>{article["updated_at"].isoformat()}</lastmod>\n'
        xml += f'  </url>\n'
    
    xml += '</urlset>'
    
    return Response(content=xml, media_type="application/xml")
```

**Testing:**
- Teste SSR: `curl http://localhost:3000/test-artikel/` (sollte HTML mit Content zeigen)
- Teste Client-Hydration: Öffne im Browser, React sollte übernehmen
```

---

### **Phase 3: Deployment (Emergent Native)**

```markdown
**Aufgabe:** Deploy auf Emergent (kein Vercel)

**Emergent Deployment:**
- Alles läuft in einem Container
- Frontend SSR Server: Port 3000
- Backend API: Port 8001
- MongoDB: localhost:27017

**Supervisor Config (bereits vorhanden):**
```ini
[program:ssr]
command=node /app/frontend/server/ssr.js
directory=/app/frontend
autostart=true
autorestart=true

[program:backend]
command=uvicorn server:app --host 0.0.0.0 --port 8001
directory=/app/backend
autostart=true
autorestart=true
```

**Environment Variables:**
```bash
# frontend/.env
REACT_APP_BACKEND_URL=https://discover-seo-hub.preview.emergentagent.com

# backend/.env
MONGO_URL=mongodb://localhost:27017
DB_NAME=serien_db
TMDB_API_KEY=YOUR_TMDB_API_KEY_HERE
```

**Deployment-Workflow:**
1. Code committen → Git
2. "Deploy" Button in Emergent UI
3. Container wird neu deployed
4. Preview URL: https://discover-seo-hub.preview.emergentagent.com

**Kein Vercel, kein externes Hosting nötig!**
```

---

## 🎯 Hauptunterschiede zu Next.js

| Feature | Next.js | Emergent-Only |
|---------|---------|---------------|
| **Setup-Zeit** | Schneller (1-2h) | Länger (3-4h) |
| **SSR** | Automatisch | Manuell implementieren |
| **ISR** | Built-in | Custom Cache-Layer |
| **API Routes** | Built-in | Separate FastAPI |
| **Deployment** | Vercel (easy) | Emergent (manuell) |
| **Database** | Postgres (Neon) | MongoDB (lokal) |
| **Komplexität** | Low | Medium |
| **Kontrolle** | Medium | High |
| **Kosten** | Vercel Hosting | Emergent Hosting only |

---

## ✅ Vorteile Emergent-Only

1. **Alles in einem Container** - keine externen Dependencies
2. **Volle Kontrolle** über SSR-Logik
3. **Python Backend** - flexibler für komplexe Logik
4. **MongoDB** - bereits in Emergent integriert
5. **Kein Vendor Lock-in** - kein Vercel, kein Neon
6. **Kosteneffizienter** - nur Emergent Hosting

## ⚠️ Nachteile Emergent-Only

1. **Mehr Arbeit** - SSR manuell implementieren
2. **Kein ISR** - muss selbst gebaut werden
3. **Mehr Code** - mehr Boilerplate
4. **Wartung** - mehr zu pflegen
5. **Scaling** - manuelle Optimierung nötig

---

## 📋 Task-Anweisung für nächsten Agent

**Kopiere diese Anweisung:**

```
Erstelle serien.de mit Emergent-Only Stack:

**Stack:**
- React 19 + Express SSR (Frontend)
- FastAPI + MongoDB (Backend)
- Tailwind CSS (Styling)
- TMDB API (Datenquelle)

**Anforderungen:**
1. Backend: FastAPI mit MongoDB (3 Collections: users, series, articles)
2. Frontend: React mit Express SSR Server
3. Routing: React Router v6
4. SEO: Server-side Meta Tags + JSON-LD Schema
5. Sitemaps: /sitemap.xml + /news-sitemap.xml (48h)
6. TMDB: Integration für Series-Daten
7. Deployment: Native Emergent (kein Vercel)

**URL-Struktur:**
- / (Home)
- /{slug}/ (Artikel - SSR!)
- /news (News Index)
- /serie/{tmdb_id}-{slug}/ (Series Page)

**Wichtig:**
- SSR für Artikel-Seiten (SEO!)
- Robots.txt + Sitemaps
- JSON-LD NewsArticle Schema
- Cache-Layer für Performance

Referenz-Dokumentation: Siehe /app/frontend/EMERGENT_SSR_GUIDE.md
```

---

## 🔗 Weitere Ressourcen

**Emergent Docs:**
- SSR mit React: [Emergent Docs]
- FastAPI Setup: [Emergent Docs]
- MongoDB Integration: [Emergent Docs]

**Vergleich:**
- Next.js: Schneller Start, weniger Kontrolle
- Emergent-Only: Mehr Arbeit, volle Kontrolle

---

**Empfehlung:** Für schnellen Prototyp → Next.js. Für volle Kontrolle → Emergent-Only.
