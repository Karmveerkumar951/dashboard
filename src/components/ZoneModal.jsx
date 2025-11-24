import React from 'react';

const DEFAULT_PRODUCT_IMG = '/assets/placeholder-product.png';
const DEFAULT_STAFF_IMG = '/assets/placeholder-staff.png';

function formatZoneName(zoneChar) {
  if (!zoneChar) return '—';
  if (typeof zoneChar === 'string' && zoneChar.length === 1) return zoneChar;
  const z = String(zoneChar);
  if (z.toLowerCase().startsWith('zone ')) return z.slice(5).trim();
  return z;
}

function staffImageUrl(s) {
  if (!s) return DEFAULT_STAFF_IMG;
  if (s.Image) return s.Image.startsWith('/') ? s.Image : `/assets/staff/${s.Image}`;
  if (s.id) return `/assets/staff/${s.id}.jpg`;
  return DEFAULT_STAFF_IMG;
}

export default function ZoneModal({ open, rect, zoneName, products = [], staff = [], onClose, onOpenItem, threshold = 1 }) {
  if (!open || !rect) return null;

  const currentZone = zoneName; // expects 'A'|'B'|'C'

  const itemsInSelectedZone = currentZone
    ? products.filter(it => {
        // it.Zone is normalized to the single-character dev char
        return it.Zone === currentZone;
      })
    : [];

  const misplacedInSelectedZone = currentZone
    ? products.filter(it => {
        const current = it.Zone;
        const defaultZone = it.ZoneName;
        return current === currentZone && defaultZone && current !== defaultZone;
      })
    : [];

  const employeesInSelectedZone = currentZone
    ? staff.filter(s => (s.RespectiveZone === currentZone) || (s.ZoneName === currentZone) || (s.Zone === currentZone))
    : [];

  const totalInZoneCount = itemsInSelectedZone.length;
  const misplacedInZoneCount = misplacedInSelectedZone.length;

  // decide header color / badge depending on threshold exceed
  const exceeded = misplacedInZoneCount > threshold;

  const headerBadgeStyle = exceeded ? 'bg-red-100 text-red-800' : (misplacedInZoneCount === threshold ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800');

  return (
    <div role="dialog" aria-modal="true" className="z-[900]" style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width, height: rect.height, pointerEvents: 'auto' }}>
      <div className="absolute inset-0" onClick={onClose} style={{ background: 'rgba(0,0,0,0.4)' }} />
      <div className="absolute inset-0 bg-white overflow-auto rounded-none">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Zone: {formatZoneName(currentZone)} — Zone Details</h3>
          <div className={`px-3 py-1 rounded ${headerBadgeStyle} text-sm`}>Misplaced: {misplacedInZoneCount} / {threshold}</div>
          <button onClick={onClose} className="text-gray-600" aria-label="Close zone modal">✕</button>
        </div>

        <div className="p-4 grid grid-cols-2 gap-4 h-[calc(100%-64px)]">
          <div className="h-full">
            <img src="/assets/floorplan.png" alt="Zone top view" className="w-full h-full object-contain" />
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
                    <button key={it.SKU || it.id || it.EPC} onClick={() => onOpenItem(it)} className="w-full p-2 border rounded flex items-center justify-between text-left hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <img src={it.Image ? (it.Image.startsWith('/') ? it.Image : `/assets/products/${it.Image}`) : (it.SKU ? `/assets/products/${it.SKU}.jpg` : DEFAULT_PRODUCT_IMG)} alt={it.Name} className="w-12 h-12 object-cover rounded" onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=DEFAULT_PRODUCT_IMG }} />
                        <div>
                          <div className="font-medium">{it.Name}</div>
                          <div className="text-xs text-gray-500">{it.SKU} • RFID: {it.RFID}</div>
                          <div className="text-xs text-gray-500">Default zone: {formatZoneName(it.ZoneName || '—')}</div>
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
                      <img src={s.Image ? (s.Image.startsWith('/') ? s.Image : `/assets/staff/${s.Image}`) : (s.id ? `/assets/staff/${s.id}.jpg` : DEFAULT_STAFF_IMG)} alt={s.Name} className="w-12 h-12 rounded-full object-cover" onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=DEFAULT_STAFF_IMG }} />
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
      </div>
    </div>
  );
}
