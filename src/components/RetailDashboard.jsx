import React, { useEffect, useRef, useState } from 'react';
import StatCard from './StatCard';
import AnchoredPanel from './AnchoredPanel';
import ZoneModal from './ZoneModal';
import ProductRow from './ProductRow';

const FLOOR_PLAN_SRC = '/assets/floorplan.png';
const DEFAULT_PRODUCT_IMG = '/assets/placeholder-product.png';

// <-- Replace this with your real API base URL
const API_BASE = 'http://127.0.0.1:5000';

function useDebounce(value, delay = 160) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function formatZoneName(zone) {
  if (!zone) return '—';
  // zone here is expected to be the single character 'A'/'B'/'C' — return as-is or "Zone X" when desired
  if (typeof zone === 'string' && zone.length === 1) return zone;
  const z = String(zone);
  if (z.toLowerCase().startsWith('zone ')) {
    return z.slice(5).trim();
  }
  return z;
}

// DEV code -> character mapping
const DEV_TO_CHAR = {
  '087C002B': 'A',
  '087C002D': 'B',
  '087C002E': 'C',
  // allow lowercase or alternative spellings just in case
  '087c002b': 'A',
  '087c002d': 'B',
  '087c002e': 'C',
};

function devToChar(devCode) {
  if (!devCode && devCode !== '') return '';
  // accept either exact code string or objects; ensure string
  const s = String(devCode || '').trim();
  // handle bare character input (if already normalized)
  if (s.length === 1 && /[A-Z]/i.test(s)) return s.toUpperCase();
  return DEV_TO_CHAR[s] ?? '';
}

// reverse mapping (Zone char -> representative label used for counts / display)
function zoneCharToLabel(char) {
  if (!char) return '';
  return `Zone ${char}`;
}

export default function RetailDashboard() {
  const [products, setProducts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 160);

  // selectedSummary: 'zones' (default), 'total', 'misplaced', 'team'
  const [selectedSummary, setSelectedSummary] = useState('zones');
  const anchoredOpen = selectedSummary !== 'zones';
  const anchoredType = anchoredOpen ? selectedSummary : null;

  const [selectedZone, setSelectedZone] = useState(null); // will be 'A' | 'B' | 'C'
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [zoneModalRect, setZoneModalRect] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const totalRef = useRef(null);
  const misplacedRef = useRef(null);
  const teamRef = useRef(null);
  const mapContainerRef = useRef(null);

  // ---------- LOAD PRODUCTS + STAFF (USE UPPERCASE KEYS; DEV/Dev special-case handled) ----------
  useEffect(() => {
    async function loadAll() {
      setLoading(true);

      async function fetchStaffWithFallbacks() {
        const attempts = [`${API_BASE}/staff`];
        for (const url of attempts) {
          try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const j = await res.json();
            if (Array.isArray(j)) return j;
            if (j && Array.isArray(j.staff)) return j.staff;
          } catch (e) {
            // swallow
          }
        }
        return [];
      }

      try {
        const [prodRes, staffArr] = await Promise.all([
          (async () => {
            const res = await fetch(`${API_BASE}/check_all`);
            if (!res.ok) throw new Error(`API error ${res.status}`);
            return res.json();
          })(),
          fetchStaffWithFallbacks()
        ]);

        const apiJson = Array.isArray(prodRes) ? prodRes : [];

        const normalizedProducts = apiJson.map(p => {
          const SKU = p.SKU ?? '';
          const Name = p.NAME ?? '';
          const Image = p.IMAGE ?? '';
          const Status = p.STATUS ?? '';
          const RFID = p.EPC ?? '';
          // current detected DEV code (string like '087C002B') -> map to char
          const rawDevDetected = p.DEV_DETECTED ?? '';
          const Zone = devToChar(rawDevDetected); // 'A'|'B'|'C' or ''
          // default DEV (DEV in product JSON, Dev in RFID JSON) — check both
          const rawDevDefault = (p.DEV ?? p.Dev) ?? '';
          const ZoneName = devToChar(rawDevDefault);
          const LastSeen = p.LAST_SEEN ?? '';
          const ZoneStatus = p.ZONE_STATUS; // may be boolean

          const Misplaced = (typeof ZoneStatus === 'boolean') ? !ZoneStatus : (Status === 'Misplaced');

          return {
            SKU,
            Name,
            Image,
            Status,
            RFID,
            Zone,      // single character (A/B/C) for current detected zone
            ZoneName,  // single character (A/B/C) for default zone
            LastSeen,
            _rawApi: p,
            Misplaced
          };
        });

        const normalizedStaff = (Array.isArray(staffArr) ? staffArr : []).map(s => {
          const id = s.ID ?? s.Id ?? s.id ?? '';
          const Name = s.NAME ?? s.Name ?? s.name ?? '';
          // staff may also report Dev codes; normalize to single character if present
          const rawResZone = s.RESPECTIVEZONE ?? s.RespectiveZone ?? s.Zone ?? s.zone ?? s.Dev ?? s.DEV ?? '';
          const RespectiveZone = devToChar(rawResZone) || '';
          const InRaw = s.IN ?? s.In ?? s.in ?? 'N';

          return {
            id,
            Name,
            RespectiveZone,
            In: InRaw === true || String(InRaw).toLowerCase() === 'y' || String(InRaw).toLowerCase() === 'true',
            Phone: s.PHONE ?? s.Phone ?? s.phone ?? '',
            Image: s.IMAGE ?? s.Image ?? s.image ?? '',
            _raw: s
          };
        });

        setProducts(normalizedProducts);
        setStaff(normalizedStaff);
      } catch (err) {
        console.error('Failed loading data from API', err);
        setProducts([]);
        setStaff([]);
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        setSelectedSummary('zones');
        setShowZoneModal(false);
        setSelectedItem(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // measure map container rect for zone modal
  useEffect(() => {
    if (!showZoneModal) {
      setZoneModalRect(null);
      return;
    }

    function updateRect() {
      const el = mapContainerRef.current;
      if (!el) return setZoneModalRect(null);
      const r = el.getBoundingClientRect();
      setZoneModalRect({
        top: Math.max(0, Math.round(r.top)),
        left: Math.max(0, Math.round(r.left)),
        width: Math.round(r.width),
        height: Math.round(r.height),
      });
    }

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    let ro;
    const el = mapContainerRef.current;
    if (window.ResizeObserver && el) {
      ro = new ResizeObserver(updateRect);
      ro.observe(el);
    }

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      if (ro && el) ro.unobserve(el);
    };
  }, [showZoneModal]);

  // derived values
  const totalItems = products.length;
  const misplacedItems = products.filter(p => p.Misplaced);
  const totalTeam = staff.length;

  // compute zone counts keyed by the single character 'A'/'B'/'C'
  function zoneMisplacedCounts() {
    const zoneKeys = ['A', 'B', 'C'];
    const counts = { A: 0, B: 0, C: 0 };
    products.forEach(p => {
      const current = p.Zone;      // 'A' | 'B' | 'C' | ''
      const defaultZone = p.ZoneName; // 'A' | 'B' | 'C' | ''
      if (current && defaultZone && current !== defaultZone) {
        if (!counts[current]) counts[current] = 0;
        counts[current] += 1;
      }
    });
    return counts;
  }

  const zoneCounts = zoneMisplacedCounts();
  const maxZoneCount = Math.max(1, ...Object.values(zoneCounts));

  // threshold function: per-zone threshold. Currently adaptive: 5% of total items (min 1)
  function thresholdForZone() {
    return Math.max(1, Math.round(totalItems * 0.05));
  }

  // overlay color logic: color depends on whether zone has exceeded its threshold (not tied to misplaced button color)
  function overlayColorForCountByThreshold(count, max) {
    const thr = thresholdForZone();
    if (!count || count === 0) {
      // fully transparent
      return 'transparent';
    }
    const ratio = max ? Math.min(1, count / max) : 0.2;
    // style:
    // - below threshold -> green translucent
    // - equals threshold -> amber translucent
    // - above threshold -> red translucent (stronger)
    if (count > thr) {
      const alpha = 0.18 + 0.5 * ratio; // stronger red
      return `rgba(220,38,38,${alpha.toFixed(3)})`; // red-600-ish
    } else if (count === thr) {
      const alpha = 0.14 + 0.45 * ratio;
      return `rgba(234,179,8,${alpha.toFixed(3)})`; // amber-500-ish
    } else {
      const alpha = 0.08 + 0.5 * ratio;
      return `rgba(34,197,94,${alpha.toFixed(3)})`; // green-500-ish
    }
  }

  // panel color logic (keeps previous behavior)
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

  // summary order for right column
  const summaryOrder = [
    { key: 'zones', title: 'TOTAL ZONES', value: (() => {
      // unique zone chars used in products
      const s = new Set(products.map(p => p.Zone).filter(Boolean));
      return s.size || 3;
    })(), gradient: 'bg-gradient-to-br from-slate-700 via-slate-600 to-gray-500' },
    { key: 'total', title: 'TOTAL ITEMS', value: totalItems, gradient: getPanelGradient('total') },
    { key: 'misplaced', title: 'MISPLACED ITEMS', value: misplacedItems.length, gradient: getPanelGradient('misplaced') },
    { key: 'team', title: 'TOTAL TEAM', value: totalTeam, gradient: getPanelGradient('team') },
  ];

  function onSummaryClick(key) {
    setSelectedSummary(key);
  }

  function onZoneClick(zoneChar) {
    setSelectedZone(zoneChar);
    setShowZoneModal(true);
  }
  function closeZoneModal() {
    setSelectedZone(null);
    setShowZoneModal(false);
    setSelectedItem(null);
  }

  function openItemDetails(item) {
    setSelectedItem(item);
  }
  function closeItemDetails() {
    setSelectedItem(null);
  }

  // determine active panelColor & gradient to pass to AnchoredPanel
  const activePanelColor = anchoredType ? getPanelColor(anchoredType) : undefined;
  const activeGradient = anchoredType ? getPanelGradient(anchoredType) : '';

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-b from-gray-50 to-gray-100 font-sans" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' }}>
      <div className="max-w-[1400px] mx-auto h-full p-6 flex gap-6 relative">
        {/* Main content */}
        <div className="flex-1 flex flex-col gap-6">
          <div className={`flex items-center justify-between mb-2 ${anchoredOpen || showZoneModal ? 'hidden' : ''}`}>
            <h2 className="text-2xl font-extrabold text-gray-800">Store Floor — Live View</h2>
          </div>

          <div className="flex-1 bg-white rounded-3xl shadow-[0_20px_40px_rgba(2,6,23,0.06)] p-4 relative overflow-hidden flex flex-col" ref={mapContainerRef}>
            <div className="flex-1 relative rounded-2xl overflow-hidden border border-gray-200 shadow-inner">
              {(selectedSummary === 'zones' && !showZoneModal) && (
                <>
                  <img src={FLOOR_PLAN_SRC} alt="Floorplan" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_PRODUCT_IMG; }} />

                  {/* Zone overlays - use per-zone threshold state */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onZoneClick('A')}
                    className="absolute left-6 top-12 w-[32%] h-[46%] cursor-pointer"
                    style={{
                      background: overlayColorForCountByThreshold(zoneCounts['A'] || 0, maxZoneCount),
                      borderRadius: 12,
                      boxShadow: 'inset 0 6px 18px rgba(255,255,255,0.03)'
                    }}
                  >
                    <div className="p-2 text-white font-semibold">Zone: {formatZoneName('A')}</div>
                    <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['A'] || 0}</div>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onZoneClick('B')}
                    className="absolute right-6 top-12 w-[32%] h-[46%] cursor-pointer"
                    style={{
                      background: overlayColorForCountByThreshold(zoneCounts['B'] || 0, maxZoneCount),
                      borderRadius: 12,
                      boxShadow: 'inset 0 6px 18px rgba(255,255,255,0.03)'
                    }}
                  >
                    <div className="p-2 text-white font-semibold">Zone: {formatZoneName('B')}</div>
                    <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['B'] || 0}</div>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onZoneClick('C')}
                    className="absolute left-[34%] bottom-6 w-[32%] h-[28%] cursor-pointer"
                    style={{
                      background: overlayColorForCountByThreshold(zoneCounts['C'] || 0, maxZoneCount),
                      borderRadius: 12,
                      boxShadow: 'inset 0 6px 18px rgba(255,255,255,0.03)'
                    }}
                  >
                    <div className="p-2 text-white font-semibold">Zone: {formatZoneName('C')}</div>
                    <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['C'] || 0}</div>
                  </div>
                </>
              )}

              {/* Anchored panel (open when selectedSummary !== 'zones') */}
              <AnchoredPanel
                open={anchoredOpen}
                type={anchoredType}
                onClose={() => setSelectedSummary('zones')}
                products={products}
                staff={staff}
                onOpenItem={openItemDetails}
                searchQuery={debouncedQuery}
                setSearchQuery={setSearchQuery}
                panelColor={activePanelColor}
                gradientClass={activeGradient}
              />

              {/* zone modal */}
              <ZoneModal
                open={showZoneModal}
                rect={zoneModalRect}
                zoneName={selectedZone} // 'A'|'B'|'C'
                products={products}
                staff={staff}
                onClose={closeZoneModal}
                onOpenItem={openItemDetails}
                threshold={thresholdForZone()}
              />

              {/* item details overlay */}
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
                        <img src={selectedItem.Image ? (selectedItem.Image.startsWith('/') ? selectedItem.Image : `/assets/products/${selectedItem.Image}`) : (selectedItem.SKU ? `/assets/products/${selectedItem.SKU}.jpg` : DEFAULT_PRODUCT_IMG)} alt={selectedItem.Name} className="w-full h-64 object-cover rounded" onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=DEFAULT_PRODUCT_IMG }} />
                      </div>

                      <div className="col-span-2">
                        <div className="mb-4">
                          <h4 className="text-lg font-semibold">Details</h4>
                          <div className="mt-2 text-sm text-gray-700 space-y-1">
                            <div>Status: <span className="font-medium">{selectedItem.Status || '—'}</span></div>
                            <div>Default zone: <span className="font-medium">{selectedItem.ZoneName || '—'}</span></div>
                            <div>Current zone: <span className="font-medium">{selectedItem.Zone || '—'}</span></div>
                            <div>Last seen: <span className="font-medium">{selectedItem.LastSeen || '—'}</span></div>
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
        </div>

        {/* RIGHT-SIDE vertical stack — sticky, full column, evenly spaced */}
        <div className="w-[260px] flex items-stretch">
          <div className="sticky top-6 h-[calc(100vh-96px)] w-full flex flex-col justify-between">
            {summaryOrder.map(item => (
              <StatCard
                key={item.key}
                ref={item.key === 'total' ? totalRef : item.key === 'misplaced' ? misplacedRef : item.key === 'team' ? teamRef : null}
                title={item.title}
                value={loading ? '—' : item.value}
                onClick={() => onSummaryClick(item.key)}
                gradient={item.gradient}
                shadow="shadow-2xl"
                ariaLabel={item.title}
                active={selectedSummary === item.key}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
