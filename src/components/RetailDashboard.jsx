import React, { useEffect, useRef, useState } from 'react';

const FLOOR_PLAN_SRC = '/assets/floorplan.png';
const DEFAULT_PRODUCT_IMG = '/assets/placeholder-product.png';
const DEFAULT_STAFF_IMG = '/assets/placeholder-staff.png';

function useDebounce(value, delay = 160) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function fuzzyMatchPositions(text = '', query = '') {
  const t = String(text).toLowerCase();
  const q = String(query).toLowerCase();
  if (!q) return [];
  const idx = t.indexOf(q);
  if (idx >= 0) return Array.from({ length: q.length }, (_, i) => idx + i);
  let pos = -1;
  const positions = [];
  for (let i = 0; i < q.length; i++) {
    const ch = q[i];
    pos = t.indexOf(ch, pos + 1);
    if (pos === -1) return [];
    positions.push(pos);
  }
  return positions;
}

function Highlight({ text = '' }) {
  return <>{text}</>;
}

// helper to normalize zone strings
function formatZoneName(zone) {
  if (!zone) return '—';
  const z = String(zone);
  if (z.toLowerCase().startsWith('zone ')) {
    return z.slice(5).trim(); // strip leading "Zone " -> returns 'A', 'B', etc.
  }
  return z;
}

// No motion version
const StatCard = React.forwardRef(function StatCard({ title, value, onClick, gradient, shadow, ariaLabel, icon }, ref) {
  // Outer button: shows 1px gradient border via padding
  // Inner panel: white surface with dark text to create a premium outlined card
  return (
    <button
      ref={ref}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`rounded-md p-[6px] min-w-[180px] flex-1 focus:outline-none ${gradient} ${shadow}`}
    >
      {/* inner panel - visible card surface */}
      <div className={`rounded-md px-6 py-4 text-left bg-white`}> 
        <div className="flex items-center gap-3">
          {icon && (
            <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0" aria-hidden="true">
              {/* Icon inherits currentColor; set color to match gradient via inline style if needed by parent */}
              {icon}
            </div>
          )}
          <div className="flex-1">
            <div className="text-sm font-semibold tracking-wide text-gray-700">{title}</div>
            <div className="mt-2 text-3xl font-extrabold text-gray-900">{value}</div>
          </div>
        </div>
      </div>
    </button>
  );
});

// small inline SVG icons (no escaped quotes)
const IconBox = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4.46a2 2 0 0 0 2 0l7-4.46A2 2 0 0 0 21 16z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 9.5l5 3 5-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconAlert = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 9v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 17h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconUsers = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function RetailDashboard() {
  const [products, setProducts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [rfid, setRfid] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 160);
  const [anchoredPanel, setAnchoredPanel] = useState({ open: false, type: null, top: 0 });

  const [suggestions, setSuggestions] = useState([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!searchQuery) {
      setSuggestions([]);
      setSuggestionIndex(-1);
      return;
    }
    // Build suggestions depending on which panel is open:
    const q = String(searchQuery || '').trim().toLowerCase();
    if (!q) {
      setSuggestions([]);
      return;
    }
    const limit = 6;
    if (anchoredPanel.type === 'team') {
      setSuggestions(staff.filter(s => (s.Name || '').toLowerCase().startsWith(q)).slice(0, limit));
    } else if (anchoredPanel.type === 'misplaced') {
      // suggestions from misplaced items only
      const misplacedCandidates = products.filter(p => {
        const current = p.Zone || p.zone || p.ZoneName || p.zoneName;
        const defaultZone = p.ZoneName || p.zoneName || p.defaultZone || p.defaultzone;
        return current && defaultZone && current !== defaultZone;
      });
      setSuggestions(misplacedCandidates.filter(p => ((p.Name || '').toLowerCase().startsWith(q) || (p.SKU || '').toLowerCase().startsWith(q))).slice(0, limit));
    } else {
      // total / default: products
      setSuggestions(products.filter(p => (p.Name || '').toLowerCase().startsWith(q) || (p.SKU || '').toLowerCase().startsWith(q)).slice(0, limit));
    }
  }, [searchQuery, anchoredPanel.type, products, staff]);

  const [selectedZone, setSelectedZone] = useState(null);
  const [showZoneModal, setShowZoneModal] = useState(false);

  // item detail modal state
  const [selectedItem, setSelectedItem] = useState(null);
  function openItemDetails(item) {
    setSelectedItem(item);
  }
  function closeItemDetails() {
    setSelectedItem(null);
  }

  const totalRef = useRef(null);
  const misplacedRef = useRef(null);
  const teamRef = useRef(null);
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  useEffect(() => {
    async function loadAll() {
      try {
        const [prodRes, staffRes, rfidRes] = await Promise.all([
          fetch('/data/products.json'),
          fetch('/data/staff.json'),
          fetch('/data/rfid.json'),
        ]);
        const prodJson = prodRes.ok ? await prodRes.json() : [];
        const staffJson = staffRes.ok ? await staffRes.json() : [];
        const rfidJson = rfidRes.ok ? await rfidRes.json() : [];
        setProducts(Array.isArray(prodJson) ? prodJson : []);
        setStaff(Array.isArray(staffJson) ? staffJson : []);
        setRfid(Array.isArray(rfidJson) ? rfidJson : []);
      } catch (e) {
        console.error('Failed loading data', e);
        setProducts([]);
        setStaff([]);
        setRfid([]);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        setAnchoredPanel({ open: false, type: null, top: 0 });
        setShowZoneModal(false);
        setSelectedItem(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const totalItems = products.length;
  // misplacedItems (global) — items whose current zone != default zone
  const misplacedItems = products.filter(p => {
    const current = p.Zone || p.zone || p.ZoneName || p.zoneName;
    const defaultZone = p.ZoneName || p.zoneName || p.defaultZone || p.defaultzone;
    return current && defaultZone && current !== defaultZone;
  });
  const totalTeam = staff.length;

  function getPanelGradient(type) {
    if (type === 'total') return 'bg-gradient-to-br from-gray-800 via-gray-700 to-gray-600 shadow-lg';
    if (type === 'team') return 'bg-gradient-to-br from-slate-700 via-slate-600 to-gray-500 shadow-lg';
    if (misplacedItems.length === 0) return 'bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 shadow-2xl';
    if (misplacedItems.length >= Math.max(1, Math.round(totalItems * 0.2))) return 'bg-gradient-to-br from-red-500 via-rose-600 to-pink-600 shadow-2xl';
    return 'bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 shadow-2xl';
  }

  function getPanelColor(type) {
    if (type === 'total') return 'rgba(55,65,81,0.88)';
    if (type === 'team') return 'rgba(51,65,85,0.88)';
    if (misplacedItems.length === 0) return 'rgba(22,163,74,0.85)';
    if (misplacedItems.length >= Math.max(1, Math.round(totalItems * 0.2))) return 'rgba(220,38,38,0.85)';
    return 'rgba(249,115,22,0.85)';
  }

  function openAnchoredPanel(type) {
    setAnchoredPanel({ open: true, type, top: 0 });
  }

  function closeAnchoredPanel() {
    setAnchoredPanel({ open: false, type: null, top: 0 });
  }

  function onZoneClick(zoneName) {
    setSelectedZone(zoneName);
    setShowZoneModal(true);
  }
  function closeZoneModal() {
    setSelectedZone(null);
    setShowZoneModal(false);
    setSelectedItem(null);
  }

  function productImageUrl(p) {
    if (!p) return DEFAULT_PRODUCT_IMG;
    if (p.Image) return p.Image.startsWith('/') ? p.Image : `/assets/products/${p.Image}`;
    if (p.SKU) return `/assets/products/${p.SKU}.jpg`;
    return DEFAULT_PRODUCT_IMG;
  }
  function staffImageUrl(s) {
    if (!s) return DEFAULT_STAFF_IMG;
    if (s.Image) return s.Image.startsWith('/') ? s.Image : `/assets/staff/${s.Image}`;
    if (s.id) return `/assets/staff/${s.id}.jpg`;
    return DEFAULT_STAFF_IMG;
  }

  function scoredSearch(items = [], query = '', fields = ['Name']) {
    if (!query) return items.slice();
    const q = String(query).toLowerCase();

    return items
      .map(item => {
        const fieldValues = fields.map(f => (item[f] || item[f.toLowerCase()] || '')).filter(Boolean);
        let bestScore = 99;
        for (const raw of fieldValues) {
          const s = String(raw).toLowerCase();
          if (!s) continue;
          if (s.startsWith(q)) {
            bestScore = Math.min(bestScore, 0);
            break;
          } else if (s.includes(q)) {
            bestScore = Math.min(bestScore, 1);
          } else {
            const pos = fuzzyMatchPositions(s, q);
            if (pos.length > 0) bestScore = Math.min(bestScore, 2);
          }
        }
        return { item, score: bestScore };
      })
      .filter(x => x.score < 99)
      .sort((a, b) => a.score - b.score)
      .map(x => x.item);
  }

  // filtered lists
  const filteredProducts = scoredSearch(products, debouncedQuery, ['Name', 'SKU', 'RFID']);
  const filteredStaff = scoredSearch(staff, debouncedQuery, ['Name', 'id']);
  // filtered misplaced respects the search query when the misplaced panel is open
  const filteredMisplaced = scoredSearch(misplacedItems, debouncedQuery, ['Name', 'SKU', 'RFID']);

  function zoneMisplacedCounts() {
    const zones = ['Zone A', 'Zone B', 'Zone C'];
    const counts = {};
    zones.forEach(z => { counts[z] = 0; });
    products.forEach(p => {
      const current = p.Zone || p.zone || p.ZoneName;
      const defaultZone = p.ZoneName || p.zone || p.defaultZone;
      if (current && defaultZone && current !== defaultZone) {
        if (!counts[current]) counts[current] = 0;
        counts[current] += 1;
      }
    });
    return counts;
  }

  function heatColorForCount(count, max) {
    if (!max || max === 0) return 'hsla(120,70%,45%,0.08)';
    const ratio = Math.min(1, count / max);
    const hue = Math.round(120 * (1 - ratio));
    const alpha = 0.45 * Math.min(1, 0.2 + ratio * 0.8);
    return `hsla(${hue},70%,50%,${alpha})`;
  }

  const zoneCounts = zoneMisplacedCounts();
  const maxZoneCount = Math.max(1, ...Object.values(zoneCounts));

  // --- New helpers for the selected zone modal content ---
  const currentZone = selectedZone;
  const itemsInSelectedZone = currentZone
    ? products.filter(it => {
        const current = it.Zone || it.zone || it.ZoneName || it.zoneName;
        return current === currentZone;
      })
    : [];

  // misplaced items in the selected zone: items currently in the zone but whose default/home zone is different
  const misplacedInSelectedZone = currentZone
    ? products.filter(it => {
        const current = it.Zone || it.zone || it.ZoneName || it.zoneName;
        const defaultZone = it.ZoneName || it.zoneName || it.defaultZone || it.defaultzone;
        return current === currentZone && defaultZone && current !== defaultZone;
      })
    : [];

  // employees assigned to the selected zone
  const employeesInSelectedZone = currentZone
    ? staff.filter(s => (s.RespectiveZone === currentZone) || (s.ZoneName === currentZone) || (s.Zone === currentZone))
    : [];

  // zone summary values
  const totalInZoneCount = itemsInSelectedZone.length;
  const misplacedInZoneCount = misplacedInSelectedZone.length;

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-b from-gray-50 to-gray-100 font-sans" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' }}>
      <div className="max-w-[1400px] mx-auto h-full p-6 flex flex-col gap-6">
        <div className="flex gap-4 items-stretch">
          <StatCard ref={totalRef} title="TOTAL ITEMS" value={loading ? '—' : totalItems} onClick={() => openAnchoredPanel('total')} gradient={getPanelGradient('total')} shadow="shadow-2xl" icon={<IconBox />} />
          <StatCard ref={misplacedRef} title="MISPLACED ITEMS" value={loading ? '—' : misplacedItems.length} onClick={() => openAnchoredPanel('misplaced')} gradient={getPanelGradient('misplaced')} shadow="shadow-2xl" icon={<IconAlert />} />
          <StatCard ref={teamRef} title="TOTAL TEAM" value={loading ? '—' : totalTeam} onClick={() => openAnchoredPanel('team')} gradient={getPanelGradient('team')} shadow="shadow-2xl" icon={<IconUsers />} />
        </div>

        <div className="flex-1 bg-white rounded-3xl shadow-[0_20px_40px_rgba(2,6,23,0.06)] p-4 relative overflow-hidden flex flex-col" ref={mapContainerRef}>
          <div className={`flex items-center justify-between mb-2 ${anchoredPanel.open || showZoneModal ? 'hidden' : ''}`}>
            <h2 className="text-2xl font-extrabold text-gray-800">Store Floor — Live View</h2>
          </div>

          <div ref={mapRef} className="flex-1 relative rounded-2xl overflow-hidden border border-gray-200 shadow-inner">
            {!anchoredPanel.open && !showZoneModal && (
              <>
                <img
                  src={FLOOR_PLAN_SRC}
                  alt="Floorplan"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_PRODUCT_IMG; }}
                />

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onZoneClick('Zone A')}
                  className="absolute left-6 top-12 w-[32%] h-[46%] cursor-pointer"
                  style={{ background: heatColorForCount(zoneCounts['Zone A'] || 0, maxZoneCount), borderRadius: 12, boxShadow: 'inset 0 6px 18px rgba(255,255,255,0.03)' }}
                >
                  <div className="p-2 text-white font-semibold">Zone: {formatZoneName('Zone A')}</div>
                  <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['Zone A'] || 0}</div>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onZoneClick('Zone B')}
                  className="absolute right-6 top-12 w-[32%] h-[46%] cursor-pointer"
                  style={{ background: heatColorForCount(zoneCounts['Zone B'] || 0, maxZoneCount), borderRadius: 12, boxShadow: 'inset 0 6px 18px rgba(255,255,255,0.03)' }}
                >
                  <div className="p-2 text-white font-semibold">Zone: {formatZoneName('Zone B')}</div>
                  <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['Zone B'] || 0}</div>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onZoneClick('Zone C')}
                  className="absolute left-[34%] bottom-6 w-[32%] h-[28%] cursor-pointer"
                  style={{ background: heatColorForCount(zoneCounts['Zone C'] || 0, maxZoneCount), borderRadius: 12, boxShadow: 'inset 0 6px 18px rgba(255,255,255,0.03)' }}
                >
                  <div className="p-2 text-white font-semibold">Zone: {formatZoneName('Zone C')}</div>
                  <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['Zone C'] || 0}</div>
                </div>
              </>
            )}

            {anchoredPanel.open && (
              <div className="absolute left-0 right-0 z-50" style={{ top: anchoredPanel.top, bottom: 0 }}>
                <div className="absolute inset-x-0 top-0 bottom-0 rounded-t-xl overflow-hidden border border-white/10" style={{ background: getPanelColor(anchoredPanel.type), backdropFilter: 'blur(8px)' }}>
                  <div className="flex items-center justify-between p-4 border-b bg-white/5">
                    <h3 className="text-lg font-semibold text-white">
                      {anchoredPanel.type === 'total' ? `All items (${totalItems})` : anchoredPanel.type === 'misplaced' ? `Misplaced items (${misplacedItems.length})` : `Team (${totalTeam})`}
                    </h3>
                    <button onClick={closeAnchoredPanel} className="text-white text-xl rounded-md" aria-label="Close panel">✕</button>
                  </div>

                  <div className="p-4 overflow-auto h-[calc(100%-72px)] text-white">
                    <div className="mb-3 flex items-center gap-2 relative">
                      <div className="relative flex-1">
                        <input
                          value={searchQuery}
                          onChange={e => { setSearchQuery(e.target.value); setSuggestionIndex(-1); setShowSuggestions(true); }}
                          onFocus={() => setShowSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                          onKeyDown={(e) => {
                            if (!showSuggestions) return;
                            if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestionIndex(i => Math.min(i + 1, suggestions.length - 1)); }
                            else if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestionIndex(i => Math.max(i - 1, 0)); }
                            else if (e.key === 'Enter') {
                              if (suggestionIndex >= 0 && suggestionIndex < suggestions.length) {
                                const sel = suggestions[suggestionIndex];
                                setSearchQuery(sel.Name || sel.id || sel.SKU || '');
                                setShowSuggestions(false);
                                // open details for the selected suggestion
                                if (sel) openItemDetails(sel);
                              }
                            }
                          }}
                          placeholder="Search products / staff..."
                          aria-label="Search"
                          className="w-full p-2 border rounded text-black"
                        />

                        {showSuggestions && searchQuery && suggestions.length > 0 && (
                          <ul className="absolute left-0 right-0 mt-2 bg-white rounded shadow-lg max-h-56 overflow-auto z-50 border" role="listbox">
                            {suggestions.map((s, idx) => (
                              <li
                                key={(s.SKU || s.id) + idx}
                                role="option"
                                aria-selected={idx === suggestionIndex}
                                onMouseDown={(ev) => {
                                  ev.preventDefault();
                                  setSearchQuery(s.Name || s.id || s.SKU || '');
                                  setShowSuggestions(false);
                                  // open details immediately for this suggestion
                                  openItemDetails(s);
                                }}
                                className={`px-3 py-2 cursor-pointer flex items-center gap-3 ${idx === suggestionIndex ? 'bg-gray-100' : ''}`}
                              >
                                <img src={s.Image ? (s.Image.startsWith('/') ? s.Image : `/assets/products/${s.Image}`) : (s.id ? `/assets/staff/${s.id}.jpg` : `/assets/products/${s.SKU}.jpg`)} alt={s.Name || s.id} className="w-8 h-8 object-cover rounded" onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=(s.id?DEFAULT_STAFF_IMG:DEFAULT_PRODUCT_IMG) }} />
                                <div className="flex-1 text-sm text-gray-800"><Highlight text={s.Name || s.SKU || s.id || ''} /></div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <button onClick={() => { setSearchQuery(''); setShowSuggestions(false); }} className="px-3 py-2 bg-white/12 rounded-md text-white">Clear</button>
                    </div>

                    {anchoredPanel.type === 'total' && (
                      <div className="grid grid-cols-2 gap-3">
                        {filteredProducts.map(p => (
                          <div
                            key={p.SKU || p.id}
                            onClick={() => openItemDetails(p)}
                            role="button"
                            className={`p-3 border border-white/6 rounded-xl backdrop-blur-sm shadow-md flex gap-3 items-center cursor-pointer ${p.Zone !== p.ZoneName ? 'bg-red-500/20' : 'bg-white/6'}`}
                          >
                            <img src={productImageUrl(p)} alt={p.Name} className="w-20 h-20 object-cover rounded-lg border" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_PRODUCT_IMG; }} />
                            <div className="flex-1 text-white/95">
                              <div className="font-medium text-sm"><Highlight text={p.Name} /></div>
                              <div className="text-xs mt-1">SKU: <Highlight text={p.SKU || ''} /></div>
                              <div className="text-xs">RFID: <Highlight text={p.RFID || ''} /></div>
                              <div className="text-xs">Default zone: {formatZoneName(p.ZoneName || p.zoneName || p.defaultzone)}</div>
                              <div className="text-xs">Current zone: {formatZoneName(p.Zone || p.zone)}</div>
                              <div className="text-xs">Status: {p.Status || p.status}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {anchoredPanel.type === 'misplaced' && (
                      <div className="space-y-3">
                        {filteredMisplaced.map(p => (
                          <div
                            key={p.SKU || p.id}
                            onClick={() => openItemDetails(p)}
                            role="button"
                            className="border border-white/6 rounded-xl p-3 bg-white/6 backdrop-blur-sm shadow-md flex gap-3 items-center cursor-pointer"
                          >
                            <img src={productImageUrl(p)} alt={p.Name} className="w-20 h-20 object-cover rounded-lg border" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_PRODUCT_IMG; }} />
                            <div className="flex-1 text-white/95">
                              <div className="font-medium text-sm"><Highlight text={p.Name} /></div>
                              <div className="text-xs">SKU: {p.SKU} • RFID: {p.RFID}</div>
                              <div className="text-xs">Default zone: {formatZoneName(p.ZoneName || p.defaultzone)} • Current zone: {formatZoneName(p.Zone)}</div>
                              <div className="text-xs">Status: {p.Status || p.status}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {anchoredPanel.type === 'team' && (
                      <div className="space-y-3">
                        {filteredStaff.map(s => (
                          <div key={s.id} className="border border-white/6 rounded-xl p-3 bg-white/6 backdrop-blur-sm shadow-md flex gap-3 items-center">
                            <img src={staffImageUrl(s)} alt={s.Name} className="w-20 h-20 object-cover rounded-full border" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_STAFF_IMG; }} />
                            <div className="flex-1 text-white/95">
                              <div className="font-medium text-sm"><Highlight text={s.Name} /></div>
                              <div className="text-xs">Zone: {formatZoneName(s.RespectiveZone || s.ZoneName || s.Zone)}</div>
                              <div className="text-xs">In store: {String(s.In || s.InStore || s.In === 'Y' || s.In === true)}</div>
                              <div className="text-xs">Phone: {s.Phone || s.phone || s.phoneNumber}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SINGLE full-coverage zone modal (replaces earlier duplicates) */}
            {showZoneModal && (
              <div className="absolute inset-0 z-70" role="dialog" aria-modal="true">
                {/* Dark overlay behind modal */}
                <div className="absolute inset-0 bg-black/40" onClick={closeZoneModal} />

                {/* Panel that fully covers the map area (edge-to-edge) */}
                <div className="absolute inset-0 bg-white overflow-auto">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-semibold">Zone: {formatZoneName(selectedZone)} — Zone Details</h3>
                    <button onClick={closeZoneModal} className="text-gray-600" aria-label="Close zone modal">✕</button>
                  </div>

                  {/* Content: Zone Summary (first), Misplaced Items (second), Employees Assigned (third) */}
                  <div className="p-4 grid grid-cols-2 gap-4 h-[calc(100%-64px)]">
                    <div className="h-full">
                      <img src={FLOOR_PLAN_SRC} alt="Zone top view" className="w-full h-full object-contain" />
                    </div>

                    <div className="h-full overflow-auto">
                      {/* 1) Zone Summary */}
                      <div className="mb-4">
                        <h4 className="text-lg font-semibold">Zone Summary</h4>
                        <div className="mt-2 text-sm text-gray-700">
                          <div>Total items in Zone: <span className="font-medium">{totalInZoneCount}</span></div>
                          <div className="mt-1">Misplaced items in Zone: <span className="font-medium">{misplacedInZoneCount}</span></div>
                        </div>
                      </div>

                      {/* 2) Misplaced items (only items currently in this zone but belong elsewhere) */}
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold">Misplaced items in Zone</h4>
                        <div className="mt-3 space-y-2">
                          {misplacedInSelectedZone.length > 0 ? (
                            misplacedInSelectedZone.map(it => (
                              <button key={it.SKU || it.id} onClick={() => openItemDetails(it)} className="w-full p-2 border rounded flex items-center justify-between text-left hover:bg-gray-50">
                                <div className="flex items-center gap-3">
                                  <img src={productImageUrl(it)} alt={it.Name} className="w-12 h-12 object-cover rounded" onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=DEFAULT_PRODUCT_IMG }} />
                                  <div>
                                    <div className="font-medium">{it.Name}</div>
                                    <div className="text-xs text-gray-500">{it.SKU} • RFID: {it.RFID}</div>
                                    <div className="text-xs text-gray-500">Default zone: {formatZoneName(it.ZoneName || it.defaultzone || '—')}</div>
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="text-sm text-gray-500">No misplaced items in this zone.</div>
                          )}
                        </div>
                      </div>

                      {/* 3) Employees assigned to the zone */}
                      <div>
                        <h4 className="text-lg font-semibold">Employees assigned to Zone</h4>
                        <div className="mt-3 space-y-2">
                          {employeesInSelectedZone.length > 0 ? (
                            employeesInSelectedZone.map(s => (
                              <div key={s.id} className="p-2 border rounded flex items-center gap-3">
                                <img src={staffImageUrl(s)} alt={s.Name} className="w-12 h-12 rounded-full object-cover" onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=DEFAULT_STAFF_IMG }} />
                                <div>
                                  <div className="font-medium">{s.Name}</div>
                                  <div className="text-xs text-gray-500">Zone: {formatZoneName(s.RespectiveZone || s.ZoneName || '—')}</div>
                                  <div className="text-xs text-gray-500">In store: {String(s.In)}</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-gray-500">No employees assigned to this zone.</div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Item detail full-cover panel (covers previous panel) */}
                  {selectedItem && (
                    <div className="absolute inset-0 z-80" role="dialog" aria-modal="true">
                      <div className="absolute inset-0 bg-black/40" onClick={closeItemDetails} />
                      <div className="absolute inset-0 bg-white overflow-auto p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-2xl font-semibold">{selectedItem.Name}</h3>
                            <div className="text-sm text-gray-500">SKU: {selectedItem.SKU} • RFID: {selectedItem.RFID}</div>
                          </div>
                          <button onClick={closeItemDetails} className="text-gray-700 text-xl">✕</button>
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                          <div className="col-span-1">
                            <img src={productImageUrl(selectedItem)} alt={selectedItem.Name} className="w-full h-64 object-cover rounded" onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=DEFAULT_PRODUCT_IMG }} />
                          </div>

                          <div className="col-span-2">
                            <div className="mb-4">
                              <h4 className="text-lg font-semibold">Details</h4>
                              <div className="mt-2 text-sm text-gray-700 space-y-1">
                                <div>Status: <span className="font-medium">{selectedItem.Status || selectedItem.status || '—'}</span></div>
                                <div>Default zone: <span className="font-medium">{formatZoneName(selectedItem.ZoneName || selectedItem.defaultzone || '—')}</span></div>
                                <div>Current zone: <span className="font-medium">{formatZoneName(selectedItem.Zone || selectedItem.zone || '—')}</span></div>
                                <div>Additional info: <span className="font-medium">{selectedItem.Note || selectedItem.Notes || '—'}</span></div>
                              </div>
                            </div>

                            <div>
                              <h4 className="text-lg font-semibold">Actions</h4>
                              <div className="mt-2 flex gap-3">
                                <button onClick={() => alert('Mark as returned: ' + (selectedItem.SKU || selectedItem.id))} className="px-3 py-2 border rounded">Mark as returned</button>
                                <button onClick={() => alert('Assign to zone: ' + (selectedItem.SKU || selectedItem.id))} className="px-3 py-2 border rounded">Assign to zone</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
