// ProductRow.jsx
import React from 'react';

const DEFAULT_PRODUCT_IMG = '/assets/placeholder-product.png';

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

/** tolerant formatter: accepts single-char or full name */
function formatZoneName(zone) {
  if (!zone) return '—';
  const s = String(zone).trim();
  if (s.length === 1) {
    const map = { A: "Men's Wear", B: "Women's Wear", C: "Trial Room" };
    return map[s.toUpperCase()] || s;
  }
  return s;
}

export default function ProductRow({ p, onClick }) {
  const stock = p.Stock ?? p.StockLevel ?? p.stock ?? null;
  const stockInfo = stockLabel(stock);
  const pill = statusPill(p.Status || p.status || '—');
  const sku = p.SKU || p.sku || '—';
  const name = p.Name || p.name || '—';
  const rfid = p.RFID || p.rfid || '—';
  const currentZone = p.Zone || p.zone || p.ZoneName || p.zoneName || '—';
  const zoneName = p.ZoneName || p.zoneName || p.defaultZone || p.defaultzone || '—';
  const lastSeen = p.LastSeen || '—';
  const imgSrc = p.Image ? (p.Image.startsWith('/') ? p.Image : `/assets/products/${p.Image}`) : (p.SKU ? `/assets/products/${p.SKU}.jpg` : DEFAULT_PRODUCT_IMG);

  return (
    <div onClick={() => onClick && onClick(p)} className="w-full flex items-center gap-4 px-3 py-3 border-b bg-white/5 cursor-pointer">
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
      <div className="w-40 text-sm text-gray-300">{lastSeen}</div>

      <div className="w-36 text-sm text-center">
        {stockInfo.text ? <span className={`${stockInfo.className} font-medium`}>{stockInfo.text}</span> : '—'}
      </div>

      <div className="w-36 flex justify-center">
        <span className={`inline-block px-3 py-1 rounded-full text-sm ${pill.className}`}>{pill.label}</span>
      </div>
    </div>
  );
}