import React, { useEffect, useRef, useState } from 'react';

const FLOOR_PLAN_SRC = 'retail-app/public/assets/floorplan.jpg';

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
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [anchoredPanel, setAnchoredPanel] = useState({ open: false, type: null, top: 0 });

  // zone modal state (kept from original file)
  const [selectedZone, setSelectedZone] = useState(null);
  const [showZoneModal, setShowZoneModal] = useState(false);

  const totalRef = useRef(null);
  const misplacedRef = useRef(null);
  const teamRef = useRef(null);
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null); // wrapper that contains header + map

  useEffect(() => {
    const dummyItems = [
      { id: 'I-1001', name: 'Blue Denim Jacket', size: 'M', defaultZone: 'Zone A', currentZone: 'Zone A', status: 'unsold', tagId: 'TAG-A001' },
      { id: 'I-1002', name: 'Red Cotton Shirt', size: 'L', defaultZone: 'Zone B', currentZone: 'Zone C', status: 'unsold', tagId: 'TAG-B002' },
      { id: 'I-1003', name: 'Leather Belt', size: 'Free', defaultZone: 'Zone C', currentZone: 'Zone C', status: 'sold', tagId: 'TAG-C003' },
      { id: 'I-1004', name: 'Black Formal Pants', size: '32', defaultZone: 'Zone B', currentZone: 'Zone B', status: 'unsold', tagId: 'TAG-B004' },
      { id: 'I-1005', name: 'White Sneakers', size: '9', defaultZone: 'Zone A', currentZone: 'Zone B', status: 'unsold', tagId: 'TAG-A005' },
    ];

    const dummyEmployees = [
      { id: 'E-001', name: 'Alice Johnson', zoneAssigned: 'Zone A', entryTime: '09:00 AM', exitTime: '—', phone: '+91 98765 43210' },
      { id: 'E-002', name: 'Bob Williams', zoneAssigned: 'Zone B', entryTime: '09:15 AM', exitTime: '—', phone: '+91 91234 56789' },
      { id: 'E-003', name: 'Catherine Miller', zoneAssigned: 'Zone C', entryTime: '08:45 AM', exitTime: '—', phone: '+91 99887 66554' },
      { id: 'E-004', name: 'David Smith', zoneAssigned: 'Zone A', entryTime: '09:30 AM', exitTime: '—', phone: '+91 98770 99887' },
    ];

    setItems(dummyItems);
    setEmployees(dummyEmployees);
    setLoading(false);
  }, []);

  const totalItems = items.length;
  const misplacedItems = items.filter(it => it.currentZone !== it.defaultZone);
  const totalTeam = employees.length;

  function getPanelGradient(type) {
    if (type === 'total') return 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-2xl';
    if (type === 'team') return 'bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-500 shadow-2xl';
    const pct = totalItems === 0 ? 0 : (misplacedItems.length / totalItems) * 100;
    if (pct === 0) return 'bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500 shadow-2xl';
    if (pct >= 20) return 'bg-gradient-to-br from-red-500 via-rose-600 to-pink-600 shadow-2xl';
    if (pct >= 5) return 'bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-500 shadow-2xl';
    return 'bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500 shadow-2xl';
  }

  // -- new helper from the second file: returns rgba background for anchored panel
  function getPanelColor(type) {
    if (type === 'total') return 'rgba(99, 102, 241, 0.85)'; // indigo-ish
    if (type === 'team') return 'rgba(245, 158, 11, 0.85)'; // amber-ish
    const pct = totalItems === 0 ? 0 : (misplacedItems.length / totalItems) * 100;
    if (pct === 0) return 'rgba(22, 163, 74, 0.85)'; // green (all fine)
    if (pct >= 20) return 'rgba(220, 38, 38, 0.85)'; // red
    if (pct >= 5) return 'rgba(249, 115, 22, 0.85)'; // orange
    return 'rgba(22, 163, 74, 0.85)';
  }

  function openAnchoredPanel(type) {
    const ref = type === 'total' ? totalRef : type === 'misplaced' ? misplacedRef : teamRef;
    const mapEl = mapRef.current;
    const btn = ref.current;
    const mapRect = mapEl.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const top = Math.max(0, btnRect.bottom - mapRect.top);
    setAnchoredPanel({ open: true, type, top });
  }

  function closeAnchoredPanel() {
    setAnchoredPanel({ open: false, type: null, top: 0 });
  }

  // zone click handler (retained from original)
  function onZoneClick(zoneName) {
    setSelectedZone(zoneName);
    setShowZoneModal(true);
  }

  function closeZoneModal() {
    setSelectedZone(null);
    setShowZoneModal(false);
  }

  const panelBg = anchoredPanel.type ? getPanelColor(anchoredPanel.type) : 'rgba(255,255,255,0.5)';

  const filteredItems = items.filter(it => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (it.name && it.name.toLowerCase().includes(q)) || (it.id && it.id.toLowerCase().includes(q)) || (it.tagId && it.tagId.toLowerCase().includes(q));
  });

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-b from-gray-100 to-gray-200 font-sans">
      <div className="max-w-[1400px] mx-auto h-full p-6 flex flex-col gap-6">
        <div className="flex gap-4 items-stretch">
          <StatCard ref={totalRef} title="TOTAL ITEMS" value={loading ? '—' : totalItems} onClick={() => openAnchoredPanel('total')} gradient="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500" shadow="shadow-2xl" />
          <StatCard ref={misplacedRef} title="MISPLACED ITEMS" value={loading ? '—' : misplacedItems.length} onClick={() => openAnchoredPanel('misplaced')} gradient={`${misplacedItems.length === 0 ? 'bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500' : 'bg-gradient-to-br from-red-500 via-rose-600 to-pink-600'}`} shadow="shadow-2xl" />
          <StatCard ref={teamRef} title="TOTAL TEAM" value={loading ? '—' : totalTeam} onClick={() => openAnchoredPanel('team')} gradient="bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-500" shadow="shadow-2xl" />
        </div>

        <div className="flex-1 bg-white rounded-2xl shadow-2xl p-4 relative overflow-hidden flex flex-col" ref={mapContainerRef}>
          <div className={`flex items-center justify-between mb-2 ${anchoredPanel.open || showZoneModal ? 'hidden' : ''}`}>
            <h2 className="text-xl font-semibold text-gray-800 drop-shadow-sm">Store Floor — Live View</h2>
          </div>

          {/* ---------------------------
              === REPLACED MAP PART ===
              (from the second code block you provided)
              --------------------------- */}
          <div ref={mapRef} className="flex-1 relative rounded-lg overflow-hidden border">
            {/* show floorplan image when anchored panel is closed */}
            {!anchoredPanel.open && <img src={FLOOR_PLAN_SRC} alt="Floorplan" className="w-full h-full object-cover" />}

            {/* Keep your three clickable transparent zone buttons/labels (optional)
                If you prefer the exact positions from original, re-add them here.
                I kept zone modal support from the original earlier; you can re-add zone buttons if needed.
            */}
            {!anchoredPanel.open && (
              <>
                {/* Three clickable zones -- same positions as original file */}
                <button
                  className="absolute"
                  style={{ left: '6%', top: '12%', width: '32%', height: '46%', background: 'transparent' }}
                  onClick={() => onZoneClick('Zone A')}
                  aria-label="Zone A"
                />
                <button
                  className="absolute"
                  style={{ right: '6%', top: '12%', width: '32%', height: '46%', background: 'transparent' }}
                  onClick={() => onZoneClick('Zone B')}
                  aria-label="Zone B"
                />
                <button
                  className="absolute"
                  style={{ left: '34%', bottom: '6%', width: '32%', height: '28%', background: 'transparent' }}
                  onClick={() => onZoneClick('Zone C')}
                  aria-label="Zone C"
                />

                {/* subtle labels for zones */}
                <div className="absolute left-6 top-6 text-white font-bold drop-shadow">Zone A</div>
                <div className="absolute right-6 top-6 text-white font-bold drop-shadow">Zone B</div>
                <div className="absolute left-1/2 bottom-8 transform -translate-x-1/2 text-white font-bold drop-shadow">Zone C</div>
              </>
            )}

            {/* anchored panel (overlay) when a stat card is opened */}
            {anchoredPanel.open && (
              <div className="absolute left-0 right-0 z-50" style={{ top: anchoredPanel.top }}>
                <div className="w-full h-[calc(100%-0px)] shadow-2xl rounded-t-lg overflow-auto text-white" style={{ backgroundColor: panelBg }}>
                  <div className="flex items-center justify-between p-4 border-b border-white/20">
                    <h3 className="text-lg font-semibold">
                      {anchoredPanel.type === 'total' ? `All items (${totalItems})` : anchoredPanel.type === 'misplaced' ? `Misplaced items (${misplacedItems.length})` : `Team (${totalTeam})`}
                    </h3>
                    <button onClick={closeAnchoredPanel} className="text-white">✕</button>
                  </div>

                  <div className="p-4">
                    {anchoredPanel.type === 'total' && (
                      <>
                        <div className="mb-3 flex items-center gap-2">
                          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name / id / tag" className="flex-1 p-2 border rounded text-black" />
                          <button onClick={() => setSearchQuery('')} className="px-3 py-2 bg-white/20 rounded text-white">Clear</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {filteredItems.map(it => (
                            <div key={it.id} className="p-3 border border-white/30 rounded bg-white/10">
                              <div className="font-medium">{it.name}</div>
                              <div className="text-xs">ID: {it.id} • Tag: {it.tagId}</div>
                              <div className="text-xs">Default: {it.defaultZone} • Current: {it.currentZone}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {anchoredPanel.type === 'misplaced' && (
                      <>
                        <div className="mb-3 flex items-center gap-2">
                          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search misplaced by name / id / tag" className="flex-1 p-2 border rounded text-black" />
                          <button onClick={() => setSearchQuery('')} className="px-3 py-2 bg-white/20 rounded text-white">Clear</button>
                        </div>
                        <div className="space-y-3">
                          {misplacedItems
                            .filter(it => {
                              if (!searchQuery) return true;
                              return it.name.toLowerCase().includes(searchQuery.toLowerCase()) || it.id.toLowerCase().includes(searchQuery.toLowerCase()) || it.tagId.toLowerCase().includes(searchQuery.toLowerCase());
                            })
                            .map(it => (
                              <div key={it.id} className="border border-white/30 rounded p-3 bg-white/10">
                                <div className="font-medium">{it.name}</div>
                                <div className="text-xs">{it.id} • Default: {it.defaultZone} • Current: {it.currentZone}</div>
                              </div>
                            ))}
                        </div>
                      </>
                    )}

                    {anchoredPanel.type === 'team' && (
                      <>
                        <div className="mb-3 flex items-center gap-2">
                          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search team member by name / id" className="flex-1 p-2 border rounded text-black" />
                          <button onClick={() => setSearchQuery('')} className="px-3 py-2 bg-white/20 rounded text-white">Clear</button>
                        </div>
                        <div className="space-y-3">
                          {employees
                            .filter(emp => {
                              if (!searchQuery) return true;
                              return emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || emp.id.toLowerCase().includes(searchQuery.toLowerCase());
                            })
                            .map(emp => (
                              <div key={emp.id} className="border border-white/30 rounded p-3 bg-white/10">
                                <div className="font-medium">{emp.name}</div>
                                <div className="text-xs">Zone: {emp.zoneAssigned} • {emp.phone}</div>
                                <div className="text-xs">Entry: {emp.entryTime} • Exit: {emp.exitTime || '—'}</div>
                              </div>
                            ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* ---------------------------
              === END REPLACED MAP PART ===
              --------------------------- */}

          {/* full-map zone modal: covers header + map area when a zone is clicked (retained from your original file) */}
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
                        {items.filter(it => it.currentZone === selectedZone && it.currentZone !== it.defaultZone).map(it => (
                          <div key={it.id} className="p-2 border rounded flex items-center justify-between">
                            <div>
                              <div className="font-medium">{it.name}</div>
                              <div className="text-xs text-gray-500">{it.id} • Tag: {it.tagId}</div>
                            </div>
                            <div>
                              <button onClick={() => alert('Open item ' + it.id)} className="text-indigo-600 text-sm">Open</button>
                            </div>
                          </div>
                        ))}

                        {items.filter(it => it.currentZone === selectedZone && it.currentZone !== it.defaultZone).length === 0 && (
                          <div className="text-sm text-gray-500">No misplaced items in this zone.</div>
                        )}
                      </div>

                      <div className="mt-6">
                        <h5 className="font-semibold">Zone Summary</h5>
                        <div className="text-sm text-gray-600 mt-2">Misplaced items: {items.filter(it=>it.currentZone===selectedZone && it.currentZone!==it.defaultZone).length}</div>
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
  );
}
