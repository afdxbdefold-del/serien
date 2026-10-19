import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';

const KEY = 'ads_txt.editor.v1';
const MAX_LINES = 250;
const MAX_BYTES = 50_000;
const MAX_HISTORY = 30;

export type AdsRevision = {
  id: string;
  at: string;
  action: 'append' | 'rollback';
  lines: string[];
  restoredFrom?: string;
};

export type AdsDocument = {
  version: string;
  lines: string[];
  history: AdsRevision[];
};

export const EMPTY_ADS_DOCUMENT: AdsDocument = {
  version: 'base',
  lines: [],
  history: [],
};

function parseDocument(value: string | null): AdsDocument {
  if (!value) return EMPTY_ADS_DOCUMENT;
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid ads editor document');
  const doc = parsed as AdsDocument;
  if (typeof doc.version !== 'string' || !Array.isArray(doc.lines) ||
      !doc.lines.every(line => typeof line === 'string') || !Array.isArray(doc.history)) {
    throw new Error('Invalid ads editor document');
  }
  return doc;
}

export async function getAdsDocument(): Promise<AdsDocument> {
  const row = await prisma.app_settings.findUnique({ where: { key: KEY }, select: { value: true } });
  return parseDocument(row?.value ?? null);
}

export function sellerKey(line: string): string {
  const parts = line.trim().split(',').map(part => part.trim());
  if (parts.length === 1) return parts[0].toLowerCase();
  return [parts[0].toLowerCase(), parts[1], parts[2]?.toUpperCase(), parts[3]?.toLowerCase()].join(',');
}

export function parsePastedLines(input: string): string[] {
  if (Buffer.byteLength(input, 'utf8') > MAX_BYTES) throw new Error('Maximal 50 KB pro Eingabe.');
  const lines = input.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error('Bitte mindestens eine Zeile einfügen.');
  if (lines.length > MAX_LINES) throw new Error('Maximal 250 Zeilen.');
  for (const [index, line] of lines.entries()) {
    const directive = /^(OWNERDOMAIN|MANAGERDOMAIN|INVENTORYPARTNERDOMAIN)=[a-z0-9.-]+$/i.test(line);
    const seller = /^[a-z0-9.-]+\s*,\s*[a-z0-9._~:/+%-]+\s*,\s*(DIRECT|RESELLER)(?:\s*,\s*[a-z0-9]+)?$/i.test(line);
    if (line.length > 500 || (!directive && !seller)) {
      throw new Error(`Zeile ${index + 1} hat kein gültiges ads.txt-Format.`);
    }
  }
  const seen = new Set<string>();
  return lines.filter(line => {
    const key = sellerKey(line);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function composeAdsTxt(base: string, managed: string[]): string {
  const seen = new Set(base.split(/\r?\n/).filter(Boolean).map(sellerKey));
  const additions = managed.filter(line => {
    const key = sellerKey(line);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!additions.length) return base;
  return `${base}${base.endsWith('\n') ? '' : '\n'}${additions.join('\n')}\n`;
}

export class AdsEditorConflict extends Error {}

export function nextAdsDocument(
  current: AdsDocument,
  action: 'append' | 'rollback',
  payload: string,
): AdsDocument {
  let lines: string[];
  let restoredFrom: string | undefined;
  if (action === 'append') {
    const additions = parsePastedLines(payload);
    const seen = new Set(current.lines.map(sellerKey));
    lines = [...current.lines, ...additions.filter(line => !seen.has(sellerKey(line)))];
    if (lines.length > MAX_LINES || Buffer.byteLength(lines.join('\n'), 'utf8') > MAX_BYTES) {
      throw new Error('Die verwaltete Liste darf höchstens 250 Zeilen oder 50 KB enthalten.');
    }
    if (lines.length === current.lines.length) throw new Error('Alle eingefügten Zeilen sind bereits vorhanden.');
  } else {
    const old = payload === 'base' ? EMPTY_ADS_DOCUMENT : current.history.find(item => item.id === payload);
    if (!old) throw new Error('Diese Version ist nicht mehr verfügbar.');
    lines = [...old.lines];
    restoredFrom = payload;
    if (JSON.stringify(lines) === JSON.stringify(current.lines)) throw new Error('Diese Version ist bereits aktiv.');
  }

  const version = randomUUID();
  const revision: AdsRevision = { id: version, at: new Date().toISOString(), action, lines, ...(restoredFrom && { restoredFrom }) };
  return { version, lines, history: [revision, ...current.history].slice(0, MAX_HISTORY) };
}

/** Compare-and-swap keeps concurrent edits from silently losing a revision. */
export async function changeAdsDocument(
  expectedVersion: string,
  action: 'append' | 'rollback',
  payload: string,
): Promise<AdsDocument> {
  const row = await prisma.app_settings.findUnique({ where: { key: KEY }, select: { value: true } });
  const current = parseDocument(row?.value ?? null);
  if (current.version !== expectedVersion) throw new AdsEditorConflict('Die Liste wurde inzwischen geändert. Bitte neu laden.');
  const next = nextAdsDocument(current, action, payload);
  const value = JSON.stringify(next);
  if (row) {
    const updated = await prisma.app_settings.updateMany({
      where: { key: KEY, value: row.value },
      data: { value, updatedBy: 'ads-editor' },
    });
    if (updated.count !== 1) throw new AdsEditorConflict('Die Liste wurde inzwischen geändert. Bitte neu laden.');
  } else {
    try {
      await prisma.app_settings.create({ data: { key: KEY, value, updatedBy: 'ads-editor' } });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new AdsEditorConflict('Die Liste wurde inzwischen geändert. Bitte neu laden.');
      }
      throw error;
    }
  }
  return next;
}
