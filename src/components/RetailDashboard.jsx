import React, { useEffect, useRef, useState } from 'react';

const FLOOR_PLAN_SRC = '/assets/floorplan.png';
const DEFAULT_PRODUCT_IMG = '/assets/placeholder-product.png';
const DEFAULT_STAFF_IMG = '/assets/placeholder-staff.png';

const StatCard = React.forwardRef(function StatCard({ title, value, onClick, gradient, shadow, ariaLabel }, ref) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`rounded-xl px-6 py-4 min-w-[180px] text-left flex-1 text-white focus:outline-none transition-transform transform hover:scale-105 ${gradient} ${shadow}`}
      aria-label={ariaLabel}
    >
      <div className="text-sm font-medium text-white/90 drop-shadow-md">{title}</div>
      <div className="mt-2 text-3xl font-bold text-white drop-shadow-lg">{value}</div>
    </button>
  );
});

export default function RetailDashboard() {
  const [products, setProducts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [rfid, setRfid] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [anchoredPanel, setAnchoredPanel] = useState({ open: false, type: null, top: 0 });

  // zone modal state
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

  const totalItems = products.length;
  const misplacedItems = products.filter(p => (p.Zone || p.zone || p.ZoneName) && (p.ZoneName && p.Zone && p.Zone !== p.ZoneName));
  const totalTeam = staff.length;

  function getPanelGradient(type) {
    if (type === 'total') return 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-2xl';
    if (type === 'team') return 'bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-500 shadow-2xl';
    if (misplacedItems.length === 0) return 'bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500 shadow-2xl';
    if (misplacedItems.length >= Math.max(1, Math.round(totalItems * 0.2))) return 'bg-gradient-to-br from-red-500 via-rose-600 to-pink-600 shadow-2xl';
    return 'bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-500 shadow-2xl';
  }

  // panel color (slightly less transparent for readability)
  function getPanelColor(type) {
    if (type === 'total') return 'rgba(99,102,241,0.85)';
    if (type === 'team') return 'rgba(245,158,11,0.85)';
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
    const top = Math.max(0, btnRect.bottom - mapRect.top) - 6; // slight overlap so it looks attached
    setAnchoredPanel({ open: true, type, top });
  }

  function closeAnchoredPanel() {
    setAnchoredPanel({ open: false, type: null, top: 0 });
  }

  // -- zone handlers
  function onZoneClick(zoneName) {
    setSelectedZone(zoneName);
    setShowZoneModal(true);
  }
  function closeZoneModal() {
    setSelectedZone(null);
    setShowZoneModal(false);
  }

  // helpers for image URLs (allow JSON to include an Image field or fall back to naming convention)
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

  const filteredProducts = products.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (p.Name && p.Name.toLowerCase().includes(q)) || (p.SKU && p.SKU.toLowerCase().includes(q)) || (p.RFID && p.RFID.toLowerCase().includes(q));
  });

  const filteredStaff = staff.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (s.Name && s.Name.toLowerCase().includes(q)) || (s.id && s.id.toLowerCase().includes(q));
  });

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
        // the product is currently in 'current' and it's misplaced
        if (!counts[current]) counts[current] = 0;
        counts[current] += 1;
      }
    });
    return counts;
  }

  function heatColorForCount(count, max) {
    if (!max || max === 0) return 'hsla(120,70%,45%,0.08)';
    const ratio = Math.min(1, count / max);
    // Hue from green (120) to red (0)
    const hue = Math.round(120 * (1 - ratio));
    const alpha = 0.45 * Math.min(1, 0.2 + ratio * 0.8); // min opacity 0.09 -> up to 0.45
    return `hsla(${hue},70%,50%,${alpha})`;
  }

  const zoneCounts = zoneMisplacedCounts();
  const maxZoneCount = Math.max(1, ...Object.values(zoneCounts));

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-b from-gray-100 to-gray-200 font-sans">
      <div className="max-w-[1400px] mx-auto h-full p-6 flex flex-col gap-6">
        <div className="flex gap-4 items-stretch">
          <StatCard ref={totalRef} title="TOTAL ITEMS" value={loading ? '—' : totalItems} onClick={() => openAnchoredPanel('total')} gradient={getPanelGradient('total')} shadow="shadow-2xl" />
          <StatCard ref={misplacedRef} title="MISPLACED ITEMS" value={loading ? '—' : misplacedItems.length} onClick={() => openAnchoredPanel('misplaced')} gradient={getPanelGradient('misplaced')} shadow="shadow-2xl" />
          <StatCard ref={teamRef} title="TOTAL TEAM" value={loading ? '—' : totalTeam} onClick={() => openAnchoredPanel('team')} gradient={getPanelGradient('team')} shadow="shadow-2xl" />
        </div>

        <div className="flex-1 bg-white rounded-2xl shadow-2xl p-4 relative overflow-hidden flex flex-col" ref={mapContainerRef}>
          <div className={`flex items-center justify-between mb-2 ${anchoredPanel.open || showZoneModal ? 'hidden' : ''}`}>
            <h2 className="text-xl font-semibold text-gray-800 drop-shadow-sm">Store Floor — Live View</h2>
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

                {/* clickable zones (adjust positions to match your floorplan) */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onZoneClick('Zone A')}
                  className="absolute left-6 top-12 w-[32%] h-[46%] cursor-pointer transition-all"
                  style={{ background: heatColorForCount(zoneCounts['Zone A'] || 0, maxZoneCount), borderRadius: 8 }}
                >
                  <div className="p-2 text-white font-semibold drop-shadow-lg">Zone A</div>
                  <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['Zone A'] || 0}</div>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onZoneClick('Zone B')}
                  className="absolute right-6 top-12 w-[32%] h-[46%] cursor-pointer transition-all"
                  style={{ background: heatColorForCount(zoneCounts['Zone B'] || 0, maxZoneCount), borderRadius: 8 }}
                >
                  <div className="p-2 text-white font-semibold drop-shadow-lg">Zone B</div>
                  <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['Zone B'] || 0}</div>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onZoneClick('Zone C')}
                  className="absolute left-[34%] bottom-6 w-[32%] h-[28%] cursor-pointer transition-all"
                  style={{ background: heatColorForCount(zoneCounts['Zone C'] || 0, maxZoneCount), borderRadius: 8 }}
                >
                  <div className="p-2 text-white font-semibold drop-shadow-lg">Zone C</div>
                  <div className="absolute right-2 top-2 bg-black/40 text-white text-xs px-2 py-1 rounded">{zoneCounts['Zone C'] || 0}</div>
                </div>

              </>
            )}

            {/* anchored panel for top stat buttons */}
            {anchoredPanel.open && (
              <div className="absolute left-0 right-0 z-50" style={{ top: anchoredPanel.top, bottom: 0 }}>
                {/* full-height panel container (header + scrollable body) */}
                <div className="absolute inset-x-0 top-0 bottom-0 rounded-t-lg overflow-hidden" style={{ background: panelBg }}>
                  {/* header */}
                  <div className="flex items-center justify-between p-4 border-b border-white/20 backdrop-blur-sm bg-white/10">
                    <h3 className="text-lg font-semibold drop-shadow-lg text-white">
                      {anchoredPanel.type === 'total' ? `All items (${totalItems})` : anchoredPanel.type === 'misplaced' ? `Misplaced items (${misplacedItems.length})` : `Team (${totalTeam})`}
                    </h3>
                    <button onClick={closeAnchoredPanel} className="text-white text-xl drop-shadow-md">✕</button>
                  </div>

                  {/* body - scrollable area only */}
                  <div className="p-4 overflow-auto h-[calc(100%-64px)] text-white">
                    <div className="mb-3 flex items-center gap-2">
                      <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." className="flex-1 p-2 border rounded text-black" />
                      <button onClick={() => setSearchQuery('')} className="px-3 py-2 bg-white/20 rounded text-white">Clear</button>
                    </div>

                    {/* TOTAL items panel — product image + details */}
                    {anchoredPanel.type === 'total' && (
                      <div className="grid grid-cols-2 gap-3">
                        {filteredProducts.map(p => (
                          <div key={p.SKU || p.id} className="p-3 border border-white/30 rounded-xl bg-white/10 backdrop-blur-sm shadow-lg flex gap-3 items-center">
                            <img src={productImageUrl(p)} alt={p.Name} className="w-20 h-20 object-cover rounded-lg border" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_PRODUCT_IMG; }} />
                            <div className="flex-1 text-white/95">
                              <div className="font-medium">{p.Name}</div>
                              <div className="text-xs">SKU: {p.SKU}</div>
                              <div className="text-xs">RFID: {p.RFID}</div>
                              <div className="text-xs">Zone: {p.Zone || p.zone} • {p.ZoneName || p.zoneName}</div>
                              <div className="text-xs">Status: {p.Status || p.status}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* MISPLACED items panel — product image + details */}
                    {anchoredPanel.type === 'misplaced' && (
                      <div className="space-y-3">
                        {misplacedItems.map(p => (
                          <div key={p.SKU || p.id} className="border border-white/30 rounded-xl p-3 bg-white/10 backdrop-blur-sm shadow-lg flex gap-3 items-center">
                            <img src={productImageUrl(p)} alt={p.Name} className="w-20 h-20 object-cover rounded-lg border" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_PRODUCT_IMG; }} />
                            <div className="flex-1 text-white/95">
                              <div className="font-medium">{p.Name}</div>
                              <div className="text-xs">SKU: {p.SKU} • RFID: {p.RFID}</div>
                              <div className="text-xs">Default zone: {p.ZoneName || p.defaultZone} • Current zone: {p.Zone}</div>
                              <div className="text-xs">Status: {p.Status || p.status}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* TEAM panel — employee image + details */}
                    {anchoredPanel.type === 'team' && (
                      <div className="space-y-3">
                        {filteredStaff.map(s => (
                          <div key={s.id} className="border border-white/30 rounded-xl p-3 bg-white/10 backdrop-blur-sm shadow-lg flex gap-3 items-center">
                            <img src={staffImageUrl(s)} alt={s.Name} className="w-20 h-20 object-cover rounded-full border" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_STAFF_IMG; }} />
                            <div className="flex-1 text-white/95">
                              <div className="font-medium">{s.Name}</div>
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
              </div>
            )}

            {/* full-map zone modal: covers header + map area when a zone is clicked */}
            {showZoneModal && (
              <div className="absolute inset-0 z-60 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/40" onClick={closeZoneModal} />
                <div className="relative z-70 w-full h-full p-6">
                  <div className="w-full h-full bg-white rounded-lg shadow-2xl overflow-auto">
                    <div className="flex items-center justify-between p-4 border-b">
                      <h3 className="text-lg font-semibold">{selectedZone} — Zone Details</h3>
                      <button onClick={closeZoneModal} className="text-gray-600 hover:text-gray-900">✕</button>
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
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
