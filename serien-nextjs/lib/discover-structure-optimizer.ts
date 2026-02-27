/**
 * Discover Structure Optimizer
 * Optimiert Artikel-Struktur für Google Discover & Google News
 * OHNE Inhalt zu ändern - nur strukturelle Verbesserungen
 */

interface DiscoverOptimizationInput {
  content: string;
  seriesName: string;
  platform?: string;
  coreEvent?: string; // z.B. "Ende erklärt", "Tod erklärt", "Entführung"
}

interface DiscoverOptimizationResult {
  optimizedContent: string;
  signals: {
    seriesNameCount: number;
    platformMentioned: boolean;
    clearOpening: boolean;
    properH2Structure: boolean;
  };
  warnings: string[];
}

/**
 * Extract platform from content or TMDB data
 */
function extractPlatform(content: string): string | null {
  const platforms = [
    'Netflix', 'Prime Video', 'Amazon Prime', 'HBO', 'HBO Max', 'Max',
    'Disney+', 'Disney Plus', 'Apple TV+', 'Paramount+', 'Hulu',
    'Sky', 'WOW', 'RTL+', 'Joyn', 'ZDF', 'ARD', 'ProSieben', 'Sat.1'
  ];
  
  for (const platform of platforms) {
    if (new RegExp(platform, 'i').test(content)) {
      return platform;
    }
  }
  
  return null;
}

/**
 * Optimize opening paragraph for Discover
 * Must contain: Series name, Platform, Concrete event
 * 2-3 sentences, no questions, no meta
 */
function optimizeOpening(
  content: string,
  seriesName: string,
  platform: string | null,
  coreEvent: string
): string {
  const htmlContent = content;
  
  // Extract first paragraph
  const firstPMatch = htmlContent.match(/<p>(.*?)<\/p>/);
  if (!firstPMatch) return htmlContent;
  
  const firstP = firstPMatch[1];
  
  // Check if opening already has required elements
  const hasSeriesName = firstP.includes(seriesName);
  const hasPlatform = platform ? firstP.includes(platform) : true;
  const hasCoreEvent = firstP.includes(coreEvent) || firstP.length > 100;
  
  // If opening is already good, keep it
  if (hasSeriesName && hasPlatform && hasCoreEvent) {
    return htmlContent;
  }
  
  // Otherwise, enhance the opening
  let enhancedOpening = '';
  
  if (platform) {
    enhancedOpening = `Die ${platform}-Serie „${seriesName}" ${coreEvent.toLowerCase()}. `;
  } else {
    enhancedOpening = `Die Serie „${seriesName}" ${coreEvent.toLowerCase()}. `;
  }
  
  // Keep the rest of the first paragraph if it adds value
  if (firstP.length > 50) {
    enhancedOpening += firstP;
  }
  
  // Replace first paragraph
  return htmlContent.replace(firstPMatch[0], `<p>${enhancedOpening}</p>`);
}

/**
 * Optimize H2 structure according to allowed templates
 */
function optimizeH2Structure(content: string, seriesName: string): string {
  let optimizedContent = content;
  
  // Allowed H2 templates
  const allowedH2Templates = [
    `Was passiert am Ende von ${seriesName}?`,
    `Warum [Schlüsselereignis]?`,
    `Welche offenen Fragen bleiben?`,
    `Was bedeutet das für die Serie?`,
  ];
  
  // Remove H3, H4 (not allowed in Discover structure)
  optimizedContent = optimizedContent.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '<p><strong>$1</strong></p>');
  optimizedContent = optimizedContent.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '<p><strong>$1</strong></p>');
  
  // Count H2s
  const h2Matches = optimizedContent.match(/<h2[^>]*>.*?<\/h2>/gi);
  const h2Count = h2Matches ? h2Matches.length : 0;
  
  // If more than 4 H2s, warn (but don't break)
  if (h2Count > 4) {
    console.log(`⚠️  ${h2Count} H2s found (recommended: max 4)`);
  }
  
  return optimizedContent;
}

/**
 * Optimize paragraph structure
 * Max 3-4 sentences per paragraph
 */
function optimizeParagraphs(content: string): string {
  let optimizedContent = content;
  
  // Split long paragraphs (more than 5 sentences)
  const paragraphs = optimizedContent.match(/<p>(.*?)<\/p>/gs) || [];
  
  paragraphs.forEach(p => {
    const pContent = p.replace(/<\/?p>/g, '');
    const sentences = pContent.split(/\. (?=[A-ZÄÖÜ])/);
    
    if (sentences.length > 5) {
      // Split into multiple paragraphs
      const newParagraphs = [];
      for (let i = 0; i < sentences.length; i += 4) {
        const chunk = sentences.slice(i, i + 4).join('. ') + '.';
        newParagraphs.push(`<p>${chunk}</p>`);
      }
      optimizedContent = optimizedContent.replace(p, newParagraphs.join('\n'));
    }
  });
  
  return optimizedContent;
}

/**
 * Validate Discover signals
 */
function validateDiscoverSignals(
  content: string,
  seriesName: string,
  platform: string | null
): { signals: DiscoverOptimizationResult['signals']; warnings: string[] } {
  const warnings: string[] = [];
  
  // Count series name mentions
  const seriesNameRegex = new RegExp(seriesName, 'gi');
  const seriesNameMatches = content.match(seriesNameRegex);
  const seriesNameCount = seriesNameMatches ? seriesNameMatches.length : 0;
  
  if (seriesNameCount < 3) {
    warnings.push(`Serienname nur ${seriesNameCount}x erwähnt (empfohlen: ≥3x)`);
  }
  
  // Check platform mention
  const platformMentioned = platform ? content.includes(platform) : false;
  if (!platformMentioned && platform) {
    warnings.push('Plattform nicht erwähnt');
  }
  
  // Check clear opening (first 200 chars should contain series name)
  const first200 = content.substring(0, 200);
  const clearOpening = first200.includes(seriesName);
  if (!clearOpening) {
    warnings.push('Serienname fehlt im Opening');
  }
  
  // Check H2 structure
  const h2Matches = content.match(/<h2[^>]*>.*?<\/h2>/gi);
  const properH2Structure = h2Matches && h2Matches.length <= 4;
  if (!properH2Structure) {
    warnings.push(`Zu viele H2s (${h2Matches?.length || 0}, empfohlen: max 4)`);
  }
  
  return {
    signals: {
      seriesNameCount,
      platformMentioned: platformMentioned || !platform,
      clearOpening,
      properH2Structure: properH2Structure || false,
    },
    warnings,
  };
}

/**
 * Main optimization function
 */
export function optimizeForDiscover(input: DiscoverOptimizationInput): DiscoverOptimizationResult {
  console.log('\n🔍 DISCOVER STRUCTURE OPTIMIZATION');
  console.log('━'.repeat(70));
  
  let optimizedContent = input.content;
  
  // STEP 1: Optimize opening
  const platform = input.platform || extractPlatform(input.content);
  const coreEvent = input.coreEvent || 'erklärt das Ende';
  
  console.log('📝 STEP 1: Optimizing opening paragraph...');
  optimizedContent = optimizeOpening(optimizedContent, input.seriesName, platform, coreEvent);
  console.log(`   Serienname: ${input.seriesName}`);
  console.log(`   Plattform: ${platform || 'nicht erkannt'}`);
  console.log(`   Event: ${coreEvent}`);
  
  // STEP 2: Optimize H2 structure
  console.log('\n📝 STEP 2: Optimizing H2 structure...');
  optimizedContent = optimizeH2Structure(optimizedContent, input.seriesName);
  const h2Count = (optimizedContent.match(/<h2[^>]*>.*?<\/h2>/gi) || []).length;
  console.log(`   H2 count: ${h2Count} (max 4 recommended)`);
  
  // STEP 3: Optimize paragraphs
  console.log('\n📝 STEP 3: Optimizing paragraph structure...');
  optimizedContent = optimizeParagraphs(optimizedContent);
  
  // STEP 4: Validate Discover signals
  console.log('\n📝 STEP 4: Validating Discover signals...');
  const validation = validateDiscoverSignals(optimizedContent, input.seriesName, platform);
  
  console.log(`   ✅ Serienname: ${validation.signals.seriesNameCount}x`);
  console.log(`   ${validation.signals.platformMentioned ? '✅' : '⚠️ '} Plattform: ${validation.signals.platformMentioned ? 'erwähnt' : 'fehlt'}`);
  console.log(`   ${validation.signals.clearOpening ? '✅' : '⚠️ '} Clear Opening: ${validation.signals.clearOpening ? 'ja' : 'nein'}`);
  console.log(`   ${validation.signals.properH2Structure ? '✅' : '⚠️ '} H2 Structure: ${validation.signals.properH2Structure ? 'optimal' : 'zu viele'}`);
  
  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    validation.warnings.forEach(w => console.log(`   - ${w}`));
  }
  
  console.log('\n✅ Discover Structure Optimization complete');
  
  return {
    optimizedContent,
    signals: validation.signals,
    warnings: validation.warnings,
  };
}
