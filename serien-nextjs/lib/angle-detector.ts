/**
 * POST-GENERATION ANGLE DETECTOR
 *
 * detectAngle() in headline-patterns.ts classifies an ENGLISH source topic
 * (before generation). For analytics we need to classify the FINAL German
 * headline that actually ran on the site — so we can aggregate impressions
 * & clicks by angle over the last N days.
 *
 * This lightweight regex-based classifier maps German phrasing fingerprints
 * back to the 9 angles defined in headline-patterns.ts.
 */

import type { HeadlineAngle } from './headline-patterns';

interface AngleFingerprint {
  angle: HeadlineAngle;
  weight: number;
  rx: RegExp;
}

const FINGERPRINTS: AngleFingerprint[] = [
  // ═══ NOSTALGIA ═══ (most specific, score high)
  { angle: 'nostalgia', weight: 6, rx: /\btv[-\s]?legende\b/i },
  { angle: 'nostalgia', weight: 6, rx: /\brief einfach an\b/i },
  { angle: 'nostalgia', weight: 5, rx: /\bohne kontakte\b/i },
  { angle: 'nostalgia', weight: 5, rx: /\bkaum jemand ahnte\b/i },
  { angle: 'nostalgia', weight: 5, rx: /\btv[-\s]?geschichte\s+(?:schreibt|schrieb|geschrieben)\b/i },
  { angle: 'nostalgia', weight: 5, rx: /\bpr(?:ä|ae)gte\b.{0,25}\b(?:(?:ü|ue)ber\s+jahre|jahrelang|seit\s+jahrzehnten)\b/i },
  { angle: 'nostalgia', weight: 5, rx: /\bdabei\s+begann\s+alles\b/i },
  { angle: 'nostalgia', weight: 5, rx: /\blange\s+vor\b/i },
  { angle: 'nostalgia', weight: 5, rx: /\bverdankt\b.{0,25}\bmehr,?\s+als\s+viele\b/i },
  { angle: 'nostalgia', weight: 5, rx: /\bw(?:ä|ae)re\b.{0,30}\bnie\s+dasselbe\b/i },
  { angle: 'nostalgia', weight: 5, rx: /\bf(?:ü|ue)r\s+millionen\s+unvergesslich\b/i },
  { angle: 'nostalgia', weight: 5, rx: /\bsp(?:ä|ae)ter\s+wurde\b.{0,30}\bkult\b/i },
  { angle: 'nostalgia', weight: 4, rx: /\bausnahmeerscheinung\b/i },
  { angle: 'nostalgia', weight: 4, rx: /\bheute\s+kennt\s+(?:ihn|sie)\s+jeder\b/i },
  { angle: 'nostalgia', weight: 4, rx: /\b(?:jahre\s+sp(?:ä|ae)ter|viele\s+jahre\s+sp(?:ä|ae)ter)\b/i },
  { angle: 'nostalgia', weight: 4, rx: /\bso\s+begann\s+die\s+karriere\b/i },
  { angle: 'nostalgia', weight: 4, rx: /\bein\s+(?:anruf|mutiger\s+schritt|einfacher\s+moment)\s+(?:(ä|ae)nderte|machte)\b/i },
  { angle: 'nostalgia', weight: 4, rx: /\bvor\s+(?:ncis|csi|navy\s+cis|magnum|columbo|baywatch|knight\s+rider)\b/i },
  { angle: 'nostalgia', weight: 3, rx: /\bjahrzehnt(?:e|en|elang)\b/i },
  { angle: 'nostalgia', weight: 3, rx: /\b(?:tv|fernseh)[-\s]?ikone\b/i },

  // ═══ SUCCESS / DOMINANCE ═══
  { angle: 'success', weight: 5, rx: /\bh(?:ö|oe)rt\s+einfach\s+nicht\s+auf\b/i },
  { angle: 'success', weight: 5, rx: /\bmonate\s+(?:sp(?:ä|ae)ter|nach)\b/i },
  { angle: 'success', weight: 5, rx: /\bschl(?:ä|ae)gt\s+weiter\b/i },
  { angle: 'success', weight: 4, rx: /\bbleibt\s+(?:ganz\s+)?(?:vorne|oben|gr(?:ö|oe)(?:ß|ss)er)\b/i },
  { angle: 'success', weight: 4, rx: /\bl(?:ä|ae)sst\b.{0,15}\bhinter\s+sich\b/i },
  { angle: 'success', weight: 4, rx: /\bnoch\s+immer\b.{0,20}\b(?:ganz\s+oben|dominiert|phänomen|phaenomen)\b/i },
  { angle: 'success', weight: 4, rx: /\b\d+\s*millionen\s+zuschauer\b/i },
  { angle: 'success', weight: 4, rx: /\btop[-\s]?\d+|#\d+|platz\s+\d+\b/i },
  { angle: 'success', weight: 3, rx: /\bstreaming[-\s]?hit\b/i },
  { angle: 'success', weight: 3, rx: /\bdominiert\b/i },

  // ═══ COMEBACK ═══
  { angle: 'comeback', weight: 5, rx: /\bkaum\s+jemand\s+sah\s+das\s+kommen\b/i },
  { angle: 'comeback', weight: 5, rx: /\bmeldet\s+sich\s+zur(?:ü|ue)ck\b/i },
  { angle: 'comeback', weight: 5, rx: /\bniemand\s+rechnete\s+damit\b.{0,20}\b(?:doch|wieder\s+da)\b/i },
  { angle: 'comeback', weight: 4, rx: /\b(?:comeback|revival|wiederbelebung)\b/i },
  { angle: 'comeback', weight: 4, rx: /\bausgerechnet\s+jetzt\s+sorgt\b/i },
  { angle: 'comeback', weight: 4, rx: /\bwieder\s+da\b/i },

  // ═══ SEASON UPDATE ═══
  { angle: 'season_update', weight: 5, rx: /\bf(?:ü|ue)r\s+fans\s+wird\s+es\b/i },
  { angle: 'season_update', weight: 5, rx: /\bverdichten\s+sich\s+(?:die\s+)?zeichen\b/i },
  { angle: 'season_update', weight: 4, rx: /\br(?:ü|ue)ckt\s+n(?:ä|ae)her\b/i },
  { angle: 'season_update', weight: 4, rx: /\bneue\s+hinweise\s+zu\b/i },
  { angle: 'season_update', weight: 4, rx: /\bfr(?:ü|ue)her\s+zur(?:ü|ue)ckkehren\b/i },
  { angle: 'season_update', weight: 3, rx: /\bstaffel\s+\d+\b/i },
  { angle: 'season_update', weight: 3, rx: /\bstaffelfinale\b/i },
  { angle: 'season_update', weight: 3, rx: /\b(?:erste\s+bilder|erste\s+einblicke|drehstart)\b/i },

  // ═══ QUALITY PRAISE ═══
  { angle: 'quality_praise', weight: 5, rx: /\bkritiker\s+feiern\b/i },
  { angle: 'quality_praise', weight: 5, rx: /\btrifft\b.{0,15}\b(?:den\s+nerv|einen\s+nerv)\b/i },
  { angle: 'quality_praise', weight: 4, rx: /\b(?:ü|ue)berzeugt\b.{0,20}\b(?:skeptiker|selbst)\b/i },
  { angle: 'quality_praise', weight: 4, rx: /\bwarum\b.{0,10}\bso\s+(?:stark|gut)\s+ankommt\b/i },
  { angle: 'quality_praise', weight: 4, rx: /\b\d{2,3}\s*%\b|\brotten\s+tomatoes\b|\bmetacritic\b/i },
  { angle: 'quality_praise', weight: 3, rx: /\bkritiker[-\s]?score\b/i },
  { angle: 'quality_praise', weight: 3, rx: /\bmeisterwerk\b/i },

  // ═══ STAR POWER ═══
  { angle: 'star_power', weight: 5, rx: /\bwegen\b.{1,30}\breden\s+(?:jetzt\s+)?wieder\s+alle\b/i },
  { angle: 'star_power', weight: 4, rx: /\bmacht\b.{1,25}\b(?:noch\s+interessanter|spannend(?:er)?)\b/i },

  // ═══ UNDERRATED ═══
  { angle: 'underrated', weight: 5, rx: /\bviele\s+(?:ü|ue)bersehen\b/i },
  { angle: 'underrated', weight: 5, rx: /\bunterschätzteste?|unterschaetzteste?\b/i },
  { angle: 'underrated', weight: 4, rx: /\b(?:geheimtipp|sleeper[-\s]?hit)\b/i },
  { angle: 'underrated', weight: 3, rx: /\bdabei\s+l(?:ä|ae)uft\s+es\b/i },

  // ═══ CONTROVERSY ═══
  { angle: 'controversy', weight: 5, rx: /\bpolarisiert\b/i },
  { angle: 'controversy', weight: 5, rx: /\bspaltet\s+(?:die\s+)?fans\b/i },
  { angle: 'controversy', weight: 4, rx: /\b(?:kontroverse|shitstorm|backlash)\b/i },
  { angle: 'controversy', weight: 4, rx: /\bfans\s+(?:streiten|sind\s+gespalten)\b/i },

  // ═══ TREND MOMENTUM ═══
  { angle: 'trend_momentum', weight: 5, rx: /\bpl(?:ö|oe)tzlich\s+reden\s+(?:wieder\s+)?alle\b/i },
  { angle: 'trend_momentum', weight: 4, rx: /\bgespr(?:ä|ae)chsstoff\b/i },
  { angle: 'trend_momentum', weight: 4, rx: /\b(?:auf\s+einmal|immer\s+mehr)\s+(?:reden|schauen)\b/i },
  { angle: 'trend_momentum', weight: 3, rx: /\b(?:viral|tiktok|trending)\b/i },

  // ═══ LEGACY FORMULAS (pre-v5.1) — classify so old articles show up too ═══
  // "Erst X, jetzt Y" — reframe contrast, maps to comeback when positive flip
  { angle: 'comeback',       weight: 3, rx: /\berst\s+\S+,?\s+jetzt\b/i },
  { angle: 'comeback',       weight: 3, rx: /\bdoch\s+noch\b/i },
  { angle: 'season_update',  weight: 3, rx: /\bjetzt\s+best(?:ä|ae)tigt\b/i },
  { angle: 'success',        weight: 3, rx: /\boffiziell\s*:/i },
  { angle: 'quality_praise', weight: 3, rx: /^darum\b/i },
  { angle: 'star_power',     weight: 3, rx: /\b(fans\s+(?:überrascht|jubeln)|star\s+wechselt)\b/i },
  { angle: 'season_update',  weight: 3, rx: /\bbangt\s+um\s+(die\s+)?zukunft\b/i },
  { angle: 'comeback',       weight: 3, rx: /\bkehrt\s+(?:zur(?:ü|ue)ck|zur|mit)\b/i },
  { angle: 'controversy',    weight: 3, rx: /\bumstritten\b|\bverteidigt\b/i },
  { angle: 'success',        weight: 3, rx: /\b(?:triumph|erfolg|feiert)\b/i },
  { angle: 'comeback',       weight: 3, rx: /\banders\s+als\s+(?:gedacht|erwartet)\b/i },
  { angle: 'comeback',       weight: 3, rx: /\btrotz\b.{0,20}\bstartet\s+(?:überraschend|stark)\b/i },
];

export interface DetectedAngle {
  angle: HeadlineAngle | 'unknown';
  confidence: number;
  secondary: HeadlineAngle | null;
}

/**
 * Detect which Discover angle a FINAL German headline belongs to.
 * Returns 'unknown' if no fingerprint matches (confidence 0).
 */
export function detectAngleFromHeadline(headline: string): DetectedAngle {
  if (!headline) return { angle: 'unknown', confidence: 0, secondary: null };

  const scores: Record<HeadlineAngle, number> = {
    success: 0, comeback: 0, season_update: 0, quality_praise: 0,
    star_power: 0, underrated: 0, controversy: 0, trend_momentum: 0, nostalgia: 0,
  };

  for (const fp of FINGERPRINTS) {
    if (fp.rx.test(headline)) scores[fp.angle] += fp.weight;
  }

  const ranked = (Object.entries(scores) as Array<[HeadlineAngle, number]>)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) return { angle: 'unknown', confidence: 0, secondary: null };

  // Confidence = top-score / (top-score + runner-up + 2) — gives ≈1.0 for strong single match
  const top = ranked[0];
  const runnerUp = ranked[1]?.[1] || 0;
  const confidence = Math.min(1, top[1] / (top[1] + runnerUp + 2));

  return {
    angle: top[0],
    confidence: Number(confidence.toFixed(2)),
    secondary: ranked[1]?.[0] || null,
  };
}
