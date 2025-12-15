// RetailDashboard.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import StatCard from './StatCard';
import AnchoredPanel from './AnchoredPanel';
import ZoneModal from './ZoneModal';
import ProductRow from './ProductRow';

const FLOOR_PLAN_SRC = '/assets/floorplan.png';
const DEFAULT_PRODUCT_IMG = '/assets/placeholder-product.png';

const API_BASE = 'http://127.0.0.1:5000';
const POLL_INTERVAL_MS = 5000; 

function useDebounce(value, delay = 160) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Zone constants — full readable names used internally everywhere */
const ZONES = {
  A: "Men's Wear",
  B: "Women's Wear",
  C: "Trial Room"
};

/** Map a zone value (single-char or full name) -> full readable name */
function mapZoneToName(zone) {
  if (!zone) return null;
  if (typeof zone === 'string' && zone.trim().length === 1) {
    const k = zone.trim().toUpperCase();
    return ZONES[k] || zone;
  }
  // already a string (maybe full name) -> return as-is trimmed
  return String(zone).trim();
}

/** Keep a tolerant formatZoneName used by UI components */
function formatZoneName(zone) {
  if (!zone) return '—';
  return mapZoneToName(zone) || '—';
}


function Quadrant({ children, count, color, onClick, className = '', style = {}, corner = 'top-left' }) {
  // corner: 'top-left' | 'top-right'
  // parent is the overlay rectangle that masks a big circle so only a quadrant shows
  // inner circle is 200% width/height and positioned so its center aligns with chosen corner
  const innerCommon = {
    position: 'absolute',
    width: '200%',
    height: '200%',
    borderRadius: '50%',
    // make sure the circle covers parent fully
    transform: 'translateZ(0)'
  };

  // position inner circle so its center is at chosen corner:
  // - for top-left: left:-100% top:-100%  (center at parent top-left)
  // - for top-right: left:0 top:-100%     (center at parent top-right)
  const innerPos = corner === 'top-right'
    ? { left: '0%', top: '-100%' }
    : { left: '-100%', top: '-100%' };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      className={className}
      style={{
        position: 'absolute',
        overflow: 'hidden',
        borderRadius: 12,
        ...style
      }}
    >
      {/* big circle positioned so only a quadrant shows inside parent */}
      <div style={{ ...innerCommon, ...innerPos, background: color }} />

      {/* overlay content (name / count) positioned above the quadrant */}
      <div style={{ position: 'absolute', inset: 0, padding: 12, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', color: 'white', fontWeight: 600 }}>
        <div>{children}</div>
        <div style={{ background: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: 8, fontSize: 12 }}>{count ?? 0}</div>
      </div>
    </div>
  );
}

/**
 * SVG-based HalfCircle (right-half semicircle).
 * - style param controls positioning/size (left/right/top/bottom/width/height).
 * - color should accept rgba(...) or any CSS color string.
 */
function HalfCircle({ children, count, color = 'rgba(220,38,38,0.18)', onClick, className = '', style = {} }) {
  // If color is 'transparent' or falsy, don't draw fill
  const fillColor = (!color || color === 'transparent') ? 'transparent' : color;

  // Original path draws a right-facing semicircle
  const pathD = 'M50 0 A50 50 0 0 1 50 100 L50 100 L50 0 Z';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      className={className}
      style={{
        position: 'absolute',
        overflow: 'visible',
        pointerEvents: 'auto',
        ...style
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none'
        }}
      >
        {/* Rotate semicircle 90° anticlockwise around the center (50,50) */}
        <path
          d={pathD}
          fill={fillColor}
          transform="rotate(-90 50 50)"
        />
      </svg>

      {/* Overlay content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: 12,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          color: 'white',
          fontWeight: 600,
          pointerEvents: 'auto'
        }}
      >
        <div style={{ textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}>{children}</div>
        <div
          style={{
            background: 'rgba(0,0,0,0.45)',
            padding: '4px 8px',
            borderRadius: 8,
            fontSize: 12
          }}
        >
          {count ?? 0}
        </div>
      </div>
    </div>
  );
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

  const [selectedZone, setSelectedZone] = useState(null); // now will store full zone name
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

  // ---------- helpers to normalize APIs ----------
  function normalizeProductFromProductsApi(p) {
    const detectedRaw = p.DEV_DETECTED ?? p.DevDetected ?? p.Dev ?? p.zone ?? p.Zone ?? null;
    const defaultRaw = p.DEV ?? p.DEVICE ?? p.Dev ?? p.ZoneName ?? p.defaultZone ?? null;

    return {
      SKU: p.SKU ?? p.sku ?? p.Sku,
      Name: p.NAME ?? p.Name ?? p.name ?? '',
      Image: p.IMAGE ?? p.Image ?? p.image ?? null,
      Status: p.STATUS ?? p.Status ?? p.status ?? null,
      RFID: p.EPC ?? p.RFID ?? p.rfid ?? null,
      // store full readable zone names
      Zone: mapZoneToName(detectedRaw),
      ZoneName: mapZoneToName(defaultRaw),
      LastSeen: p.LAST_SEEN ?? p.LastSeen ?? null,
      Misplaced: (typeof p.ZONE_STATUS === 'boolean') ? !p.ZONE_STATUS : (p.STATUS === 'Misplaced'),
      _rawApi: p
    };
  }

  function normalizeStaff(s) {
    const rawZone = s.RESPECTIVEZONE ?? s.RespectiveZone ?? s.Zone ?? s.zone ?? null;
    const zoneName = mapZoneToName(rawZone);

    return {
      id: s.ID ?? s.Id ?? s.id ?? '',
      Name: s.NAME ?? s.Name ?? s.name ?? '',
      // store the full zone name so comparisons use names
      RespectiveZone: zoneName,
      // keep original human readable value (if distinct) for display if needed
      RespectiveZoneName: rawZone ?? zoneName,
      In: s.IN === true || String(s.IN).toLowerCase() === 'y' || String(s.IN).toLowerCase() === 'true',
      Phone: s.PHONE ?? s.Phone ?? s.phone ?? '',
      Image: s.IMAGE ?? s.Image ?? s.image ?? '',
      _raw: s
    };
  }

  // ---------- fetch once: products + staff (no polling) ----------
  const fetchProductsAndStaffOnce = useCallback(async () => {
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    setLoading(true);

    try {
      // try products endpoint first
      try {
        const pres = await fetch(`${API_BASE}/products`, { signal: controller.signal, cache: 'no-store' });
        if (pres.ok) {
          const pjson = await pres.json();
          const normalized = (Array.isArray(pjson) ? pjson : []).map(normalizeProductFromProductsApi);
          if (!mountedRef.current) return;
          setProducts(normalized);
        }
      } catch (err) {
        console.warn('products fetch failed', err);
      }

      // fetch staff once
      try {
        const sres = await fetch(`${API_BASE}/staff`, { signal: controller.signal, cache: 'no-store' });
        if (sres.ok) {
          const sjson = await sres.json();
          if (!mountedRef.current) return;
          setStaff((Array.isArray(sjson) ? sjson : []).map(normalizeStaff));
        }
      } catch (err) {
        console.warn('staff fetch failed', err);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
      if (fetchAbortRef.current === controller) fetchAbortRef.current = null;
    }
  }, []);

  // ---------- poll: check_all only (merge updates into existing products) ----------
  const pollCheckAll = useCallback(async () => {
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/check_all`, { signal: controller.signal, cache: 'no-store' });
      if (!res.ok) throw new Error('API ' + res.status);
      const json = await res.json();
      if (!mountedRef.current) return;

      setProducts(prevProducts => {
        const byRfid = new Map();
        const bySku = new Map();
        prevProducts.forEach(p => {
          if (p.RFID) byRfid.set(String(p.RFID), p);
          if (p.SKU) bySku.set(String(p.SKU), p);
        });

        const updated = prevProducts.slice(); // shallow copy

        (Array.isArray(json) ? json : []).forEach(p => {
          const epc = p.EPC ?? p.RFID ?? null;
          const detectedRaw = p.DEV_DETECTED ?? p.DevDetected ?? p.Dev ?? p.zone ?? p.Zone ?? null;
          const defaultRaw = p.DEV ?? p.DEVICE ?? p.Dev ?? p.ZoneName ?? p.defaultZone ?? null;
          const detectedZone = mapZoneToName(detectedRaw);
          const defaultZone = mapZoneToName(defaultRaw);
          const lastSeen = p.LAST_SEEN ?? p.Time ?? p.LastSeen ?? null;
          const zoneStatus = p.ZONE_STATUS;
          const isMisplaced = (typeof zoneStatus === 'boolean') ? !zoneStatus : (p.STATUS === 'Misplaced');

          let target = null;
          if (epc && byRfid.has(String(epc))) target = byRfid.get(String(epc));
          if (!target && p.SKU && bySku.has(String(p.SKU))) target = bySku.get(String(p.SKU));

          if (target) {
            const idx = updated.findIndex(x => (x === target) || (x.RFID && target.RFID && x.RFID === target.RFID) || (x.SKU && target.SKU && x.SKU === target.SKU));
            if (idx >= 0) {
              const copy = { ...updated[idx] };
              copy.Zone = detectedZone ?? copy.Zone;
              copy.ZoneName = defaultZone ?? copy.ZoneName;
              copy.LastSeen = lastSeen ?? copy.LastSeen;
              copy.Misplaced = typeof zoneStatus !== 'undefined' ? isMisplaced : copy.Misplaced;
              copy._rawApi = p;
              updated[idx] = copy;
            }
          } else {
            // append a lightweight entry only if some identifying info exists
            const newItem = normalizeProductFromProductsApi(p);
            if (newItem.SKU || newItem.RFID || newItem.Name) updated.push(newItem);
          }
        });

        return updated;
      });

    } catch (err) {
      if (err && err.name === 'AbortError') {
        // ignore
      } else {
        console.error('Failed fetching check_all', err);
      }
    } finally {
      if (fetchAbortRef.current === controller) fetchAbortRef.current = null;
    }
  }, []);

  // ---------- polling + lifecycle ----------
  useEffect(() => {
    mountedRef.current = true;

    // initial one-time fetch for products + staff
    fetchProductsAndStaffOnce().catch(() => {});

    // immediate poll for check_all (so zones/status update quickly)
    pollCheckAll().catch(() => {});

    // interval polling only for check_all
    let intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        pollCheckAll().catch(() => {});
      }
    }, POLL_INTERVAL_MS);

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        pollCheckAll().catch(() => {});
        if (!intervalId) {
          intervalId = setInterval(() => {
            if (document.visibilityState === 'visible') pollCheckAll().catch(() => {});
          }, POLL_INTERVAL_MS);
        }
      } else {
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    function onFocus() {
      if (document.visibilityState === 'visible') pollCheckAll().catch(() => {});
    }
    window.addEventListener('focus', onFocus);

    return () => {
      mountedRef.current = false;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      try { if (fetchAbortRef.current) fetchAbortRef.current.abort(); } catch (e) { /* ignore */ }
    };
  }, [fetchProductsAndStaffOnce, pollCheckAll]);

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

  // compute zone misplaced counts using full zone names
  function zoneMisplacedCounts() {
    const counts = {};
    // initialize with known zones (so overlays show even when zero)
    Object.values(ZONES).forEach(name => counts[name] = 0);

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
    if (type === 'total') return 'bg-gray-800';
    if (type === 'team') return 'bg-slate-700';
    if (misplacedItems.length === 0) return 'bg-green-600';
    if (misplacedItems.length >= Math.max(1, Math.round(totalItems * 0.2))) return 'bg-red-600';
    return 'bg-amber-500';
  }

  function getPanelColor(type) {
    if (type === 'total') return 'rgba(55,65,81,1)';
    if (type === 'team') return 'rgba(51,65,85,1)';
    if (misplacedItems.length === 0) return 'rgba(22,163,74,1)';
    if (misplacedItems.length >= Math.max(1, Math.round(totalItems * 0.2))) return 'rgba(220,38,38,1)';
    return 'rgba(249,115,22,1)';
  }

  const summaryOrder = [
    { key: 'zones', title: 'TOTAL ZONES', value: (() => { const s = new Set(products.map(p => p.Zone).filter(Boolean)); return s.size || 3; })(), gradient: 'bg-slate-700' },
    { key: 'total', title: 'TOTAL ITEMS', value: totalItems, gradient: getPanelGradient('total') },
    { key: 'misplaced', title: 'MISPLACED ITEMS', value: misplacedItems.length, gradient: getPanelGradient('misplaced') },
    { key: 'team', title: 'TOTAL TEAM', value: totalTeam, gradient: getPanelGradient('team') },
  ];

  function onSummaryClick(key) {
    setSelectedSummary(key);
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

  function openItemDetails(item) {
    setSelectedItem(item);
  }
  function closeItemDetails() {
    setSelectedItem(null);
  }

  const activePanelColor = anchoredType ? getPanelColor(anchoredType) : undefined;
  const activeGradient = anchoredType ? getPanelGradient(anchoredType) : '';

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100 font-sans" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' }}>
      <div className="max-w-[1400px] mx-auto h-full p-6 flex gap-6 relative">
        {/* Main content */}
        <div className="flex-1 flex flex-col gap-6">
          <div className={`flex items-center justify-between mb-2 ${anchoredOpen || showZoneModal ? 'hidden' : ''}`}>
            <h2 className="text-2xl font-extrabold text-gray-800">Store Floor — Live View</h2>
          </div>

          <div className="flex-1 bg-white rounded-3xl p-4 relative overflow-hidden flex flex-col border border-gray-200" ref={mapContainerRef}>
            <div className="flex-1 relative rounded-2xl overflow-hidden border border-gray-200">
              {(selectedSummary === 'zones' && !showZoneModal) && (
                <>
                  <img src={FLOOR_PLAN_SRC} alt="Floorplan" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_PRODUCT_IMG; }} />

                  {/* === TOP-LEFT quadrant for Men's Wear === */}
                  <Quadrant
                    corner="top-left"
                    color={overlayColorForCountByThreshold(zoneCounts[ZONES.A] || 0, maxZoneCount)}
                    onClick={() => onZoneClick(ZONES.A)}
                    count={zoneCounts[ZONES.A] || 0}
                    className="cursor-pointer"
                    style={{
                      left: '6px',
                      top: '48px',           
                      width: '44%', 
                      height: '55%', 
                    }}
                  >
                    {ZONES.A}
                  </Quadrant>

                  {/* === TOP-RIGHT quadrant for Women's Wear === */}
                  <Quadrant
                    corner="top-right"
                    color={overlayColorForCountByThreshold(zoneCounts[ZONES.B] || 0, maxZoneCount)}
                    onClick={() => onZoneClick(ZONES.B)}
                    count={zoneCounts[ZONES.B] || 0}
                    className="cursor-pointer"
                    style={{
                      right: '6px',
                      top: '48px',
                      width: '44%', 
                      height: '55%', 
                    }}
                  >
                    {ZONES.B}
                  </Quadrant>

                  {/* === BOTTOM half-circle for Trial Room === */}
                  <HalfCircle
                    color={overlayColorForCountByThreshold(zoneCounts[ZONES.C] || 0, maxZoneCount)}
                    onClick={() => onZoneClick(ZONES.C)}
                    count={zoneCounts[ZONES.C] || 0}
                    className="cursor-pointer"
                    style={{
                      left: '20%',  
                      bottom: '0',  
                      width: '60%',
                      height: '40%',
                    }}
                  >
                    {ZONES.C}
                  </HalfCircle>
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