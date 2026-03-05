#!/usr/bin/env tsx
/**
 * Generate professional, SEO-optimized author bios
 * E-E-A-T focused (Experience, Expertise, Authoritativeness, Trustworthiness)
 */

import { PrismaClient } from '@prisma/client';
import { spawn } from 'child_process';
import { promisify } from 'util';

const prisma = new PrismaClient();

const execPython = promisify((command: string, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
  const proc = spawn('python3', ['-c', command]);
  let stdout = '';
  let stderr = '';
  
  proc.stdout.on('data', (data) => { stdout += data; });
  proc.stderr.on('data', (data) => { stderr += data; });
  
  proc.on('close', (code) => {
    if (code !== 0) {
      callback(new Error(`Python process exited with code ${code}\n${stderr}`), stdout, stderr);
    } else {
      callback(null, stdout, stderr);
    }
  });
});

interface AuthorData {
  id: string;
  name: string;
  email: string;
  articleCount: number;
  recentTopics: string[];
}

/**
 * Generate E-E-A-T optimized bio for an author using Python LLM integration
 */
async function generateAuthorBio(author: AuthorData): Promise<{ bio: string; expertise: string[] }> {
  const prompt = `Du bist ein professioneller Content-Writer, der SEO-optimierte Autoren-Biografien für eine Serien-News-Website erstellt.

AUTOR-INFORMATIONEN:
- Name: ${author.name}
- Email: ${author.email}
- Anzahl Artikel: ${author.articleCount}
- Themen: ${author.recentTopics.join(', ')}

AUFGABE:
Schreibe eine professionelle, E-E-A-T-optimierte Biografie (ca. 120-150 Wörter) auf Deutsch.

E-E-A-T FOKUS:
- **Experience**: Zeige praktische Erfahrung mit Serien-Analysen
- **Expertise**: Demonstriere Fachwissen im Streaming/Serien-Bereich
- **Authoritativeness**: Etabliere Autorität durch spezifische Kenntnisse
- **Trustworthiness**: Schaffe Vertrauen durch Professionalität

RICHTLINIEN:
1. Persönlich aber professionell
2. Erwähne Spezialgebiete (basierend auf Themen)
3. Zeige Leidenschaft für Serien-Content
4. Vermeide Übertreibungen, bleibe authentisch
5. Schreibe in der 3. Person
6. Inkludiere relevante Serien-Genres oder Spezialisierungen

WICHTIG: Antworte NUR mit einem JSON-Objekt in diesem Format:
{
  "bio": "Die Biografie hier...",
  "expertise": ["Genre 1", "Genre 2", "Thema 1"]
}

Beispiel-Expertise-Tags: "Thriller-Serien", "Streaming-Analyse", "Character-Development", "HBO Serien", "Netflix Originals", "K-Drama", "Science Fiction", "Mystery", etc.`;

  const pythonCode = `
import os
import json
import asyncio
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv()

async def generate_bio():
    chat = LlmChat(
        api_key=os.getenv("EMERGENT_LLM_KEY"),
        session_id="author-bio-${author.id}",
        system_message="Du bist ein SEO-Experte, der E-E-A-T-optimierte Autoren-Biografien für eine professionelle Serien-News-Website erstellt."
    ).with_model("openai", "gpt-5.1")
    
    prompt = """${prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"""
    
    user_message = UserMessage(text=prompt)
    response = await chat.send_message(user_message)
    
    print(response)

asyncio.run(generate_bio())
`;

  try {
    const stdout = await execPython(pythonCode);
    const content = stdout.trim();
    
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
    const jsonString = jsonMatch ? jsonMatch[1] : content;
    
    const result = JSON.parse(jsonString);
    
    return {
      bio: result.bio,
      expertise: result.expertise || [],
    };
  } catch (error: any) {
    console.error(`Error generating bio for ${author.name}:`, error.message);
    throw error;
  }
}

/**
 * Analyze author's articles to determine topics/themes
 */
async function analyzeAuthorTopics(authorId: string): Promise<string[]> {
  const articles = await prisma.articles.findMany({
    where: {
      authorId,
      status: 'published',
    },
    select: {
      title: true,
      category: true,
      series: {
        select: {
          title: true,
          genres: true,
        },
      },
    },
    take: 10,
    orderBy: { publishedAt: 'desc' },
  });

  const topics = new Set<string>();

  // Extract categories
  articles.forEach((article) => {
    if (article.category) {
      topics.add(article.category);
    }
    
    // Extract series titles
    if (article.series?.title) {
      topics.add(article.series.title);
    }
    
    // Extract genres
    if (article.series?.genres) {
      article.series.genres.forEach((genre) => topics.add(genre));
    }
  });

  return Array.from(topics).slice(0, 8);
}

async function generateAllAuthorBios() {
  console.log('\n🔍 Fetching authors...\n');

  // Get all authors with published articles
  const authors = await prisma.users.findMany({
    where: {
      articles: {
        some: {
          status: 'published',
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      bio: true,
      _count: {
        select: {
          articles: true,
        },
      },
    },
  });

  console.log(`Found ${authors.length} authors\n`);
  console.log('='.repeat(60));

  for (const author of authors) {
    if (!author.name) {
      console.log(`⏭️  Skipping author without name (${author.email})`);
      continue;
    }

    // Skip if bio already exists
    if (author.bio) {
      console.log(`⏭️  ${author.name}: Bio already exists, skipping`);
      continue;
    }

    console.log(`\n📝 Generating bio for: ${author.name}`);
    console.log(`   Articles: ${author._count.articles}`);

    try {
      // Analyze topics
      const topics = await analyzeAuthorTopics(author.id);
      console.log(`   Topics: ${topics.slice(0, 3).join(', ')}...`);

      // Generate bio
      const { bio, expertise } = await generateAuthorBio({
        id: author.id,
        name: author.name,
        email: author.email,
        articleCount: author._count.articles,
        recentTopics: topics,
      });

      // Update database
      await prisma.users.update({
        where: { id: author.id },
        data: {
          bio,
          expertise,
        },
      });

      console.log(`   ✅ Bio generated (${bio.length} chars)`);
      console.log(`   ✅ Expertise: ${expertise.join(', ')}`);

      // Rate limiting - wait 1 second between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`   ❌ Failed: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All author bios generated!\n');
}

// Run
generateAllAuthorBios()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
