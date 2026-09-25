/** Conservative cast links: exact, unambiguous full names, never surnames. */
import { PrismaClient } from '@prisma/client';
import { linkPersonNamesInMarkdown, type PersonLinkTarget } from './person-link-safety';

const prisma = new PrismaClient();

interface CastLinkResult {
  linkedMarkdown: string;
  castLinked: number;
  personLinkTargets: PersonLinkTarget[];
}

export async function linkCastInMarkdown(
  markdown: string,
  _seriesTmdbId: number,
): Promise<CastLinkResult> {
  // Keep all identities so homonyms cannot silently resolve to the first row.
  // Series membership does not make a bare surname safe (e.g. "in London").
  const persons = await prisma.persons.findMany({ select: { name: true, slug: true } });
  const result = linkPersonNamesInMarkdown(markdown, persons);
  console.log(`   ✅ Unambiguous full-name cast links: ${result.castLinked}`);
  return { ...result, personLinkTargets: persons };
}
