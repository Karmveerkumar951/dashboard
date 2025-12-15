// ZoneModal.jsx
import React from 'react';

const DEFAULT_PRODUCT_IMG = '/assets/placeholder-product.png';
const DEFAULT_STAFF_IMG = '/assets/placeholder-staff.png';

function formatZoneName(zoneChar) {
  if (!zoneChar) return '—';
  const s = String(zoneChar).trim();
  if (s.length === 1) {
    const map = { A: "Men's Wear", B: "Women's Wear", C: "Trial Room" };
    return map[s.toUpperCase()] || s;
  }
  return s;
}

export default function ZoneModal({ open, rect, zoneName, products = [], staff = [], onClose, onOpenItem, threshold = 1 }) {
  if (!open || !rect) return null;

  const currentZone = zoneName;

  const itemsInSelectedZone = currentZone
    ? products.filter(it => it.Zone === currentZone)
    : [];

  const misplacedInSelectedZone = currentZone
    ? products.filter(it => {
        const current = it.Zone;
        const defaultZone = it.ZoneName;
        return current === currentZone && defaultZone && current !== defaultZone;
      })
    : [];

  const employeesInSelectedZone = currentZone
    ? staff.filter(s => (s.RespectiveZone === currentZone) || (s.RespectiveZoneName === currentZone) || (s.Zone === currentZone))
    : [];

  const totalInZoneCount = itemsInSelectedZone.length;
  const misplacedInZoneCount = misplacedInSelectedZone.length;

  const exceeded = misplacedInZoneCount > threshold;
  
  // Status Badge Logic
  let badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  let badgeText = 'Zone Healthy';
  
  if (exceeded) {
    badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    badgeText = `Attention Needed`;
  } else if (misplacedInZoneCount > 0) {
    badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    badgeText = 'Minor Issues';
  }

  // Handle assigning task
  const handleAssign = (e, item) => {
    e.stopPropagation(); 
    const emp = employeesInSelectedZone.length > 0 ? employeesInSelectedZone[0].Name : 'a staff member';
    alert(`Task assigned to ${emp} for item: ${item.Name}`);
  };

  return (
    <div 
      role="dialog" 
      aria-modal="true" 
      className="z-[900] overflow-hidden"
      style={{ 
        position: 'fixed', 
        top: rect.top, 
        left: rect.left, 
        width: rect.width, 
        height: rect.height, 
        pointerEvents: 'auto' 
      }}
    >
      {/* Dark Background */}
      <div className="absolute inset-0 bg-slate-900" />
      
      {/* Content Container */}
      <div className="absolute inset-0 flex flex-col text-white">
        
        {/* --- Header --- */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-light tracking-wide text-white">
              <span className="font-semibold text-white/60 mr-2">ZONE</span>
              {formatZoneName(currentZone)}
            </h3>
            <div className={`px-3 py-1 rounded-full text-xs font-medium border ${badgeColor}`}>
              {badgeText}
            </div>
          </div>
          
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-gray-400"
            aria-label="Close zone modal"
          >
            ✕
          </button>
        </div>

        {/* --- Main Grid --- */}
        <div className="flex-1 p-6 grid grid-cols-12 gap-6 overflow-hidden">
          
          {/* LEFT: Map Visualization */}
          <div className="col-span-7 relative rounded-2xl overflow-hidden border border-white/10 bg-black/40">
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/60 text-[10px] font-mono text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> LIVE VIEW
              </span>
            </div>
            <img 
              src="/assets/floorplan.png" 
              alt="Zone top view" 
              className="w-full h-full object-contain" 
            />
            {/* Overlay Grid Effect */}
            <div className="absolute inset-0 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
          </div>

          {/* RIGHT: Details Panel */}
          <div className="col-span-5 h-full overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            
            {/* Stat Cards Row */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {/* REMOVED: hover:bg-white/10 */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white mb-1">{totalInZoneCount}</span>
                <span className="text-xs uppercase tracking-widest text-gray-400">Total Items</span>
              </div>
              <div className={`border rounded-xl p-4 flex flex-col items-center justify-center ${exceeded ? 'bg-rose-500/10 border-rose-500/30' : 'bg-white/5 border-white/10'}`}>
                <span className={`text-3xl font-bold mb-1 ${exceeded ? 'text-rose-400' : 'text-white'}`}>{misplacedInZoneCount}</span>
                <span className={`text-xs uppercase tracking-widest ${exceeded ? 'text-rose-300' : 'text-gray-400'}`}>Misplaced</span>
              </div>
            </div>

            {/* --- Misplaced Items Section --- */}
            <div className="mb-8">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                Action Required
                <div className="h-[1px] flex-1 bg-white/10"></div>
              </h4>
              
              <div className="space-y-3">
                {misplacedInSelectedZone.length > 0 ? (
                  misplacedInSelectedZone.map(it => (
                    <div 
                      key={it.SKU || it.id || it.EPC} 
                      onClick={() => onOpenItem(it)} 
                      /* REMOVED: group, hover:bg-white/10, hover:border-white/20 */
                      className="w-full relative overflow-hidden rounded-xl bg-white/5 border border-white/5 p-3 flex items-center gap-4 text-left cursor-pointer"
                    >
                      {/* Left accent bar */}
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500/80" />
                      
                      <img 
                        src={it.Image ? (it.Image.startsWith('/') ? it.Image : `/assets/products/${it.Image}`) : (it.SKU ? `/assets/products/${it.SKU}.jpg` : DEFAULT_PRODUCT_IMG)} 
                        alt={it.Name} 
                        className="w-12 h-12 object-cover rounded-lg bg-gray-800"
                        onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=DEFAULT_PRODUCT_IMG }} 
                      />
                      <div className="flex-1 min-w-0">
                        {/* REMOVED: group-hover:text-rose-300 */}
                        <div className="font-medium text-white truncate">{it.Name}</div>
                        <div className="text-xs text-gray-400 truncate">SKU: {it.SKU}</div>
                        <div className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                          <span>⚠️ Belongs in:</span>
                          <span className="font-semibold">{formatZoneName(it.ZoneName || '—')}</span>
                        </div>
                      </div>

                      {/* ASSIGN BUTTON */}
                      {/* REMOVED: hover:bg-indigo... hover:text-white */}
                      <button 
                        onClick={(e) => handleAssign(e, it)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-500/30 z-10"
                      >
                        Assign
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-sm text-gray-500 bg-white/5">
                    No misplaced items. Great job!
                  </div>
                )}
              </div>
            </div>

            {/* --- Staff Section --- */}
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                Staff On Duty
                <div className="h-[1px] flex-1 bg-white/10"></div>
              </h4>
              
              <div className="grid grid-cols-1 gap-3">
                {employeesInSelectedZone.length > 0 ? (
                  employeesInSelectedZone.map(s => (
                    // REMOVED: hover:bg-white/10
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="relative">
                        <img 
                          src={s.Image ? (s.Image.startsWith('/') ? s.Image : `/assets/staff/${s.Image}`) : (s.id ? `/assets/staff/${s.id}.jpg` : DEFAULT_STAFF_IMG)} 
                          alt={s.Name} 
                          className="w-10 h-10 rounded-full object-cover border border-white/10"
                          onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=DEFAULT_STAFF_IMG }} 
                        />
                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#1e293b] ${s.In ? 'bg-emerald-500' : 'bg-gray-500'}`}></span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{s.Name}</div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">{s.In ? 'Active Now' : 'Off Floor'}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500 italic p-2">No employees assigned.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}