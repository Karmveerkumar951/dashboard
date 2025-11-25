// RetailDashboard.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import StatCard from './StatCard';
import AnchoredPanel from './AnchoredPanel';
import ZoneModal from './ZoneModal';
import ProductRow from './ProductRow';

const FLOOR_PLAN_SRC = '/assets/floorplan.png';
const DEFAULT_PRODUCT_IMG = '/assets/placeholder-product.png';

const API_BASE = 'http://127.0.0.1:5000';
const POLL_INTERVAL_MS = 500; 

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
  if (typeof zone === 'string' && zone.length === 1) return zone;
  const z = String(zone);
  if (z.toLowerCase().startsWith('zone ')) {
    return z.slice(5).trim();
  }
  return z;
}

export default function RetailDashboard() {
  const [products, setProducts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 160);

  const [selectedSummary, setSelectedSummary] = useState('zones'); // 'zones' (default), 'total', 'misplaced', 'team'
  const anchoredOpen = selectedSummary !== 'zones';
  const anchoredType = anchoredOpen ? selectedSummary : null;

  const [selectedZone, setSelectedZone] = useState(null); // 'A'|'B'|'C'
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [zoneModalRect, setZoneModalRect] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const totalRef = useRef(null);
  const misplacedRef = useRef(null);
  const teamRef = useRef(null);
  const mapContainerRef = useRef(null);

  // refs for fetch lifecycle
  const fetchAbortRef = useRef(null);
  const mountedRef = useRef(true);

  // ---------- loadAll: fetch /check_all + /staff (no-store cache) ----------
  const loadAll = useCallback(async () => {
    // create a fresh abort controller for this request; do NOT abort previous poll requests here
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    // show loading if not already (prevents flicker)
    if (!loading) setLoading(true);

    try {
      // fetch check_all (no-store to avoid browser caching)
      const res = await fetch(`${API_BASE}/check_all`, { signal: controller.signal, cache: 'no-store' });
      if (!res.ok) throw new Error('API ' + res.status);
      const json = await res.json();

      // debug: inspect payload quickly while developing
      console.debug('check_all payload', json);

      if (!mountedRef.current) return;

      // Normalize JSON -> products. API returns UPPERCASE keys and DEV/DEV_DETECTED as 'A'|'B'|'C' (or null)
      const normalizedProducts = (Array.isArray(json) ? json : []).map(p => ({
        SKU: p.SKU,
        Name: p.NAME,
        Image: p.IMAGE,
        Status: p.STATUS,
        RFID: p.EPC,
        Zone: p.DEV_DETECTED,   // expected 'A'|'B'|'C' or null
        ZoneName: p.DEV,        // expected 'A'|'B'|'C' or null (product default zone)
        LastSeen: p.LAST_SEEN,
        Misplaced: (typeof p.ZONE_STATUS === 'boolean') ? !p.ZONE_STATUS : (p.STATUS === 'Misplaced'),
        _rawApi: p
      }));

      // fetch staff (optional)
      let normalizedStaff = [];
      try {
        const sres = await fetch(`${API_BASE}/staff`, { signal: controller.signal, cache: 'no-store' });
        if (sres.ok) {
          const sjson = await sres.json();
          normalizedStaff = (Array.isArray(sjson) ? sjson : []).map(s => ({
            id: s.ID ?? s.Id ?? s.id ?? '',
            Name: s.NAME ?? s.Name ?? s.name ?? '',
            RespectiveZone: s.RESPECTIVEZONE ?? s.RespectiveZone ?? s.Zone ?? s.zone ?? null,
            In: s.IN === true || String(s.IN).toLowerCase() === 'y' || String(s.IN).toLowerCase() === 'true',
            Phone: s.PHONE ?? s.Phone ?? s.phone ?? '',
            Image: s.IMAGE ?? s.Image ?? s.image ?? '',
            _raw: s
          }));
        }
      } catch (err) {
        // non-fatal: log and continue
        console.warn('staff fetch failed', err);
      }

      // atomic state update
      setProducts(normalizedProducts);
      setStaff(normalizedStaff);
    } catch (err) {
      if (err && err.name === 'AbortError') {
        // fetch aborted (likely on unmount) — ignore
      } else {
        console.error('Failed fetching check_all', err);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
      // clear controller if it's still ours
      if (fetchAbortRef.current === controller) fetchAbortRef.current = null;
    }
  }, [loading]);

  // ---------- polling + lifecycle ----------
  useEffect(() => {
    mountedRef.current = true;

    // initial load
    loadAll().catch(() => {});

    // interval polling
    let intervalId = setInterval(() => {
      // only poll while visible
      if (document.visibilityState === 'visible') {
        loadAll().catch(() => {});
      }
    }, POLL_INTERVAL_MS);

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        loadAll().catch(() => {});
        // ensure interval running
        if (!intervalId) {
          intervalId = setInterval(() => {
            if (document.visibilityState === 'visible') loadAll().catch(() => {});
          }, POLL_INTERVAL_MS);
        }
      } else {
        // when hidden, stop polling to be polite to CPU / disk
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    // also fetch on window focus (useful when switching back)
    function onFocus() {
      if (document.visibilityState === 'visible') loadAll().catch(() => {});
    }
    window.addEventListener('focus', onFocus);

    return () => {
      mountedRef.current = false;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      // abort any in-flight fetch
      try { if (fetchAbortRef.current) fetchAbortRef.current.abort(); } catch (e) { /* ignore */ }
    };
  }, [loadAll]);

  // Escape key to close panels
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

  // measure zone modal rect
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

  // compute zone misplaced counts (expects Zone/ZoneName are single-char 'A'|'B'|'C')
  function zoneMisplacedCounts() {
    const counts = { A: 0, B: 0, C: 0 };
    products.forEach(p => {
      const current = p.Zone;
      const defaultZone = p.ZoneName;
      if (current && defaultZone && current !== defaultZone) {
        counts[current] = (counts[current] || 0) + 1;
      }
    });
    return counts;
  }

  const zoneCounts = zoneMisplacedCounts();
  const maxZoneCount = Math.max(1, ...Object.values(zoneCounts));

  // threshold behavior (example: 5% of total, min 1)
  function thresholdForZone() {
    return Math.max(1, Math.round(totalItems * 0.05));
  }

  // overlay color by threshold (green/amber/red/transparent)
  function overlayColorForCountByThreshold(count, max) {
    const thr = thresholdForZone();
    if (!count || count === 0) return 'transparent';
    const ratio = max ? Math.min(1, count / max) : 0.2;
    if (count > thr) {
      const alpha = 0.18 + 0.5 * ratio;
      return `rgba(220,38,38,${alpha.toFixed(3)})`;
    } else if (count === thr) {
      const alpha = 0.14 + 0.45 * ratio;
      return `rgba(234,179,8,${alpha.toFixed(3)})`;
    } else {
      const alpha = 0.08 + 0.5 * ratio;
      return `rgba(34,197,94,${alpha.toFixed(3)})`;
    }
  }

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

  const summaryOrder = [
    { key: 'zones', title: 'TOTAL ZONES', value: (() => { const s = new Set(products.map(p => p.Zone).filter(Boolean)); return s.size || 3; })(), gradient: 'bg-gradient-to-br from-slate-700 via-slate-600 to-gray-500' },
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

                  {/* Zone overlays */}
                  <div role="button" tabIndex={0} onClick={() => onZoneClick('A')} className="absolute left-6 top-12 w-[32%] h-[46%] cursor-pointer" style={{ background: overlayColorForCountByThreshold(zoneCounts['A'] || 0, maxZoneCount), borderRadius: 12, boxShadow: 'inset 0 6px 18px rgba(255,255,255,0.03)' }}>
                    <div className="p-2 text-white font-semibold">Zone: {formatZoneName('A')}</div>
                    <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['A'] || 0}</div>
                  </div>

                  <div role="button" tabIndex={0} onClick={() => onZoneClick('B')} className="absolute right-6 top-12 w-[32%] h-[46%] cursor-pointer" style={{ background: overlayColorForCountByThreshold(zoneCounts['B'] || 0, maxZoneCount), borderRadius: 12, boxShadow: 'inset 0 6px 18px rgba(255,255,255,0.03)' }}>
                    <div className="p-2 text-white font-semibold">Zone: {formatZoneName('B')}</div>
                    <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['B'] || 0}</div>
                  </div>

                  <div role="button" tabIndex={0} onClick={() => onZoneClick('C')} className="absolute left-[34%] bottom-6 w-[32%] h-[28%] cursor-pointer" style={{ background: overlayColorForCountByThreshold(zoneCounts['C'] || 0, maxZoneCount), borderRadius: 12, boxShadow: 'inset 0 6px 18px rgba(255,255,255,0.03)' }}>
                    <div className="p-2 text-white font-semibold">Zone: {formatZoneName('C')}</div>
                    <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['C'] || 0}</div>
                  </div>
                </>
              )}

              {/* AnchoredPanel */}
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

              {/* Zone modal */}
              <ZoneModal
                open={showZoneModal}
                rect={zoneModalRect}
                zoneName={selectedZone}
                products={products}
                staff={staff}
                onClose={closeZoneModal}
                onOpenItem={openItemDetails}
                threshold={thresholdForZone()}
              />

              {/* Item details overlay */}
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
