/**
 * Discover Score Breakdown Types
 * 
 * Stable schema for storing & displaying Discover Gate evaluation results
 */

export type DiscoverSignalKey =
  | "FRESHNESS"
  | "ORIGINALITY"
  | "HEADLINE_QUALITY"
  | "CONTENT_DEPTH"
  | "READABILITY"
  | "E_E_A_T"
  | "CLICKBAIT_RISK"
  | "AI_RISK"
  | "IMAGE_QUALITY"
  | "TECH_SEO";

export type DiscoverSignal = {
  key: DiscoverSignalKey;
  weight: number;          // e.g. 0.20
  score: number;           // 0..100
  points: number;          // weight * score
  status: "PASS" | "WARN" | "FAIL";
  reason: string;          // short explanation
  evidence?: Record<string, any>; // numbers + snippets + urls
  fixes?: string[];        // suggested changes
};

export type DiscoverBreakdown = {
  totalScore: number;      // 0..100
  passed: boolean;
  threshold: number;       // e.g. 65
  modeIfPass: "DISCOVER";
  modeIfFail: "SEARCH_ONLY";
  signals: DiscoverSignal[];
  meta: {
    articleId: string;
    slug: string;
    evaluatedAt: string;
    model?: string;
    pipelineVersion?: string;
  };
};
