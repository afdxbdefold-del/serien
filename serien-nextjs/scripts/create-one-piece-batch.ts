/**
 * Batch create multiple One Piece articles with different themes
 */

import { PrismaClient } from '@prisma/client';
import { markdownToHtml } from '../lib/markdown-to-html';

const prisma = new PrismaClient();

const ARTICLE_TOPICS = [
  {
    title: "One Piece Staffel 2: Release, Besetzung und alle Infos zur Netflix-Fortsetzung",
    focus: "Staffel 2 der Live-Action Serie - Bestätigter Release, neue Charaktere wie Chopper, Vivi und die Baroque Works Saga"
  },
  {
    title: "One Piece Live-Action vs. Anime: Die größten Unterschiede erklärt", 
    focus: "Vergleich zwischen Netflix Live-Action und dem Original-Anime, was wurde geändert, was beibehalten"
  },
  {
    title: "Die Strohhut-Piraten: Alle Crew-Mitglieder und ihre Hintergrundgeschichten",
    focus: "Komplette Übersicht aller Strohhut-Piraten: Ruffy, Zoro, Nami, Usopp, Sanji - ihre Träume und Backstories"
  },
  {
    title: "One Piece Anime: Der ultimative Einstiegs-Guide für Neulinge",
    focus: "Wie man in die über 1100 Episoden einsteigt, welche Arcs wichtig sind, Filler-Guide"
  }
];

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function generateArticleContent(title: string, focus: string): Promise<{ html: string; excerpt: string; qa: any[] }> {
  const emergentApiKey = process.env.EMERGENT_LLM_KEY;
  if (!emergentApiKey) throw new Error('EMERGENT_LLM_KEY not found');
  
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({
    apiKey: emergentApiKey,
    baseURL: 'http://localhost:8002/v1',
  });

  const prompt = `Du bist ein erfahrener deutscher Entertainment-Journalist. Schreibe einen ausführlichen, informativen Artikel auf Deutsch.

TITEL: ${title}

FOKUS: ${focus}

WICHTIG:
- Schreibe mindestens 600 Wörter
- Nutze die Markdown-Struktur mit ## für Überschriften
- Erwähne wichtige Charaktere wie: Monkey D. Ruffy, Roronoa Zoro, Nami, Usopp, Sanji, Tony Tony Chopper, Nico Robin
- Erwähne Schauspieler bei Live-Action Themen: Iñaki Godoy (Ruffy), Mackenyu (Zoro), Emily Rudd (Nami), Jacob Romero Gibson (Usopp), Taz Skylar (Sanji)
- Schreibe professionell aber unterhaltsam
- Füge relevante Fakten und Details hinzu
- Erkläre Begriffe für Neulinge

FORMAT:
Beginne direkt mit dem Artikel-Text (keine Überschrift am Anfang, die kommt separat).
Strukturiere mit ## Zwischenüberschriften.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 2000
  });

  const content = response.choices[0]?.message?.content || '';
  
  // Generate excerpt
  const excerptPrompt = `Schreibe eine kurze, packende Zusammenfassung (max. 160 Zeichen) für diesen Artikel:\n\n${content.substring(0, 500)}`;
  
  const excerptResponse = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [{ role: 'user', content: excerptPrompt }],
    max_tokens: 100
  });
  
  const excerpt = excerptResponse.choices[0]?.message?.content?.trim() || '';
  
  // Generate Q&A
  const qaPrompt = `Basierend auf diesem Artikel, erstelle 3 häufig gestellte Fragen mit kurzen Antworten im JSON-Format:
[{"question": "...", "answer": "..."}]

Artikel: ${content.substring(0, 1000)}`;

  const qaResponse = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [{ role: 'user', content: qaPrompt }],
    max_tokens: 500
  });
  
  let qa: any[] = [];
  try {
    const qaText = qaResponse.choices[0]?.message?.content || '[]';
    const jsonMatch = qaText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      qa = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.log('   ⚠️ Could not parse Q&A');
  }

  const html = await markdownToHtml(content);
  
  return { html, excerpt, qa };
}

async function main() {
  console.log('🎬 Creating One Piece Article Batch\n');
  
  // Find One Piece series
  const series = await prisma.series.findFirst({
    where: { tmdbId: 111110 }
  });
  
  if (!series) {
    console.log('❌ One Piece series not found');
    return;
  }
  
  console.log(`📺 Series: ${series.name} (ID: ${series.id})\n`);
  
  // Get random author
  const authors = await prisma.users.findMany({ take: 5 });
  
  let created = 0;
  
  for (const topic of ARTICLE_TOPICS) {
    const slug = generateSlug(topic.title);
    
    // Check if exists
    const existing = await prisma.articles.findFirst({
      where: { slug }
    });
    
    if (existing) {
      console.log(`⏭️  Skipping (exists): ${topic.title.substring(0, 50)}...`);
      continue;
    }
    
    console.log(`\n📝 Creating: ${topic.title.substring(0, 60)}...`);
    
    try {
      const { html, excerpt, qa } = await generateArticleContent(topic.title, topic.focus);
      
      const author = authors[Math.floor(Math.random() * authors.length)];
      
      await prisma.articles.create({
        data: {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          slug,
          title: topic.title,
          contentHtml: html,
          excerpt,
          status: 'published',
          contentType: 'NEWS',
          authorId: author?.id,
          primarySeriesId: series.tmdbId, // Use tmdbId, not series.id!
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          heroImageUrl: series.backdropPath 
            ? `https://image.tmdb.org/t/p/original${series.backdropPath}`
            : null,
          heroLocalUrl: series.backdropPath
            ? `https://image.tmdb.org/t/p/w1280${series.backdropPath}`
            : null,
          cardImageUrl: series.posterPath
            ? `https://image.tmdb.org/t/p/w500${series.posterPath}`
            : null,
          heroVideoUrl: 'https://www.youtube.com/watch?v=Ades3pQbeh8', // One Piece S2 Teaser
        }
      });
      
      console.log(`   ✅ Created: ${slug}`);
      created++;
      
      // Small delay between articles
      await new Promise(r => setTimeout(r, 2000));
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log(`\n🎉 Created ${created} new articles`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
