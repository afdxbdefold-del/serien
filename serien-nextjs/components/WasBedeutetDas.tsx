/**
 * ARTIKEL-KONTEXT-SEKTIONEN
 * 
 * Drei kurze, sachliche Einordnungen vor dem Artikel-Content:
 * - Bisheriger Stand zur Serie (Recap)
 * - Darum ist das relevant (Kontext für den Zuschauer)
 * - Was bedeutet das? (praktische Bedeutung)
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

export function BisherigerStand({ text }: { text: string }) {
  return <ContextSection heading="Bisheriger Stand zur Serie" text={text} testId="bisheriger-stand" />;
}
