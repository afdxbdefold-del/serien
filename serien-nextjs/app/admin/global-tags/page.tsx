'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, Eye, EyeOff, Bot, Code2 } from 'lucide-react';

type Placement = 'head' | 'body-start' | 'body-end';

interface GlobalTag {
  id?: string;
  name: string;
  html: string;
  placement: Placement;
  isActive: boolean;
  hideFromBots: boolean;
  sortOrder: number;
}

const EMPTY_TAG: GlobalTag = {
  name: '',
  html: '',
  placement: 'body-end',
  isActive: false,
  hideFromBots: true,
  sortOrder: 0,
};

const PLACEMENT_LABEL: Record<Placement, string> = {
  head: 'Head (früh geladen)',
  'body-start': 'Body-Start (vor Content)',
  'body-end': 'Body-End (nach Footer)',
};

const PLACEMENT_HINT: Record<Placement, string> = {
  head: 'Wird ganz oben in der Artikelseite emittiert. Script lädt sofort beim HTML-Parse — ideal für Header-Bidding-Wrapper / SSP-Loader (TheMoneytizer, Ezoic, etc.).',
  'body-start': 'Nach dem Page-Wrapper, vor allen Inhalten. Für Loader die DOM brauchen aber früh laden sollen.',
  'body-end': 'Ganz am Ende der Seite. Für Late-Loading-Pixel, Tracking-Beacons, Adblock-Detection.',
};

export default function GlobalTagsAdminPage() {
  const [tags, setTags] = useState<GlobalTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [draft, setDraft] = useState<GlobalTag>(EMPTY_TAG);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/global-tags');
      const data = await res.json();
      setTags(Array.isArray(data) ? data : []);
    } catch {
      setMsg({ type: 'error', text: 'Fehler beim Laden' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const save = async (tag: GlobalTag) => {
    if (!tag.name.trim()) return showMsg('error', 'Name fehlt');
    if (!tag.html.trim()) return showMsg('error', 'HTML fehlt');

    setSaving(tag.id ?? 'new');
    try {
      const res = await fetch('/api/admin/global-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tag),
      });
      if (!res.ok) throw new Error('save failed');
      showMsg('success', tag.id ? `"${tag.name}" gespeichert` : `"${tag.name}" angelegt`);
      if (!tag.id) setDraft(EMPTY_TAG);
      fetchTags();
    } catch {
      showMsg('error', 'Speichern fehlgeschlagen');
    } finally {
      setSaving(null);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`"${name}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/admin/global-tags?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      showMsg('success', 'Gelöscht');
      fetchTags();
    } catch {
      showMsg('error', 'Löschen fehlgeschlagen');
    }
  };

  const updateTag = (id: string, patch: Partial<GlobalTag>) => {
    setTags((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            <Code2 className="w-8 h-8" /> Globale Tags (Artikel-Seiten)
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-3xl">
            Beliebige HTML-Snippets (Script-Loader, iframes, Pixel) die auf <strong>jeder
            Artikelseite</strong> ausgespielt werden. Für TheMoneytizer-Wrapper,
            Header-Bidding-Loader, externe SSP-Pixel, Adblock-Detection u. ä. Bots werden
            standardmäßig herausgefiltert (UA-Check).
          </p>
        </div>

        {msg && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              msg.type === 'success'
                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
            }`}
            data-testid="status-message"
          >
            {msg.text}
          </div>
        )}

        {/* New Tag Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-cyan-500 dark:border-cyan-700 mb-8 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Neuer Tag
          </h2>
          <TagEditor
            tag={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            onSave={() => save(draft)}
            saving={saving === 'new'}
            testIdPrefix="new"
          />
        </div>

        {/* Existing Tags */}
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Vorhandene Tags ({tags.length})
        </h2>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : tags.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400">
            Noch keine Tags angelegt.
          </div>
        ) : (
          <div className="space-y-4">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 transition-colors ${
                  tag.isActive
                    ? 'border-green-500 dark:border-green-600'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
                data-testid={`tag-${tag.id}`}
              >
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        tag.isActive ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{tag.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {PLACEMENT_LABEL[tag.placement]} · sort {tag.sortOrder}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {tag.hideFromBots && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded text-xs">
                        <Bot className="w-3 h-3" /> Bot-Filter
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => tag.id && remove(tag.id, tag.name)}
                      className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm"
                      data-testid={`delete-${tag.id}`}
                    >
                      <Trash2 className="w-4 h-4" /> Löschen
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <TagEditor
                    tag={tag}
                    onChange={(patch) => tag.id && updateTag(tag.id, patch)}
                    onSave={() => save(tag)}
                    saving={saving === tag.id}
                    testIdPrefix={tag.id!}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TagEditor({
  tag,
  onChange,
  onSave,
  saving,
  testIdPrefix,
}: {
  tag: GlobalTag;
  onChange: (patch: Partial<GlobalTag>) => void;
  onSave: () => void;
  saving: boolean;
  testIdPrefix: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name *
          </label>
          <input
            type="text"
            value={tag.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder='z.B. "The Moneytizer Loader"'
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            data-testid={`tag-name-${testIdPrefix}`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Placement
          </label>
          <select
            value={tag.placement}
            onChange={(e) => onChange({ placement: e.target.value as Placement })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            data-testid={`tag-placement-${testIdPrefix}`}
          >
            <option value="head">{PLACEMENT_LABEL.head}</option>
            <option value="body-start">{PLACEMENT_LABEL['body-start']}</option>
            <option value="body-end">{PLACEMENT_LABEL['body-end']}</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{PLACEMENT_HINT[tag.placement]}</p>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          HTML / Script / iframe *
        </label>
        <textarea
          value={tag.html}
          onChange={(e) => onChange({ html: e.target.value })}
          placeholder={`<script async src="https://ads.themoneytizer.com/site/..."></script>\n\noder\n\n<iframe src="..." width="300" height="250"></iframe>`}
          className="w-full h-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-xs"
          data-testid={`tag-html-${testIdPrefix}`}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          ⚠️ Roh-HTML wird unverändert ausgespielt. Nur eigene oder vertrauenswürdige
          Third-Party-Snippets einfügen — keine Sanitization.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Sort-Order
          </label>
          <input
            type="number"
            value={tag.sortOrder}
            onChange={(e) => onChange({ sortOrder: parseInt(e.target.value, 10) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            data-testid={`tag-sortorder-${testIdPrefix}`}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={tag.isActive}
            onChange={(e) => onChange({ isActive: e.target.checked })}
            className="w-5 h-5 rounded border-gray-300 text-green-500 focus:ring-green-500"
            data-testid={`tag-active-${testIdPrefix}`}
          />
          <span className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
            {tag.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            Aktiv
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={tag.hideFromBots}
            onChange={(e) => onChange({ hideFromBots: e.target.checked })}
            className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            data-testid={`tag-hidebots-${testIdPrefix}`}
          />
          <span className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
            <Bot className="w-4 h-4" /> Vor Bots verstecken
          </span>
        </label>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !tag.name.trim() || !tag.html.trim()}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
          data-testid={`tag-save-${testIdPrefix}`}
        >
          <Save className="w-4 h-4" />
          {saving ? 'Speichere…' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}
