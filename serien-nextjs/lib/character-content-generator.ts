/**
 * Character Content Generator
 * Generates discover-optimized content for fictional character pages
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CharacterData {
  name: string;
  seriesName: string;
  tmdbSeriesData?: any;
  tmdbCharacterData?: any;
  actorName?: string;
}

interface GeneratedContent {
  shortDescription: string;
  whoIsContent: string;
  roleInSeriesContent: string;
  importanceContent: string;
  appearancesContent: string;
  qa: Array<{ question: string; answer: string }>;
  metaTitle: string;
  metaDescription: string;
}

/**
 * Generate all content sections for a character page
 */
export async function generateCharacterContent(
  data: CharacterData
): Promise<GeneratedContent> {
  try {
    const actorArg = data.actorName ? ` "${data.actorName}"` : '';
    const { stdout, stderr } = await execAsync(
      `cd /app/serien-nextjs && python3 scripts/generate-character-content.py "${data.name}" "${data.seriesName}"${actorArg}`
    );

    if (stderr) {
      console.error('Python stderr:', stderr);
    }

    const content = JSON.parse(stdout);

    // Validate required fields
    if (!content.shortDescription || !content.whoIsContent || !content.roleInSeriesContent) {
      throw new Error('Missing required content fields');
    }

    return content as GeneratedContent;
  } catch (error: any) {
    console.error('Character content generation failed:', error.message);
    throw error;
  }
}

/**
 * Create slug for character page
 */
export function createCharacterSlug(characterName: string, seriesName: string): string {
  const cleanChar = characterName
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const cleanSeries = seriesName
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `${cleanChar}-${cleanSeries}`;
}
