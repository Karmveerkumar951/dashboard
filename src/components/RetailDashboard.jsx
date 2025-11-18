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

function formatZoneName(zone) {
  if (!zone) return '—';
  const z = String(zone);
  if (z.toLowerCase().startsWith('zone ')) {
    return z.slice(5).trim();
  }
  return z;
}

const StatCard = React.forwardRef(function StatCard({ title, value, onClick, gradient, shadow, ariaLabel }, ref) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`rounded-md px-6 py-4 min-w-[160px] text-left flex-1 text-white border border-white/8 focus:outline-none ${gradient} ${shadow}`}
      aria-label={ariaLabel}
    >
      <div className="text-sm font-semibold tracking-wide">{title}</div>
      <div className="mt-2 text-3xl font-extrabold">{value}</div>
    </button>
  );
});

function statusPill(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('published')) return { label: status, className: 'bg-green-100 text-green-800' };
  if (s.includes('inactive') || s.includes('unsold')) return { label: status || 'Inactive', className: 'bg-red-100 text-red-800' };
  if (s.includes('stock') || s.includes('out')) return { label: status || 'Stock Out', className: 'bg-amber-100 text-amber-800' };
  if (s.includes('draft')) return { label: status || 'Draft', className: 'bg-gray-100 text-gray-800' };
  return { label: status || 'Unknown', className: 'bg-gray-100 text-gray-800' };
}

function stockLabel(stock) {
  const n = Number(stock);
  if (Number.isNaN(n)) return { text: '—', className: '' };
  if (n <= 0) return { text: 'Out of Stock', className: 'text-white' };
  if (n <= 50) return { text: `${n} Low Stock`, className: 'text-amber-500' };
  return { text: `${n}`, className: '' };
}

function ProductRow({ p, onClick }) {
  const stock = p.Stock ?? p.StockLevel ?? p.stock ?? null;
  const stockInfo = stockLabel(stock);
  const pill = statusPill(p.Status || p.status || '—');
  const sku = p.SKU || p.sku || '—';
  const name = p.Name || p.name || '—';
  const rfid = p.RFID || p.rfid || '—';
  const currentZone = p.Zone || p.zone || p.ZoneName || p.zoneName || '—';
  const zoneName = p.ZoneName || p.zoneName || p.defaultZone || p.defaultzone || '—';
  const imgSrc = p.Image ? (p.Image.startsWith('/') ? p.Image : `/assets/products/${p.Image}`) : (p.SKU ? `/assets/products/${p.SKU}.jpg` : DEFAULT_PRODUCT_IMG);

  return (
    <div onClick={() => onClick && onClick(p)} className="w-full flex items-center gap-4 px-3 py-3 border-b bg-white/6 hover:bg-white/8 cursor-pointer">
      <div className="flex items-center gap-3 min-w-[260px]">
        <img src={imgSrc} alt={name} className="w-12 h-12 object-cover rounded" onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=DEFAULT_PRODUCT_IMG }} />
        <div>
          <div className="font-medium text-sm text-white">{name}</div>
        </div>
      </div>

      <div className="w-40 text-sm text-gray-300">{sku}</div>
      <div className="w-40 text-sm text-gray-300">{rfid}</div>
      <div className="w-40 text-sm text-gray-300">{formatZoneName(currentZone)}</div>
      <div className="w-40 text-sm text-gray-300">{formatZoneName(zoneName)}</div>

      <div className="w-36 text-sm text-center">
        {stockInfo.text ? <span className={`${stockInfo.className} font-medium`}>{stockInfo.text}</span> : '—'}
      </div>

      <div className="w-36 flex justify-center">
        <span className={`inline-block px-3 py-1 rounded-full text-sm ${pill.className}`}>{pill.label}</span>
      </div>
    </div>
  );
}

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

  const [selectedZone, setSelectedZone] = useState(null);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [zoneModalRect, setZoneModalRect] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const totalRef = useRef(null);
  const misplacedRef = useRef(null);
  const teamRef = useRef(null);
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  function openItemDetails(item) { setSelectedItem(item); }
  function closeItemDetails() { setSelectedItem(null); }

  function mapApiItemToProduct(item = {}) {
    const SKU = item.SKU || item.sku || item.Sku || '';
    const NAME = item.NAME || item.Name || item.name || '';
    const IMAGE = item.IMAGE || item.Image || item.image || '';
    const STATUS = item.STATUS || item.Status || item.status || '';
    const EPC = item.EPC || item.epc || item.Epc || '';
    const DEV_DETECTED = item.DEV_DETECTED || item.DevDetected || item.dev_detected || item.devDetected || item.Dev || '';
    const DEV = item.DEV || item.Dev || item.dev || '';
    const ZONE_STATUS = typeof item.ZONE_STATUS !== 'undefined' ? item.ZONE_STATUS : (item.zone_status || item.zoneStatus || false);

    return {
      SKU,
      Name: NAME,
      Image: IMAGE,
      Status: STATUS,
      RFID: EPC,
      Zone: DEV_DETECTED,
      ZoneName: DEV,
      _rawApi: item,
      zoneStatus: !!ZONE_STATUS,
    };
  }

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      async function loadLocalFiles() {
        try {
          const [prodRes] = await Promise.all([ fetch('http://127.0.0.1:5000/check_all') ]);
          const prodJson = prodRes.ok ? await prodRes.json() : [];
          if (Array.isArray(prodJson) && prodJson.length > 0) {
            const normalized = prodJson.map(p => ({
              SKU: p.SKU +"###" || p.sku || p.Id || p.id || '',
              Name: p.NAME || p.Name || p.name || p.title || p.Title || '',
              Image: p.IMAGE || p.Image || p.image || p.img || '',
              Status: p.ZONE_STATUS || p.Status || p.status || '',
              RFID: p.EPC || p.RFID || p.rfid || '',
              Zone: p.currentZone || p.Zone || p.zone || '',
              ZoneName: p.defaultZone || p.ZoneName || p.zoneName || '',
              _rawApi: p
            }));
            setProducts(normalized);
          } else {
            setProducts([]);
          }
        } catch (e) {
          console.error('Failed loading local products.json', e);
          setProducts([]);
        }
      }

      try {
        const apiRes = await fetch('/check_all');
        if (apiRes.ok) {
          const apiJson = await apiRes.json();
          const mapped = Array.isArray(apiJson) ? apiJson.map(mapApiItemToProduct) : [];
          setProducts(mapped);
        } else {
          console.warn('/check_all returned', apiRes.status, apiRes.statusText);
          await loadLocalFiles();
        }
      } catch (err) {
        console.warn('Failed to fetch /check_all, falling back to local files', err);
        await loadLocalFiles();
      }

      try {
        const staffRes = await fetch('/data/staff.json');
        const staffJson = staffRes.ok ? await staffRes.json() : [];
        setStaff(Array.isArray(staffJson) ? staffJson : []);
      } catch (e) {
        console.warn('failed loading staff.json', e);
        setStaff([]);
      }

      try {
        const rfidRes = await fetch('/data/rfid.json');
        const rfidJson = rfidRes.ok ? await rfidRes.json() : [];
        setRfid(Array.isArray(rfidJson) ? rfidJson : []);
      } catch (e) {
        console.warn('failed loading rfid.json', e);
        setRfid([]);
      }

      setLoading(false);
    }

    loadAll();
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setSuggestions([]);
      setSuggestionIndex(-1);
      return;
    }
    const q = String(searchQuery || '').trim().toLowerCase();
    if (!q) {
      setSuggestions([]);
      return;
    }
    const limit = 6;
    if (anchoredPanel.type === 'team') {
      setSuggestions(staff.filter(s => (s.Name || '').toLowerCase().startsWith(q)).slice(0, limit));
    } else if (anchoredPanel.type === 'misplaced') {
      const misplacedCandidates = products.filter(p => {
        const current = p.Zone || p.zone || p.ZoneName || p.zoneName;
        const defaultZone = p.ZoneName || p.zoneName || p.defaultZone || p.defaultzone;
        return current && defaultZone && current !== defaultZone;
      });
      setSuggestions(misplacedCandidates.filter(p => ((p.Name || '').toLowerCase().startsWith(q) || (p.SKU || '').toLowerCase().startsWith(q))).slice(0, limit));
    } else {
      setSuggestions(products.filter(p => (p.Name || '').toLowerCase().startsWith(q) || (p.SKU || '').toLowerCase().startsWith(q)).slice(0, limit));
    }
  }, [searchQuery, anchoredPanel.type, products, staff]);

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
      ro = new ResizeObserver(() => updateRect());
      ro.observe(el);
    }

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      if (ro && el) ro.unobserve(el);
    };
  }, [showZoneModal]);

  const totalItems = products.length;
  const misplacedItems = products.filter(p => {
    const current = p.Zone || p.zone || p.ZoneName || p.zoneName;
    const defaultZone = p.ZoneName || p.zoneName || p.defaultZone || p.defaultzone;
    return current && defaultZone && current !== defaultZone;
  });
  const totalTeam = staff.length;

  const zonesSet = new Set();
  products.forEach(p => {
    const vals = [p.Zone, p.zone, p.ZoneName, p.zoneName, p.defaultZone, p.defaultzone].filter(Boolean);
    vals.forEach(v => {
      const s = String(v).trim();
      if (s) zonesSet.add(formatZoneName(s).length === 1 ? `Zone ${formatZoneName(s)}` : s);
    });
  });
  const totalZones = zonesSet.size || 3;

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

  function openAnchoredPanel(type) { setAnchoredPanel({ open: true, type, top: 0 }); }
  function closeAnchoredPanel() { setAnchoredPanel({ open: false, type: null, top: 0 }); }

  function onZoneClick(zoneName) { setSelectedZone(zoneName); setShowZoneModal(true); }
  function closeZoneModal() { setSelectedZone(null); setShowZoneModal(false); setSelectedItem(null); }

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

  const filteredProducts = scoredSearch(products, debouncedQuery, ['Name', 'SKU', 'RFID']);
  const filteredStaff = scoredSearch(staff, debouncedQuery, ['Name', 'id']);
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

  const currentZone = selectedZone;
  const itemsInSelectedZone = currentZone
    ? products.filter(it => {
        const current = it.Zone || it.zone || it.ZoneName || it.zoneName;
        return current === currentZone;
      })
    : [];

  const misplacedInSelectedZone = currentZone
    ? products.filter(it => {
        const current = it.Zone || it.zone || it.ZoneName || it.zoneName;
        const defaultZone = it.ZoneName || it.zoneName || it.defaultZone || it.defaultzone;
        return current === currentZone && defaultZone && current !== defaultZone;
      })
    : [];

  const employeesInSelectedZone = currentZone
    ? staff.filter(s => (s.RespectiveZone === currentZone) || (s.ZoneName === currentZone) || (s.Zone === currentZone))
    : [];

  const totalInZoneCount = itemsInSelectedZone.length;
  const misplacedInZoneCount = misplacedInSelectedZone.length;

  function staffRole(s) { return s.Role || s.Title || s.Position || 'Project Manager'; }
  function staffDepartment(s) { return s.Department || s.Team || s.group || '—'; }
  function staffHiredDate(s) { return s.HireDate || s.HiredDate || s.hiredDate || s.hireDate || '—'; }
  function staffEmail(s) { return s.Email || s.EmailAddress || s.email || '—'; }
  function staffPhone(s) { return s.Phone || s.phone || s.phoneNumber || '—'; }

  return (
    <div className="h-screen w-screen overflow-hidden from-gray-50 to-gray-100 font-sans" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' }}>
      <div className="max-w-[1400px] mx-auto h-full p-6 flex flex-col gap-6">
        <div className="flex gap-4 items-stretch">
          <div className="rounded-md px-6 py-4 min-w-[140px] text-left text-white bg-slate-600 flex items-center justify-center">Total Zones: <span className="ml-2 font-extrabold">{totalZones}</span></div>
          <StatCard ref={totalRef} title="TOTAL ITEMS" value={loading ? '—' : totalItems} onClick={() => openAnchoredPanel('total')} gradient={getPanelGradient('total')} shadow="shadow-2xl" />
          <StatCard ref={misplacedRef} title="MISPLACED ITEMS" value={loading ? '—' : misplacedItems.length} onClick={() => openAnchoredPanel('misplaced')} gradient={getPanelGradient('misplaced')} shadow="shadow-2xl" />
          <StatCard ref={teamRef} title="TOTAL TEAM" value={loading ? '—' : totalTeam} onClick={() => openAnchoredPanel('team')} gradient={getPanelGradient('team')} shadow="shadow-2xl" />
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

                <div role="button" tabIndex={0} onClick={() => onZoneClick('Zone A')} className="absolute left-6 top-12 w-[32%] h-[46%] cursor-pointer" style={{ background: heatColorForCount(zoneCounts['Zone A'] || 0, maxZoneCount), borderRadius: 12, boxShadow: 'inset 0 6px 18px rgba(255,255,255,0.03)' }}>
                  <div className="p-2 text-white font-semibold">Zone: {formatZoneName('Zone A')}</div>
                  <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['Zone A'] || 0}</div>
                </div>

                <div role="button" tabIndex={0} onClick={() => onZoneClick('Zone B')} className="absolute right-6 top-12 w-[32%] h-[46%] cursor-pointer" style={{ background: heatColorForCount(zoneCounts['Zone B'] || 0, maxZoneCount), borderRadius: 12, boxShadow: 'inset 0 6px 18px rgba(255,255,255,0.03)' }}>
                  <div className="p-2 text-white font-semibold">Zone: {formatZoneName('Zone B')}</div>
                  <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['Zone B'] || 0}</div>
                </div>

                <div role="button" tabIndex={0} onClick={() => onZoneClick('Zone C')} className="absolute left-[34%] bottom-6 w-[32%] h-[28%] cursor-pointer" style={{ background: heatColorForCount(zoneCounts['Zone C'] || 0, maxZoneCount), borderRadius: 12, boxShadow: 'inset 0 6px 18px rgba(255,255,255,0.03)' }}>
                  <div className="p-2 text-white font-semibold">Zone: {formatZoneName('Zone C')}</div>
                  <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['Zone C'] || 0}</div>
                </div>
              </>
            )}

            {anchoredPanel.open && (
              <div className="absolute left-0 right-0 z-50" style={{ top: anchoredPanel.top, bottom: 0 }}>
                <div className="absolute inset-x-0 top-0 bottom-0 rounded-t-xl overflow-hidden border border-white/10 flex flex-col" style={{ background: getPanelColor(anchoredPanel.type), backdropFilter: 'blur(8px)' }}>
                  <div className="flex items-center justify-between p-4 border-b bg-white/5">
                    <h3 className="text-lg font-semibold text-white">
                      {anchoredPanel.type === 'total' ? `All items (${totalItems})` : anchoredPanel.type === 'misplaced' ? `Misplaced items (${misplacedItems.length})` : `Team (${totalTeam})`}
                    </h3>
                    <button onClick={closeAnchoredPanel} className="text-white text-xl rounded-md" aria-label="Close panel">✕</button>
                  </div>

                  <div className="p-4 border-b bg-white/5 z-40">
                    <div className="mb-0 flex items-center gap-2 relative">
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
                  </div>

                  <div className="p-4 overflow-auto flex-1 text-white">
                    {anchoredPanel.type !== 'team' && (
                      <>
                        <div className="w-full flex items-center gap-4 px-3 py-2 text-sm text-gray-300 border-b">
                          <div className="min-w-[260px] font-medium">Product</div>
                          <div className="w-40 font-medium">SKU</div>
                          <div className="w-40 font-medium">RFID</div>
                          <div className="w-40 font-medium">Current Zone</div>
                          <div className="w-40 font-medium">ZoneName</div>
                          <div className="w-36 text-center font-medium">Stock</div>
                          <div className="w-36 text-center font-medium">Status</div>
                        </div>

                        {anchoredPanel.type === 'total' && (
                          <div className="mt-3">
                            {filteredProducts.map(p => (
                              <ProductRow key={p.SKU || p.RFID || p._rawApi?.EPC || Math.random()} p={p} onClick={() => openItemDetails(p)} />
                            ))}
                          </div>
                        )}

                        {anchoredPanel.type === 'misplaced' && (
                          <div className="mt-3">
                            {filteredMisplaced.map(p => (
                              <ProductRow key={p.SKU || p.RFID || p._rawApi?.EPC || Math.random()} p={p} onClick={() => openItemDetails(p)} />
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {anchoredPanel.type === 'team' && (
                      <div className="mt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {filteredStaff.map(s => (
                            <div key={s.id} className="relative bg-white rounded-xl p-4 shadow-sm border">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="relative">
                                    <img src={staffImageUrl(s)} alt={s.Name} className="w-12 h-12 object-cover rounded-full border" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_STAFF_IMG; }} />
                                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${s.In || s.InStore || s.In === true || s.In === 'Y' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                  </div>
                                  <div className="text-left">
                                    <div className="font-semibold text-gray-900">{s.Name}</div>
                                    <div className="text-xs text-gray-500">{staffRole(s)}</div>
                                  </div>
                                </div>
                                <div className="text-gray-400">⋯</div>
                              </div>

                              <div className="mt-4 bg-gray-50 rounded p-3 text-sm text-gray-700">
                                <div className="flex justify-between">
                                  <div className="text-xs text-gray-500">Department</div>
                                  <div className="text-xs font-medium">{staffDepartment(s)}</div>
                                </div>
                                <div className="mt-2 flex justify-between">
                                  <div className="text-xs text-gray-500">Hired Date</div>
                                  <div className="text-xs font-medium">{staffHiredDate(s)}</div>
                                </div>

                                <div className="mt-3 flex items-center gap-3 text-xs text-gray-600">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8.5v7A2.5 2.5 0 0 0 5.5 18h13A2.5 2.5 0 0 0 21 15.5v-7A2.5 2.5 0 0 0 18.5 6h-13A2.5 2.5 0 0 0 3 8.5z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 8.5l-9 6-9-6" />
                                  </svg>
                                  <div className="truncate">{staffEmail(s)}</div>
                                </div>

                                <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M22 16.92V21a1 1 0 0 1-1.11 1 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2 3.11 1 1 0 0 1 3 2h4.09a1 1 0 0 1 1 .75c.12.73.33 1.44.62 2.11a1 1 0 0 1-.24 1.04L7.7 8.7a16 16 0 0 0 6 6l1.78-1.78a1 1 0 0 1 1.04-.24c.67.29 1.38.5 2.11.62a1 1 0 0 1 .75 1z" />
                                  </svg>
                                  <div className="truncate">{staffPhone(s)}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {filteredStaff.length === 0 && (
                          <div className="mt-6 text-sm text-gray-200">No team members found.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showZoneModal && zoneModalRect && (
              <div role="dialog" aria-modal="true" className="z-[900]" style={{ position: 'fixed', top: zoneModalRect.top, left: zoneModalRect.left, width: zoneModalRect.width, height: zoneModalRect.height, pointerEvents: 'auto' }}>
                <div className="absolute inset-0" onClick={closeZoneModal} style={{ background: 'rgba(0,0,0,0.4)' }} />

                <div className="absolute inset-0 bg-white overflow-auto rounded-none">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-semibold">Zone: {formatZoneName(selectedZone)} — Zone Details</h3>
                    <button onClick={closeZoneModal} className="text-gray-600" aria-label="Close zone modal">✕</button>
                  </div>

                  <div className="p-4 grid grid-cols-2 gap-4 h-[calc(100%-64px)]">
                    <div className="h-full">
                      <img src={FLOOR_PLAN_SRC} alt="Zone top view" className="w-full h-full object-contain" />
                    </div>

                    <div className="h-full overflow-auto">
                      <div className="mb-4">
                        <h4 className="text-lg font-semibold">Zone Summary</h4>
                        <div className="mt-2 text-sm text-gray-700">
                          <div>Total items in Zone: <span className="font-medium">{totalInZoneCount}</span></div>
                          <div className="mt-1">Misplaced items in Zone: <span className="font-medium">{misplacedInZoneCount}</span></div>
                        </div>
                      </div>

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
