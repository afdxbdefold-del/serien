/**
 * ARTIKEL-KONTEXT-SEKTIONEN
 * 
 * Drei kurze, sachliche Einordnungen vor dem Artikel-Content:
 * - Bisheriger Stand zur Serie (dynamisch aus DB-Metadaten, kein LLM)
 * - Darum ist das relevant (LLM-generiert, einmalig gespeichert)
 * - Was bedeutet das? (LLM-generiert, einmalig gespeichert)
 */

interface ContextSectionProps {
  heading: string;
  text: string;
  testId: string;
}

function ContextSection({ heading, text, testId }: ContextSectionProps) {
  return (
    <section className="context" data-testid={testId}>
      <h2>{heading}</h2>
      <p>{text}</p>
    </section>
  );
}

export function WasBedeutetDas({ text }: { text: string }) {
  return <ContextSection heading="Was bedeutet das?" text={text} testId="was-bedeutet-das" />;
}

export function DarumRelevant({ text }: { text: string }) {
  return <ContextSection heading="Darum ist das relevant" text={text} testId="darum-relevant" />;
}

// --- BisherigerStand: dynamisch aus strukturierten Serien-Metadaten ---

const STATUS_MAP: Record<string, string> = {
  'Returning Series': 'laufend',
  'Ended': 'abgeschlossen',
  'Canceled': 'abgesetzt',
  'In Production': 'in Produktion',
  'Planned': 'geplant',
  'Pilot': 'Pilot',
};

export interface BisherigerStandData {
  override?: string | null;
  seriesName: string;
  status?: string | null;
  numberOfSeasons?: number | null;
  firstAirDate?: string | Date | null;
  lastAirDate?: string | Date | null;
  networks?: string[] | null;
}

function buildBisherigerStand(data: BisherigerStandData): string | null {
  // Redaktionelles Override hat Vorrang
  if (data.override) return data.override;

  const parts: string[] = [];

  // Teil 1: "The Boys läuft seit 2019" / "The Boys lief von 2019 bis 2023"
  const statusLabel = data.status ? STATUS_MAP[data.status] || null : null;
  const startYear = data.firstAirDate ? new Date(data.firstAirDate).getFullYear() : null;
  const endYear = data.lastAirDate ? new Date(data.lastAirDate).getFullYear() : null;

  if (startYear) {
    if (data.status === 'Ended' || data.status === 'Canceled') {
      const verb = data.status === 'Canceled' ? 'wurde abgesetzt' : 'ist abgeschlossen';
      if (endYear && endYear !== startYear) {
        parts.push(`${data.seriesName} lief von ${startYear} bis ${endYear} und ${verb}.`);
      } else {
        parts.push(`${data.seriesName} startete ${startYear} und ${verb}.`);
      }
    } else if (statusLabel) {
      parts.push(`${data.seriesName} ist seit ${startYear} ${statusLabel}.`);
    } else {
      parts.push(`${data.seriesName} startete ${startYear}.`);
    }
  }

  // Teil 2: Staffelzahl
  if (data.numberOfSeasons && data.numberOfSeasons > 0) {
    parts.push(`Bisher gibt es ${data.numberOfSeasons} ${data.numberOfSeasons === 1 ? 'Staffel' : 'Staffeln'}.`);
  }

  // Teil 3: Plattform
  const networks = (data.networks || []).filter(Boolean);
  if (networks.length > 0) {
    parts.push(`Die Serie läuft bei ${networks.join(' und ')}.`);
  }

  if (parts.length === 0) return null;

  return parts.join(' ');
}

interface BisherigerStandProps {
  data?: BisherigerStandData;
  text?: string;
}

export function BisherigerStand(props: BisherigerStandProps) {
  // Dynamische Daten haben Vorrang
  if (props.data) {
    const text = buildBisherigerStand(props.data);
    if (!text) return null;
    return <ContextSection heading="Bisheriger Stand zur Serie" text={text} testId="bisheriger-stand" />;
  }

  // Legacy-Fallback: gespeicherter Text (alte Artikel ohne Serien-Zuordnung)
  if (props.text) {
    return <ContextSection heading="Bisheriger Stand zur Serie" text={props.text} testId="bisheriger-stand" />;
  }

  return null;
}
