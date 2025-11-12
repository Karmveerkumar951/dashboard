import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Note: include Inter in index.html for best typography
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

// Simple fuzzy subsequence matcher (returns positions of matches)
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

// Highlight component now returns plain text (highlighting removed)
function Highlight({ text = '', query = '' }) {
  return <>{text}</>;
}

const StatCard = React.forwardRef(function StatCard({ title, value, onClick, gradient, shadow, ariaLabel }, ref) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`rounded-2xl px-6 py-4 min-w-[180px] text-left flex-1 text-white border border-white/8 focus:outline-none transition-all transform hover:brightness-105 hover:-translate-y-0.5 ${gradient} ${shadow}`}
      aria-label={ariaLabel}
    >
      <div className="text-sm font-semibold tracking-wide">{title}</div>
      <div className="mt-2 text-3xl font-extrabold">{value}</div>
    </button>
  );
});

export default function RetailDashboard() {
  const [products, setProducts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [rfid, setRfid] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 160);
  const [anchoredPanel, setAnchoredPanel] = useState({ open: false, type: null, top: 0 });

  // suggestion state for search-as-you-type
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  function getPrefixSuggestions(query, type) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    const limit = 6;
    if (type === 'team') {
      return staff.filter(s => (s.Name || '').toLowerCase().startsWith(q)).slice(0, limit);
    }
    // default: products
    return products.filter(p => (p.Name || '').toLowerCase().startsWith(q)).slice(0, limit);
  }

  useEffect(() => {
    if (!searchQuery) {
      setSuggestions([]);
      setSuggestionIndex(-1);
      return;
    }
    const s = getPrefixSuggestions(searchQuery, anchoredPanel.type);
    setSuggestions(s);
    setSuggestionIndex(-1);
  }, [searchQuery, anchoredPanel.type, products, staff]);

  const [selectedZone, setSelectedZone] = useState(null);
  const [showZoneModal, setShowZoneModal] = useState(false);

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
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const totalItems = products.length;
  const misplacedItems = products.filter(p => (p.Zone || p.zone || p.ZoneName) && (p.ZoneName && p.Zone && p.Zone !== p.ZoneName));
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
    const ref = type === 'total' ? totalRef : type === 'misplaced' ? misplacedRef : teamRef;
    const mapEl = mapRef.current;
    const btn = ref.current;
    if (!mapEl || !btn) {
      setAnchoredPanel({ open: true, type, top: 0 });
      return;
    }
    const mapRect = mapEl.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const top = Math.max(0, btnRect.bottom - mapRect.top) - 6;
    setAnchoredPanel({ open: true, type, top });
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

  // Scored search: prioritizes prefix (startsWith) -> substring (includes) -> fuzzy
  function scoredSearch(items = [], query = '', fields = ['Name']) {
    if (!query) return items.slice();
    const q = String(query).toLowerCase();

    return items
      .map(item => {
        const fieldValues = fields.map(f => (item[f] || item[f.toLowerCase()] || '')).filter(Boolean);
        let bestScore = 99;
        let matchedField = '';
        for (const raw of fieldValues) {
          const s = String(raw).toLowerCase();
          if (!s) continue;
          if (s.startsWith(q)) {
            bestScore = Math.min(bestScore, 0);
            matchedField = raw;
            break;
          } else if (s.includes(q)) {
            bestScore = Math.min(bestScore, 1);
            matchedField = raw;
          } else {
            const pos = fuzzyMatchPositions(s, q);
            if (pos && pos.length > 0) {
              bestScore = Math.min(bestScore, 2);
              matchedField = raw;
            }
          }
        }
        return { item, score: bestScore, matchedField };
      })
      .filter(x => x.score < 99)
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        const an = (a.item.Name || a.item.SKU || '').toLowerCase();
        const bn = (b.item.Name || b.item.SKU || '').toLowerCase();
        return an.localeCompare(bn);
      })
      .map(x => x.item);
  }

  const effectiveQuery = debouncedQuery; // use debounced query for snappy UX

  const filteredProducts = scoredSearch(products, effectiveQuery, ['Name', 'SKU', 'RFID']);
  const filteredStaff = scoredSearch(staff, effectiveQuery, ['Name', 'id']);

  const staffInZone = selectedZone ? staff.filter(s => (s.RespectiveZone === selectedZone) || (s.ZoneName === selectedZone) || (s.Zone === selectedZone)) : [];

  const panelBg = anchoredPanel.type ? getPanelColor(anchoredPanel.type) : 'rgba(255,255,255,0.85)';

  // heatmap helpers
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

  const anchoredVariants = {
    hidden: { y: -12, opacity: 0, scale: 0.995 },
    visible: { y: 0, opacity: 1, scale: 1 },
    exit: { y: -10, opacity: 0, scale: 0.995 }
  };

  const zoneBackdrop = { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } };
  const zoneContent = { hidden: { opacity: 0, scale: 0.98, y: 8 }, visible: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.98, y: 8 } };

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-b from-gray-50 to-gray-100 font-sans" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' }}>
      <div className="max-w-[1400px] mx-auto h-full p-6 flex flex-col gap-6">
        <div className="flex gap-4 items-stretch">
          <StatCard ref={totalRef} title="TOTAL ITEMS" value={loading ? '—' : totalItems} onClick={() => openAnchoredPanel('total')} gradient={getPanelGradient('total')} shadow="shadow-2xl" />
          <StatCard ref={misplacedRef} title="MISPLACED ITEMS" value={loading ? '—' : misplacedItems.length} onClick={() => openAnchoredPanel('misplaced')} gradient={getPanelGradient('misplaced')} shadow="shadow-2xl" />
          <StatCard ref={teamRef} title="TOTAL TEAM" value={loading ? '—' : totalTeam} onClick={() => openAnchoredPanel('team')} gradient={getPanelGradient('team')} shadow="shadow-2xl" />
        </div>

        <div className="flex-1 bg-white rounded-3xl shadow-[0_20px_40px_rgba(2,6,23,0.06)] p-4 relative overflow-hidden flex flex-col" ref={mapContainerRef}>
          <div className={`flex items-center justify-between mb-2 ${anchoredPanel.open || showZoneModal ? 'hidden' : ''}`}>
            <h2 className="text-2xl font-extrabold text-gray-800 drop-shadow-sm">Store Floor — Live View</h2>
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
                  className="absolute left-6 top-12 w-[32%] h-[46%] cursor-pointer transition-all"
                  style={{ background: heatColorForCount(zoneCounts['Zone A'] || 0, maxZoneCount), borderRadius: 12, boxShadow: 'inset 0 6px 18px rgba(255,255,255,0.03)' }}
                >
                  <div className="p-2 text-white font-semibold drop-shadow-lg">Zone A</div>
                  <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['Zone A'] || 0}</div>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onZoneClick('Zone B')}
                  className="absolute right-6 top-12 w-[32%] h-[46%] cursor-pointer transition-all"
                  style={{ background: heatColorForCount(zoneCounts['Zone B'] || 0, maxZoneCount), borderRadius: 12, boxShadow: 'inset 0 6px 18px rgba(255,255,255,0.03)' }}
                >
                  <div className="p-2 text-white font-semibold drop-shadow-lg">Zone B</div>
                  <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['Zone B'] || 0}</div>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onZoneClick('Zone C')}
                  className="absolute left-[34%] bottom-6 w-[32%] h-[28%] cursor-pointer transition-all"
                  style={{ background: heatColorForCount(zoneCounts['Zone C'] || 0, maxZoneCount), borderRadius: 12, boxShadow: 'inset 0 6px 18px rgba(255,255,255,0.03)' }}
                >
                  <div className="p-2 text-white font-semibold drop-shadow-lg">Zone C</div>
                  <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['Zone C'] || 0}</div>
                </div>

              </>
            )}

            <AnimatePresence>
              {anchoredPanel.open && (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={anchoredVariants}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="absolute left-0 right-0 z-50"
                  style={{ top: anchoredPanel.top, bottom: 0 }}
                >
                  <div className="absolute inset-x-0 top-0 bottom-0 rounded-t-xl overflow-hidden border border-white/10" style={{ background: panelBg, backdropFilter: 'blur(8px)' }}>
                    <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, rgba(99,102,241,0.9), rgba(34,211,238,0.85))' }} />

                    <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                      <h3 className="text-lg font-semibold drop-shadow-lg text-white">
                        {anchoredPanel.type === 'total' ? `All items (${totalItems})` : anchoredPanel.type === 'misplaced' ? `Misplaced items (${misplacedItems.length})` : `Team (${totalTeam})`}
                      </h3>
                      <button onClick={closeAnchoredPanel} className="text-white text-xl drop-shadow-md" aria-label="Close panel">✕</button>
                    </div>

                    <div className="p-4 overflow-auto h-[calc(100%-72px)] text-white">
                      <div className="mb-3 flex items-center gap-2 relative">
                        {/* Search input with suggestion dropdown */}
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
                                }
                              }
                            }}
                            placeholder="Search products / staff..."
                            aria-label="Search"
                            className="w-full p-2 border rounded text-black"
                          />

                          {/* suggestions dropdown */}
                          {showSuggestions && searchQuery && suggestions.length > 0 && (
                            <ul className="absolute left-0 right-0 mt-2 bg-white rounded shadow-lg max-h-56 overflow-auto z-50 border" role="listbox">
                              {suggestions.map((s, idx) => (
                                <li
                                  key={(s.SKU || s.id) + idx}
                                  role="option"
                                  aria-selected={idx === suggestionIndex}
                                  onMouseDown={(ev) => { ev.preventDefault(); /* prevent blur */ setSearchQuery(s.Name || s.id || s.SKU || ''); setShowSuggestions(false); }}
                                  className={`px-3 py-2 cursor-pointer hover:bg-gray-100 flex items-center gap-3 ${idx === suggestionIndex ? 'bg-gray-100' : ''}`}
                                >
                                  <img src={s.Image ? (s.Image.startsWith('/') ? s.Image : `/assets/products/${s.Image}`) : (s.id ? `/assets/staff/${s.id}.jpg` : `/assets/products/${s.SKU}.jpg`)} alt={s.Name || s.id} className="w-8 h-8 object-cover rounded" onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=(s.id?DEFAULT_STAFF_IMG:DEFAULT_PRODUCT_IMG) }} />
                                  <div className="flex-1 text-sm text-gray-800"><Highlight text={s.Name || s.SKU || s.id || ''} query={searchQuery} /></div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <button onClick={() => { setSearchQuery(''); setShowSuggestions(false); }} className="px-3 py-2 bg-white/12 rounded text-white">Clear</button>
                      </div>

                      {anchoredPanel.type === 'total' && (
                        <div className="grid grid-cols-2 gap-3">
                          {filteredProducts.map(p => (
                            <div key={p.SKU || p.id} className="p-3 border border-white/6 rounded-xl bg-white/6 backdrop-blur-sm shadow-md flex gap-3 items-center">
                              <img src={productImageUrl(p)} alt={p.Name} className="w-20 h-20 object-cover rounded-lg border" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_PRODUCT_IMG; }} />
                              <div className="flex-1 text-white/95">
                                <div className="font-medium text-sm"><Highlight text={p.Name} query={debouncedQuery} /></div>
                                <div className="text-xs mt-1">SKU: <Highlight text={p.SKU || ''} query={debouncedQuery} /></div>
                                <div className="text-xs">RFID: <Highlight text={p.RFID || ''} query={debouncedQuery} /></div>
                                <div className="text-xs">Zone: {p.Zone || p.zone} • {p.ZoneName || p.zoneName}</div>
                                <div className="text-xs">Status: {p.Status || p.status}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {anchoredPanel.type === 'misplaced' && (
                        <div className="space-y-3">
                          {misplacedItems.map(p => (
                            <div key={p.SKU || p.id} className="border border-white/6 rounded-xl p-3 bg-white/6 backdrop-blur-sm shadow-md flex gap-3 items-center">
                              <img src={productImageUrl(p)} alt={p.Name} className="w-20 h-20 object-cover rounded-lg border" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_PRODUCT_IMG; }} />
                              <div className="flex-1 text-white/95">
                                <div className="font-medium text-sm"><Highlight text={p.Name} query={debouncedQuery} /></div>
                                <div className="text-xs">SKU: {p.SKU} • RFID: {p.RFID}</div>
                                <div className="text-xs">Default zone: {p.ZoneName || p.defaultzone} • Current zone: {p.Zone}</div>
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
                                <div className="font-medium text-sm"><Highlight text={s.Name} query={debouncedQuery} /></div>
                                <div className="text-xs">Zone: {s.RespectiveZone || s.ZoneName || s.Zone}</div>
                                <div className="text-xs">In store: {String(s.In || s.InStore || s.In === 'Y' || s.In === true)}</div>
                                <div className="text-xs">Phone: {s.Phone || s.phone || s.phoneNumber}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showZoneModal && (
                <>
                  <motion.div
                    key="zone-backdrop"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={zoneBackdrop}
                    transition={{ duration: 0.18 }}
                    className="absolute inset-0 z-60"
                    style={{ background: 'rgba(0,0,0,0.42)' }}
                    onClick={closeZoneModal}
                  />

                  <motion.div
                    key="zone-content"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={zoneContent}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    className="absolute inset-0 z-70 flex items-center justify-center p-6"
                    aria-modal="true"
                    role="dialog"
                  >
                    <div className="relative w-full h-full bg-white rounded-2xl shadow-2xl overflow-auto border border-gray-100">
                      <div className="flex items-center justify-between p-4 border-b">
                        <h3 className="text-lg font-semibold">{selectedZone} — Zone Details</h3>
                        <button onClick={closeZoneModal} className="text-gray-600 hover:text-gray-900" aria-label="Close zone modal">✕</button>
                      </div>

                      <div className="p-4 grid grid-cols-2 gap-4 h-[calc(100%-64px)]">
                        <div className="h-full">
                          <img src={FLOOR_PLAN_SRC} alt="Zone top view" className="w-full h-full object-contain rounded" />
                        </div>

                        <div className="h-full overflow-auto">
                          <h4 className="font-semibold">Misplaced items in {selectedZone}</h4>
                          <div className="mt-3 space-y-2">
                            {products.filter(it => ((it.Zone === selectedZone) || (it.zone === selectedZone) || (it.ZoneName === selectedZone) || (it.zoneName === selectedZone)) && (it.ZoneName !== it.zoneName)).map(it => (
                              <div key={it.SKU || it.id} className="p-2 border rounded flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <img src={productImageUrl(it)} alt={it.Name} className="w-12 h-12 object-cover rounded" onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=DEFAULT_PRODUCT_IMG }} />
                                  <div>
                                    <div className="font-medium">{it.Name}</div>
                                    <div className="text-xs text-gray-500">{it.SKU} • RFID: {it.RFID}</div>
                                  </div>
                                </div>
                                <div>
                                  <button onClick={() => alert('Open item ' + (it.SKU || it.id))} className="text-indigo-600 text-sm">Open</button>
                                </div>
                              </div>
                            ))}

                            {products.filter(it => ((it.Zone === selectedZone) || (it.zone === selectedZone) || (it.ZoneName === selectedZone) || (it.zoneName === selectedZone)) && (it.ZoneName !== it.zoneName)).length === 0 && (
                              <div className="text-sm text-gray-500">No misplaced items in this zone.</div>
                            )}
                          </div>

                          <div className="mt-6">
                            <h5 className="font-semibold">Employees assigned to {selectedZone}</h5>
                            <div className="mt-3 space-y-2">
                              {staffInZone.map(s => (
                                <div key={s.id} className="p-2 border rounded flex items-center gap-3">
                                  <img src={staffImageUrl(s)} alt={s.Name} className="w-12 h-12 rounded-full object-cover" onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=DEFAULT_STAFF_IMG }} />
                                  <div>
                                    <div className="font-medium">{s.Name}</div>
                                    <div className="text-xs text-gray-500">Zone: {s.RespectiveZone || s.ZoneName}</div>
                                    <div className="text-xs text-gray-500">In store: {s.In}</div>
                                  </div>
                                </div>
                              ))}

                              {staffInZone.length === 0 && <div className="text-sm text-gray-500">No employees assigned to this zone.</div>}
                            </div>

                            <div className="mt-6">
                              <h5 className="font-semibold">Zone Summary</h5>
                              <div className="text-sm text-gray-600 mt-2">Misplaced items: {products.filter(it=>it.Zone === selectedZone && it.ZoneName !== it.zoneName).length}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>
    </div>
  );
}
