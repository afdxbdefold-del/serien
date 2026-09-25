import { NextResponse } from 'next/server';

// A stored account assignment does not establish subject-matter expertise.
export async function GET() {
  return NextResponse.json({ error: 'Autorenzuordnung wird geprüft' }, { status: 410 });
}
