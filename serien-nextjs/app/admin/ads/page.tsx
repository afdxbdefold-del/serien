'use client';

import { useState, useEffect } from 'react';
import { Save, Trash2, Eye, EyeOff, Monitor, Smartphone, RefreshCw, Code, Layers, Plus } from 'lucide-react';

type Device = 'mobile' | 'desktop';

// Vordefinierte Ad-Positionen mit Beschreibungen. Diese Liste ist
// device-agnostisch — JEDE Position kann unabhängig für Mobile UND
// Desktop konfiguriert werden (komplette Trennung im Backend via
// composite unique `(position, device)`).
const AD_POSITIONS = [
  { 
    position: 'mobile_top', 
    name: 'Mobile Top', 
    description: 'Banner über dem Header (nur Mobile)',
    defaultWidth: 320,
    defaultHeight: 100,
    mobileOnly: true
  },
  {
    position: 'below_breadcrumb',
    name: 'Unter Breadcrumb',
    description: 'Slot unterhalb der Breadcrumb, oberhalb des Artikel-Titels',
    defaultWidth: 320,
    defaultHeight: 100,
  },
  { 
    position: 'above_intro', 
    name: 'Above Intro', 
    description: 'Vor dem Artikel-Einleitungstext',
    defaultWidth: 320,
    defaultHeight: 180
  },
  { 
    position: 'below_intro', 
    name: 'Below Intro', 
    description: 'Nach dem Artikel-Einleitungstext',
    defaultWidth: 320,
    defaultHeight: 480
  },
  { 
    position: 'in_content', 
    name: 'In-Content', 
    description: 'Zwischen Absätzen im Artikeltext (alle 2 Absätze, max 4)',
    defaultWidth: 300,
    defaultHeight: 250
  },
  { 
    position: 'below_author', 
    name: 'Below Author', 
    description: 'Nach der Autoren-Box',
    defaultWidth: 300,
    defaultHeight: 250
  },
  { 
    position: 'below_series_info', 
    name: 'Below Series Info', 
    description: 'Nach der Serien-Infobox',
    defaultWidth: 300,
    defaultHeight: 250
  },
  { 
    position: 'above_similar_news', 
    name: 'Above Similar News', 
    description: 'Über dem "Ähnliche News" Bereich',
    defaultWidth: 300,
    defaultHeight: 600
  },
  { 
    position: 'above_footer', 
    name: 'Above Footer', 
    description: 'Über dem Footer',
    defaultWidth: 300,
    defaultHeight: 600
  },
  {
    position: 'interstitial',
    name: 'Interstitial (Vollbild)',
    description:
      '300×600 Half-Page-Overlay auf Artikelseiten. Erscheint sofort bei JEDEM Page-View. Vor Bots & Google versteckt. AdSense-Slot oder eigenes HTML.',
    defaultWidth: 300,
    defaultHeight: 600,
  },
  // ─────────────── DESKTOP-ONLY POSITIONS (TheMoneytizer & SSP-Layout) ───────────────
  // Diese Positionen werden NUR im Desktop-Tab konfiguriert und auf der
  // Artikelseite ausschließlich ab `lg:` (≥1024 px) bzw. `xl:` (≥1280 px)
  // gerendert. Im Mobile-Tab erscheinen sie ebenfalls (aus Konsistenz-
  // Gründen), werden aber auf Mobile-Viewports nie ausgespielt.
  {
    position: 'desktop_billboard_header',
    name: 'Desktop · Billboard Header',
    description: 'Großformat-Banner ÜBER dem Megabanner Top (z.B. 970×250 Billboard).',
    defaultWidth: 970,
    defaultHeight: 250,
    desktopOnly: true,
  },
  {
    position: 'desktop_megabanner_top',
    name: 'Desktop · Megabanner Top',
    description: '970×90 Leaderboard direkt über Breadcrumb / Titel.',
    defaultWidth: 970,
    defaultHeight: 90,
    desktopOnly: true,
  },
  {
    position: 'desktop_skyscraper_left',
    name: 'Desktop · Skyscraper Links',
    description: 'Sticky-Skyscraper links neben dem Artikel (nur ab xl ≥1280 px).',
    defaultWidth: 160,
    defaultHeight: 600,
    desktopOnly: true,
  },
  {
    position: 'desktop_skyscraper_right',
    name: 'Desktop · Skyscraper Rechts',
    description: 'Sticky-Skyscraper rechts neben dem Artikel (nur ab xl ≥1280 px).',
    defaultWidth: 160,
    defaultHeight: 600,
    desktopOnly: true,
  },
  {
    position: 'desktop_sidebar_top_rect',
    name: 'Desktop · Sidebar Top MPU',
    description: 'Erstes Sidebar-Element rechts neben dem Artikel (300×250 MPU).',
    defaultWidth: 300,
    defaultHeight: 250,
    desktopOnly: true,
  },
  {
    position: 'desktop_sidebar_halfpage',
    name: 'Desktop · Sidebar Half Page',
    description: 'Zweites Sidebar-Element (300×600 Half Page).',
    defaultWidth: 300,
    defaultHeight: 600,
    desktopOnly: true,
  },
  {
    position: 'desktop_sidebar_megasky',
    name: 'Desktop · Sidebar Megaskyscraper',
    description: 'Drittes Sidebar-Element ganz unten in der Sticky-Spalte (300×600 / 300×1050).',
    defaultWidth: 300,
    defaultHeight: 600,
    desktopOnly: true,
  },
  {
    position: 'desktop_bottom_rect',
    name: 'Desktop · Bottom Medium Rectangle',
    description: '300×250 unterhalb der Sidebar/Article-Spalte vor dem Megabanner Bottom.',
    defaultWidth: 300,
    defaultHeight: 250,
    desktopOnly: true,
  },
  {
    position: 'desktop_megabanner_bottom',
    name: 'Desktop · Megabanner Bottom',
    description: '970×250 Megabanner ganz am Ende des Artikels (vor Similar News).',
    defaultWidth: 970,
    defaultHeight: 250,
    desktopOnly: true,
  },
  {
    position: 'desktop_corner_video',
    name: 'Desktop · Corner Video',
    description: 'Fixed bottom-right floating Video-Ad (TheMoneytizer Corner Video, mit Close-Button im Snippet).',
    defaultWidth: 320,
    defaultHeight: 180,
    desktopOnly: true,
  },
  {
    position: 'desktop_footer_slidein',
    name: 'Desktop · Footer Slide-in',
    description: 'Fixed bottom Full-Width Slide-in (z.B. 970×90, mit Close-Button im Snippet).',
    defaultWidth: 970,
    defaultHeight: 90,
    desktopOnly: true,
  },
];

interface AdVariant {
  label: string;
  html: string;
  weight: number;
  isActive: boolean;
}

interface AdSlot {
  id?: string;
  position: string;
  device: Device;
  name: string;
  description?: string;
  provider: 'adsense' | 'custom';
  adClient: string;
  adSlot: string;
  customHtmlVariants: AdVariant[];
  rotationMode: 'random' | 'weighted' | 'first';
  width: number;
  height: number;
  isActive: boolean;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}

const DEVICE_DEFAULTS: Record<Device, { width: number; height: number }> = {
  // Mobile: typische 300×250 / 300×600 Inventar.
  mobile: { width: 300, height: 250 },
  // Desktop: 728×90 Leaderboard / 300×600 Half-Page / 970×250 Billboard.
  // Wir starten mit Leaderboard als Default, weil das das gängigste
  // Desktop-Format ist und in fast alle Slots passt.
  desktop: { width: 728, height: 90 },
};

const positionKey = (position: string, device: Device) => `${position}__${device}`;

export default function AdsAdminPage() {
  const [slots, setSlots] = useState<AdSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<Device>('mobile');

  // Lade existierende Slots
  useEffect(() => {
    fetchSlots();
  }, []);

  const fetchSlots = async () => {
    try {
      const res = await fetch('/api/admin/ads');
      const data: AdSlot[] = await res.json();

      // Pro Position × Device EIN Eintrag. Wir mergen die DB-Werte gegen
      // die kanonische `AD_POSITIONS`-Liste — wenn eine (position, device)
      // Combo in der DB fehlt, gibt's einen leeren Default-Slot zum
      // Befüllen. So sieht der Admin SOFORT alle 10 Positionen × 2 Devices
      // = 20 Slots im UI (10 pro Tab).
      const mergedSlots: AdSlot[] = [];
      for (const pos of AD_POSITIONS) {
        for (const device of ['mobile', 'desktop'] as const) {
          const existing = data.find(
            (s) => s.position === pos.position && s.device === device,
          );
          if (existing) {
            mergedSlots.push({
              ...existing,
              device,
              provider: existing.provider || 'adsense',
              customHtmlVariants: Array.isArray(existing.customHtmlVariants)
                ? existing.customHtmlVariants
                : [],
              rotationMode: existing.rotationMode || 'random',
            });
          } else {
            // mobile_top ist als „mobile only" konzipiert — der Desktop-
            // Eintrag wird nicht auf der Live-Page gerendert (Wrapper hat
            // `lg:hidden`). Wir zeigen ihn im UI trotzdem als Platzhalter
            // an, damit das Admin-UI konsistent bleibt.
            // Defaults: shared positions bekommen device-spezifische
            // Standardmaße (Mobile 300×250, Desktop 728×90). Positions die
            // explizit `desktopOnly: true` markiert sind (z.B. Megabanner
            // 970×250) behalten ihre individuellen Pos-Defaults auch im
            // Desktop-Tab — DEVICE_DEFAULTS würde sonst ein 970×250
            // Billboard auf 728×90 schrumpfen.
            const useOwnDefaults =
              device === 'mobile' || pos.desktopOnly === true;
            mergedSlots.push({
              position: pos.position,
              device,
              name: pos.name,
              description: pos.description,
              provider: 'adsense',
              adClient: 'ca-pub-8583619451045805',
              adSlot: '',
              customHtmlVariants: [],
              rotationMode: 'random',
              width: useOwnDefaults ? pos.defaultWidth : DEVICE_DEFAULTS.desktop.width,
              height: useOwnDefaults ? pos.defaultHeight : DEVICE_DEFAULTS.desktop.height,
              isActive: false,
              mobileOnly: pos.mobileOnly === true,
              desktopOnly: pos.desktopOnly === true,
            });
          }
        }
      }

      setSlots(mergedSlots);
    } catch (error) {
      console.error('Error fetching slots:', error);
      setMessage({ type: 'error', text: 'Fehler beim Laden der Ad-Slots' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (slot: AdSlot) => {
    if (slot.provider === 'adsense' && !slot.adSlot) {
      setMessage({ type: 'error', text: 'AdSense braucht eine Slot-ID' });
      return;
    }
    if (slot.provider === 'custom' && (!slot.customHtmlVariants || slot.customHtmlVariants.length === 0 || !slot.customHtmlVariants.some(v => v.html.trim()))) {
      setMessage({ type: 'error', text: 'Custom-HTML braucht mindestens einen Variant mit Inhalt' });
      return;
    }

    const key = positionKey(slot.position, slot.device);
    setSaving(key);
    try {
      const res = await fetch('/api/admin/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slot),
      });

      if (res.ok) {
        setMessage({
          type: 'success',
          text: `${slot.name} (${slot.device}) gespeichert`,
        });
        fetchSlots();
      } else {
        throw new Error('Save failed');
      }
    } catch {
      setMessage({ type: 'error', text: 'Fehler beim Speichern' });
    } finally {
      setSaving(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDelete = async (position: string, device: Device) => {
    if (!confirm(`Slot ${position} (${device}) wirklich löschen?`)) return;

    try {
      const res = await fetch(
        `/api/admin/ads?position=${encodeURIComponent(position)}&device=${device}`,
        { method: 'DELETE' },
      );

      if (res.ok) {
        setMessage({ type: 'success', text: 'Gelöscht' });
        fetchSlots();
      }
    } catch {
      setMessage({ type: 'error', text: 'Fehler beim Löschen' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const updateSlot = (position: string, device: Device, field: string, value: unknown) => {
    setSlots(prev => prev.map(slot =>
      slot.position === position && slot.device === device
        ? { ...slot, [field]: value }
        : slot
    ));
  };

  const parseAdCode = (position: string, device: Device, adCode: string) => {
    const slotMatch = adCode.match(/data-ad-slot="([^"]+)"/);
    const clientMatch = adCode.match(/data-ad-client="([^"]+)"/);
    const widthMatch = adCode.match(/width[:\s]*(\d+)px/i);
    const heightMatch = adCode.match(/height[:\s]*(\d+)px/i);

    if (slotMatch) updateSlot(position, device, 'adSlot', slotMatch[1]);
    if (clientMatch) updateSlot(position, device, 'adClient', clientMatch[1]);
    if (widthMatch) updateSlot(position, device, 'width', parseInt(widthMatch[1]));
    if (heightMatch) updateSlot(position, device, 'height', parseInt(heightMatch[1]));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Ad-Verwaltung
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Mobile- und Desktop-Slots sind <strong>vollständig getrennt</strong> —
            pro Tab kannst du komplett unterschiedliche Provider, AdSense-IDs,
            Maße und Custom-HTML hinterlegen.
          </p>
        </div>

        {/* Device-Tabs */}
        <div className="mb-6 flex items-center gap-1 p-1 bg-gray-200 dark:bg-gray-800 rounded-xl w-fit">
          {(['mobile', 'desktop'] as const).map((d) => {
            const count = slots.filter((s) => s.device === d && s.isActive).length;
            const total = slots.filter((s) => s.device === d).length;
            const Icon = d === 'mobile' ? Smartphone : Monitor;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setActiveTab(d)}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === d
                    ? d === 'mobile'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-purple-500 text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                data-testid={`device-tab-${d}`}
              >
                <Icon className="w-5 h-5" />
                <span className="capitalize">{d}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    activeTab === d
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {count}/{total}
                </span>
              </button>
            );
          })}
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Refresh Button */}
        <div className="mb-6">
          <button
            onClick={fetchSlots}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Aktualisieren
          </button>
        </div>

        {/* Ad Slots — gefiltert nach activeTab */}
        <div className="space-y-6">
          {slots.filter(s => s.device === activeTab).map((slot) => {
            const posConfig = AD_POSITIONS.find(p => p.position === slot.position);
            const key = positionKey(slot.position, slot.device);

            return (
              <div
                key={key}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 transition-colors ${
                  slot.isActive 
                    ? 'border-green-500 dark:border-green-600' 
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {/* Slot Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${slot.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {slot.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {slot.description || posConfig?.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {slot.mobileOnly && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                        <Smartphone className="w-3 h-3" /> Mobile
                      </span>
                    )}
                    {slot.desktopOnly && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-xs">
                        <Monitor className="w-3 h-3" /> Desktop
                      </span>
                    )}
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs font-mono">
                      {slot.width}x{slot.height}
                    </span>
                  </div>
                </div>

                {/* Slot Body */}
                <div className="p-4 space-y-4">
                  {/* Provider Toggle */}
                  <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-900 rounded-lg w-fit">
                    <button
                      type="button"
                      onClick={() => updateSlot(slot.position, slot.device, 'provider', 'adsense')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        slot.provider === 'adsense'
                          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                      }`}
                      data-testid={`provider-adsense-${slot.position}`}
                    >
                      <Code className="w-4 h-4" /> AdSense
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSlot(slot.position, slot.device, 'provider', 'custom')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        slot.provider === 'custom'
                          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                      }`}
                      data-testid={`provider-custom-${slot.position}`}
                    >
                      <Layers className="w-4 h-4" /> Custom HTML
                    </button>
                  </div>

                  {slot.provider === 'adsense' ? (
                    <>
                      {/* AdSense Code Paste Area */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          AdSense-Code einfügen (automatische Erkennung)
                        </label>
                        <textarea
                          placeholder="Füge hier den kompletten AdSense-Code ein..."
                          className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-xs resize-none"
                          onChange={(e) => parseAdCode(slot.position, slot.device, e.target.value)}
                        />
                      </div>

                      {/* AdSense fields */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Slot-ID *
                          </label>
                          <input
                            type="text"
                            value={slot.adSlot}
                            onChange={(e) => updateSlot(slot.position, slot.device, 'adSlot', e.target.value)}
                            placeholder="z.B. 1234567890"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
                            data-testid={`slot-id-${slot.position}`}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Breite (px)
                          </label>
                          <input
                            type="number"
                            value={slot.width}
                            onChange={(e) => updateSlot(slot.position, slot.device, 'width', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Höhe (px)
                          </label>
                          <input
                            type="number"
                            value={slot.height}
                            onChange={(e) => updateSlot(slot.position, slot.device, 'height', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Client-ID
                          </label>
                          <input
                            type="text"
                            value={slot.adClient}
                            onChange={(e) => updateSlot(slot.position, slot.device, 'adClient', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Custom HTML mode */
                    <CustomHtmlEditor
                      slot={slot}
                      updateSlot={updateSlot}
                    />
                  )}

                  {/* Toggles — Device wird über die Tabs gesteuert, nicht
                      mehr über mobileOnly/desktopOnly Checkboxen. */}
                  <div className="flex flex-wrap items-center gap-6 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={slot.isActive}
                        onChange={(e) => updateSlot(slot.position, slot.device, 'isActive', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-green-500 focus:ring-green-500"
                      />
                      <span className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                        {slot.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        Aktiv (für {slot.device})
                      </span>
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      Position: {slot.position}
                    </div>
                    <div className="flex items-center gap-2">
                      {slot.id && (
                        <button
                          onClick={() => handleDelete(slot.position, slot.device)}
                          className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Löschen
                        </button>
                      )}
                      <button
                        onClick={() => handleSave(slot)}
                        disabled={
                          saving === key ||
                          (slot.provider === 'adsense' && !slot.adSlot) ||
                          (slot.provider === 'custom' && (slot.customHtmlVariants?.length === 0 || !slot.customHtmlVariants?.some(v => v.html?.trim())))
                        }
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                        data-testid={`save-${slot.position}`}
                      >
                        {saving === key ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Speichern
                      </button>
                    </div>
                  </div>

                  {/* Preview */}
                  {slot.provider === 'adsense' && slot.adSlot && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Vorschau (generierter Code):</p>
                      <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto">
{`<ins class="adsbygoogle"
     style="display:inline-block;width:${slot.width}px;height:${slot.height}px"
     data-ad-client="${slot.adClient}"
     data-ad-slot="${slot.adSlot}"></ins>`}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Help Section */}
        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Hinweise</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <li>• <b>AdSense</b>: Füge den kompletten AdSense-Code ein, Werte werden automatisch erkannt</li>
            <li>• <b>Custom HTML</b>: Beliebiger HTML-/JS-Code (Plista, Outbrain, Affiliate-Banner, Direct-Deals). Mehrere Varianten ergänzen → Rotation aktiv</li>
            <li>• <b>Rotation:</b> Random = gleichmäßig, Weighted = nach Gewicht, First = immer der erste aktive Variant</li>
            <li>• &quot;Aktiv&quot; muss aktiviert sein, damit die Werbung angezeigt wird</li>
            <li>• Änderungen werden nach 5 Minuten auf der Website sichtbar (Cache)</li>
            <li>• Ads werden nur auf Artikelseiten angezeigt</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Editor for the Custom-HTML provider mode. Each ad slot can have N variants;
 * if >1 active variant is present, the client-side ClientAdSlot picks one at
 * render time based on the rotationMode (random / weighted / first).
 */
function CustomHtmlEditor({
  slot,
  updateSlot,
}: {
  slot: AdSlot;
  updateSlot: (position: string, device: Device, field: string, value: unknown) => void;
}) {
  const variants = slot.customHtmlVariants || [];

  const updateVariant = (idx: number, field: keyof AdVariant, value: unknown) => {
    const next = variants.map((v, i) => (i === idx ? { ...v, [field]: value } : v));
    updateSlot(slot.position, slot.device, 'customHtmlVariants', next);
  };

  const addVariant = () => {
    const next = [
      ...variants,
      { label: `Variante ${variants.length + 1}`, html: '', weight: 1, isActive: true },
    ];
    updateSlot(slot.position, slot.device, 'customHtmlVariants', next);
  };

  const removeVariant = (idx: number) => {
    const next = variants.filter((_, i) => i !== idx);
    updateSlot(slot.position, slot.device, 'customHtmlVariants', next);
  };

  return (
    <div className="space-y-4">
      {/* Dimensions + rotation mode */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Breite (px) — nur für Platzhalter
          </label>
          <input
            type="number"
            value={slot.width}
            onChange={(e) => updateSlot(slot.position, slot.device, 'width', parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Höhe (px)
          </label>
          <input
            type="number"
            value={slot.height}
            onChange={(e) => updateSlot(slot.position, slot.device, 'height', parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Rotation
          </label>
          <select
            value={slot.rotationMode}
            onChange={(e) => updateSlot(slot.position, slot.device, 'rotationMode', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            data-testid={`rotation-mode-${slot.position}`}
          >
            <option value="random">Zufällig (Random)</option>
            <option value="weighted">Gewichtet (Weighted)</option>
            <option value="first">Erste aktive (First)</option>
          </select>
        </div>
      </div>

      {/* Variants */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
            HTML-Varianten {variants.length > 1 && <span className="text-cyan-600">(Rotation aktiv)</span>}
          </h4>
          <button
            type="button"
            onClick={addVariant}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg"
            data-testid={`add-variant-${slot.position}`}
          >
            <Plus className="w-4 h-4" /> Variant hinzufügen
          </button>
        </div>

        {variants.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400 p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-center">
            Noch keine Varianten. Klicke „Variant hinzufügen&quot; um zu starten.
          </div>
        )}

        {variants.map((v, idx) => (
          <div
            key={idx}
            className={`rounded-lg border-2 p-3 ${
              v.isActive
                ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10'
                : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 opacity-60'
            }`}
            data-testid={`variant-${slot.position}-${idx}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <input
                type="text"
                value={v.label}
                onChange={(e) => updateVariant(idx, 'label', e.target.value)}
                placeholder={`Variante ${idx + 1}`}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
              {slot.rotationMode === 'weighted' && (
                <input
                  type="number"
                  min="0"
                  value={v.weight}
                  onChange={(e) => updateVariant(idx, 'weight', parseInt(e.target.value) || 1)}
                  placeholder="Gewicht"
                  title="Gewicht (höher = häufiger)"
                  className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-center"
                />
              )}
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={v.isActive}
                  onChange={(e) => updateVariant(idx, 'isActive', e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Aktiv</span>
              </label>
              <button
                type="button"
                onClick={() => removeVariant(idx)}
                className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                title="Variant löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={v.html}
              onChange={(e) => updateVariant(idx, 'html', e.target.value)}
              placeholder="<!-- HTML-Code des Werbemittels — z.B. Plista, Outbrain, Affiliate-Banner, JustWatch-Widget, eigenes Direct-Deal-Creative -->"
              className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-xs resize-y"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
