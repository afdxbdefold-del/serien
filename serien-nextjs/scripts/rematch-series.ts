/**
 * SERIES RE-MATCHER
 * 
 * Re-processes articles without series assignment with improved matching logic
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { searchTvEnhanced } from '../lib/tmdb-search-enhanced';
import { getTvDetailsComplete } from '../lib/tmdb';

const prisma = new PrismaClient();

// Common German series name patterns to extract
const SERIES_PATTERNS = [
  // "Serie XYZ" patterns
  /(?:Netflix[- ]?Serie|Amazon[- ]?Serie|Serie)\s+[„""]([^„""]+)[„""]/gi,
  /(?:Netflix[- ]?Serie|Amazon[- ]?Serie|Serie)\s+([A-Z][a-zA-Z0-9\s:'-]+)/g,
  
  // "XYZ Staffel N" patterns
  /[„""]([^„""]+)[„""]\s+Staffel\s+\d+/gi,
  /([A-Z][a-zA-Z0-9\s:'-]+)\s+Staffel\s+\d+/g,
  
  // Quoted titles
  /[„""]([^„""]{3,40})[„""]/g,
  
  // "aus XYZ" patterns
  /aus\s+(?:der\s+(?:Netflix[- ]?)?Serie\s+)?[„""]([^„""]+)[„""]/gi,
  /aus\s+[„""]([^„""]+)[„""]/gi,
];

// Known series name mappings for common mismatches
const SERIES_NAME_FIXES: Record<string, string> = {
  'The Witcher': 'The Witcher',
  'Witcher': 'The Witcher',
  'Haus des Geldes': 'Haus des Geldes',
  'Money Heist': 'Haus des Geldes',
  'Squid Game': 'Squid Game',
  'Stranger Things': 'Stranger Things',
  'Breaking Bad': 'Breaking Bad',
  'Game of Thrones': 'Game of Thrones',
  'GoT': 'Game of Thrones',
  'The Boys': 'The Boys',
  'Ozark': 'Ozark',
  'Dark': 'Dark',
  'Bridgerton': 'Bridgerton',
  'Emily in Paris': 'Emily in Paris',
  'Outer Banks': 'Outer Banks',
  'OBX': 'Outer Banks',
  'Prison Break': 'Prison Break',
  'Lucifer': 'Lucifer',
  'You': 'You',
  'Cobra Kai': 'Cobra Kai',
  'Wednesday': 'Wednesday',
  'The Crown': 'The Crown',
  'Peaky Blinders': 'Peaky Blinders',
  'Vikings': 'Vikings',
  'The Mandalorian': 'The Mandalorian',
  'Loki': 'Loki',
  'WandaVision': 'WandaVision',
  'Hawkeye': 'Hawkeye',
  'Moon Knight': 'Moon Knight',
  'She-Hulk': 'She-Hulk',
  'Arcane': 'Arcane',
  'Invincible': 'Invincible',
  'The Walking Dead': 'The Walking Dead',
  'TWD': 'The Walking Dead',
  'Better Call Saul': 'Better Call Saul',
  'Yellowstone': 'Yellowstone',
  'Succession': 'Succession',
  'Ted Lasso': 'Ted Lasso',
  'The Last of Us': 'The Last of Us',
  'TLOU': 'The Last of Us',
  'House of the Dragon': 'House of the Dragon',
  'HotD': 'House of the Dragon',
  'Rings of Power': 'The Lord of the Rings: The Rings of Power',
  'Greys Anatomy': "Grey's Anatomy",
  'Grey\'s Anatomy': "Grey's Anatomy",
  'NCIS': 'NCIS',
  'Criminal Minds': 'Criminal Minds',
  'The Blacklist': 'The Blacklist',
  'Suits': 'Suits',
  'How I Met Your Mother': 'How I Met Your Mother',
  'HIMYM': 'How I Met Your Mother',
  'Friends': 'Friends',
  'The Office': 'The Office',
  'Brooklyn Nine-Nine': 'Brooklyn Nine-Nine',
  'B99': 'Brooklyn Nine-Nine',
  'Schitt\'s Creek': "Schitt's Creek",
  'Euphoria': 'Euphoria',
  'Big Little Lies': 'Big Little Lies',
  'True Detective': 'True Detective',
  'Mindhunter': 'Mindhunter',
  'Narcos': 'Narcos',
  'La Casa de Papel': 'Haus des Geldes',
  'Elite': 'Elite',
  'Lupin': 'Lupin',
  'Berlin': 'Berlin',
  'All of Us Are Dead': 'All of Us Are Dead',
  'Hellbound': 'Hellbound',
  'Sense8': 'Sense8',
  'Black Mirror': 'Black Mirror',
  'Love Death Robots': 'Love, Death & Robots',
  'Altered Carbon': 'Altered Carbon',
  'The 100': 'The 100',
  'The Expanse': 'The Expanse',
  'Foundation': 'Foundation',
  'Severance': 'Severance',
  'Yellowjackets': 'Yellowjackets',
  'Killing Eve': 'Killing Eve',
  'Fleabag': 'Fleabag',
  'Chernobyl': 'Chernobyl',
  'Band of Brothers': 'Band of Brothers',
  'The Sopranos': 'The Sopranos',
  'The Wire': 'The Wire',
  'Mad Men': 'Mad Men',
  'Dexter': 'Dexter',
  'Lost': 'Lost',
  'Heroes': 'Heroes',
  'Supernatural': 'Supernatural',
  'Vampire Diaries': 'The Vampire Diaries',
  'Teen Wolf': 'Teen Wolf',
  'Riverdale': 'Riverdale',
  'Gossip Girl': 'Gossip Girl',
  'Pretty Little Liars': 'Pretty Little Liars',
  'Shadowhunters': 'Shadowhunters',
  'Titans': 'Titans',
  'Doom Patrol': 'Doom Patrol',
  'Swamp Thing': 'Swamp Thing',
  'Batwoman': 'Batwoman',
  'Superman & Lois': 'Superman & Lois',
  'The Flash': 'The Flash',
  'Arrow': 'Arrow',
  'Supergirl': 'Supergirl',
  'Legends of Tomorrow': "DC's Legends of Tomorrow",
};

/**
 * Extract series names from title and content with improved logic
 */
function extractSeriesNames(title: string, content: string): string[] {
  const candidates: Set<string> = new Set();
  const text = title + ' ' + content.substring(0, 2000);
  
  // Apply all patterns
  for (const pattern of SERIES_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[1] && match[1].length >= 3 && match[1].length <= 50) {
        candidates.add(match[1].trim());
      }
    }
  }
  
  // Check for known series names in title
  for (const [key, value] of Object.entries(SERIES_NAME_FIXES)) {
    if (title.toLowerCase().includes(key.toLowerCase()) || 
        text.toLowerCase().includes(key.toLowerCase())) {
      candidates.add(value);
    }
  }
  
  // Extract from title patterns like "SeriesName: ..." or "SeriesName Staffel"
  const titleMatch = title.match(/^([A-Za-zÄÖÜäöüß0-9\s:'-]+?)(?:\s*[:–-]\s*|\s+Staffel|\s+Season|\s+Ende|\s+Review|\s+Trailer)/i);
  if (titleMatch && titleMatch[1].length >= 3 && titleMatch[1].length <= 40) {
    candidates.add(titleMatch[1].trim());
  }
  
  return Array.from(candidates).filter(c => 
    c.length >= 3 && 
    !c.includes('<') && 
    !c.includes('>') &&
    !c.toLowerCase().includes('netflix') &&
    !c.toLowerCase().includes('amazon') &&
    !c.toLowerCase().includes('staffel') &&
    !c.toLowerCase().includes('season')
  );
}

/**
 * Try to match article to series
 */
async function matchArticleToSeries(article: any): Promise<{
  seriesId: number;
  seriesName: string;
  confidence: number;
} | null> {
  // First try enhanced TMDB search
  const tmdbResult = await searchTvEnhanced(article.title, article.contentHtml || '');
  
  if (tmdbResult && tmdbResult.confidence >= 0.7) {
    // Check if series exists
    const existing = await prisma.series.findUnique({
      where: { tmdbId: tmdbResult.tmdbId }
    });
    
    if (existing) {
      return {
        seriesId: existing.tmdbId,
        seriesName: existing.name,
        confidence: tmdbResult.confidence
      };
    }
    
    // Create new series
    try {
      const details = await getTvDetailsComplete(tmdbResult.tmdbId, 'de-DE');
      if (details) {
        const slug = details.name
          .toLowerCase()
          .replace(/[äöü]/g, (c: string) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[c] || c))
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        
        const genreNames = (details.genres || []).map((g: any) => typeof g === 'string' ? g : g.name);
        const networkNames = (details.networks || []).map((n: any) => typeof n === 'string' ? n : n.name);
        
        await prisma.series.create({
          data: {
            tmdbId: tmdbResult.tmdbId,
            name: details.name,
            title: details.name,
            slug,
            posterPath: details.posterPath,
            backdropPath: details.backdropPath,
            overview: details.overview,
            firstAirDate: details.firstAirDate ? new Date(details.firstAirDate) : null,
            genres: genreNames,
            networks: networkNames,
            status: details.status,
            voteAverage: details.voteAverage,
            popularity: details.popularity,
            updatedAt: new Date(),
          }
        });
        
        console.log(`   📺 Neue Serie: ${details.name}`);
        
        return {
          seriesId: tmdbResult.tmdbId,
          seriesName: details.name,
          confidence: tmdbResult.confidence
        };
      }
    } catch (e: any) {
      if (!e.message.includes('Unique constraint')) {
        console.log(`   ⚠️  ${e.message}`);
      }
    }
  }
  
  // Try extracted names with lower threshold
  const names = extractSeriesNames(article.title, article.contentHtml || '');
  
  for (const name of names) {
    // Check if we have this series by name
    const existingByName = await prisma.series.findFirst({
      where: {
        OR: [
          { name: { contains: name, mode: 'insensitive' } },
          { title: { contains: name, mode: 'insensitive' } }
        ]
      }
    });
    
    if (existingByName) {
      return {
        seriesId: existingByName.tmdbId,
        seriesName: existingByName.name,
        confidence: 0.75
      };
    }
  }
  
  return null;
}

/**
 * Main re-matching function
 */
async function rematchSeries() {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 SERIES RE-MATCHER');
  console.log('='.repeat(60));
  
  // Get articles without series
  const articles = await prisma.articles.findMany({
    where: { contentType: 'IMPORTED' },
    select: {
      id: true,
      slug: true,
      title: true,
      contentHtml: true,
    },
    orderBy: { publishedAt: 'desc' }
  });
  
  console.log(`📋 ${articles.length} Artikel ohne Serie gefunden\n`);
  
  let matched = 0;
  let failed = 0;
  
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const progress = `[${i + 1}/${articles.length}]`;
    
    process.stdout.write(`${progress} ${article.slug.substring(0, 50)}...`);
    
    try {
      const match = await matchArticleToSeries(article);
      
      if (match) {
        // Update article
        await prisma.articles.update({
          where: { id: article.id },
          data: {
            primarySeriesId: match.seriesId,
            tmdbId: match.seriesId,
            tmdbType: 'tv',
            contentType: 'IMPORTED_WITH_SERIES'
          }
        });
        
        matched++;
        console.log(` ✅ ${match.seriesName} (${(match.confidence * 100).toFixed(0)}%)`);
      } else {
        console.log(' ❌');
      }
    } catch (e: any) {
      failed++;
      console.log(` ⚠️ ${e.message.substring(0, 50)}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 ERGEBNIS');
  console.log('='.repeat(60));
  console.log(`Verarbeitet:  ${articles.length}`);
  console.log(`Neu gematcht: ${matched}`);
  console.log(`Fehlerhaft:   ${failed}`);
  console.log('='.repeat(60));
  
  await prisma.$disconnect();
}

rematchSeries().catch(console.error);
