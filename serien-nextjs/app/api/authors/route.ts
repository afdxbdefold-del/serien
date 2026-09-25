import { NextResponse } from 'next/server';

// Historical author accounts are not identity-verified and are not a public
// directory. Keep the route for old clients while no longer exposing names
// or account email addresses.
export async function GET() {
  return NextResponse.json({ error: 'Autorenverzeichnis wird geprüft' }, { status: 410 });
}
