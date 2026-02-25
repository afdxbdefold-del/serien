# serien - German TV Series News Platform

**Project Name:** serien  
**Full Name:** serien.de  
**Version:** 1.0.0  
**Type:** Full-stack web application

## Description
German TV series news platform with SSR for SEO, Google News integration, user authentication, and content management.

## Tech Stack
- **Frontend:** React 19, React Router, Shadcn UI
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **SSR:** Express.js
- **Deployment:** Emergent Platform

## Key Features
- Server-Side Rendering (SSR) for SEO
- News crawler (thecinemaholics)
- German series import (TMDB API)
- User authentication (Email + Google OAuth)
- Admin panel with crawler management
- Google News compliance tools
- Personalized feeds and follows

## Admin Access
- Username: `admin`
- Password: `Admin2026!Serien`
- URL: `/admin`

## Project Structure
```
/app/
├── backend/          # FastAPI backend
│   ├── routes/       # API routes
│   ├── models/       # Data models
│   ├── crawler/      # News & series crawlers
│   └── server.py     # Main application
├── frontend/         # React frontend
│   ├── src/
│   │   ├── pages/    # Page components
│   │   ├── components/ # UI components
│   │   └── App.js    # Main app
│   └── ssr-server-root.js  # SSR Express server
└── README.md         # This file
```

## Development
- Backend: `http://localhost:8001`
- Frontend: `http://localhost:3000`
- SSR: Port 3000 (production)
- Admin Panel: `http://localhost:3000/admin`

## Documentation
- `/app/DEPLOYMENT.md` - Deployment guide
- `/app/GOOGLE_NEWS_GUIDE.md` - Google News submission
- `/app/CRAWLER_README.md` - Crawler documentation

## Status
✅ Full-stack application complete  
✅ SSR implemented (local)  
⏳ Waiting for Emergent Ingress update (SSR on live URL)  
✅ Admin panel complete  
✅ Ready for Google News submission
