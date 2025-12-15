// AnchoredPanel.jsx
import React, { useEffect, useState } from 'react';
import ProductRow from './ProductRow';

const DEFAULT_PRODUCT_IMG = '/assets/placeholder-product.png';
const DEFAULT_STAFF_IMG = '/assets/placeholder-staff.png';

// kept in-file fuzzy helpers (same as before)
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

export default function AnchoredPanel({
  type,            // 'total' | 'misplaced' | 'team'
  open,
  onClose,
  products = [],
  staff = [],
  onOpenItem,
  searchQuery,
  setSearchQuery,
  panelColor = 'rgba(55,65,81,1)', // background color when open
  gradientClass = ''                   // optional tailwind gradient applied to headings / buttons
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);

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
    if (type === 'team') {
      setSuggestions(staff.filter(s => (s.Name || '').toLowerCase().startsWith(q)).slice(0, limit));
    } else if (type === 'misplaced') {
      const misplacedCandidates = products.filter(p => {
        const current = p.Zone || p.zone || p.ZoneName || p.zoneName;
        const defaultZone = p.ZoneName || p.zoneName || p.defaultZone || p.defaultzone;
        return current && defaultZone && current !== defaultZone;
      });
      setSuggestions(misplacedCandidates.filter(p => ((p.Name || '').toLowerCase().startsWith(q) || (p.SKU || '').toLowerCase().startsWith(q))).slice(0, limit));
    } else {
      setSuggestions(products.filter(p => (p.Name || '').toLowerCase().startsWith(q) || (p.SKU || '').toLowerCase().startsWith(q)).slice(0, limit));
    }
  }, [searchQuery, type, products, staff]);

  const misplacedItems = products.filter(p => p.Misplaced);
  const filteredProducts = scoredSearch(products, searchQuery, ['Name', 'SKU', 'RFID']);
  const filteredMisplaced = scoredSearch(misplacedItems, searchQuery, ['Name', 'SKU', 'RFID']);
  const filteredStaff = scoredSearch(staff, searchQuery, ['Name', 'id']);

  function handleKeyDown(e) {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestionIndex(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestionIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      if (suggestionIndex >= 0 && suggestionIndex < suggestions.length) {
        const sel = suggestions[suggestionIndex];
        setSearchQuery(sel.Name || sel.id || sel.SKU || '');
        setShowSuggestions(false);
        if (sel) onOpenItem && onOpenItem(sel);
      }
    }
  }

  if (!open) return null;

  return (
    <div className="absolute left-0 right-0 z-50 inset-x-0 top-0 bottom-0">
      <div
        className="absolute inset-x-0 top-0 bottom-0 rounded-t-xl overflow-hidden border border-white/10 flex flex-col"
        style={{ background: panelColor }}
      >
        <div className={`flex items-center justify-between p-4 border-b ${gradientClass}`}>
          <h3 className="text-lg font-semibold text-white">
            {type === 'total' ? `All items (${products.length})` : type === 'misplaced' ? `Misplaced items (${misplacedItems.length})` : `Team (${staff.length})`}
          </h3>
          <button onClick={onClose} className="text-white text-xl rounded-md" aria-label="Close panel">✕</button>
        </div>

        <div className="p-4 border-b bg-white/5 z-40">
          <div className="mb-0 flex items-center gap-2 relative">
            <div className="relative flex-1">
              <input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSuggestionIndex(-1); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onKeyDown={handleKeyDown}
                placeholder="Search products / staff..."
                aria-label="Search"
                className="w-full p-2 border rounded text-black"
              />

              {showSuggestions && searchQuery && suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 mt-2 bg-white rounded border z-50" role="listbox">
                  {suggestions.map((s, idx) => (
                    <li
                      key={(s.SKU || s.id) + idx}
                      role="option"
                      aria-selected={idx === suggestionIndex}
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        setSearchQuery(s.Name || s.id || s.SKU || '');
                        setShowSuggestions(false);
                        onOpenItem && onOpenItem(s);
                      }}
                      className={`px-3 py-2 cursor-pointer flex items-center gap-3 ${idx === suggestionIndex ? 'bg-gray-100' : ''}`}
                    >
                      <img src={s.Image ? (s.Image.startsWith('/') ? s.Image : `/assets/staff/${s.Image}`) : (s.id ? `/assets/staff/${s.id}.jpg` : DEFAULT_STAFF_IMG)} alt={s.Name || s.id} className="w-8 h-8 object-cover rounded" onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=DEFAULT_STAFF_IMG }} />
                      <div className="flex-1 text-sm text-gray-800">{s.Name || s.id || ''}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button onClick={() => { setSearchQuery(''); setShowSuggestions(false); }} className="px-3 py-2 bg-white/12 rounded-md text-white">Clear</button>
          </div>
        </div>

        <div className="p-4 overflow-auto flex-1 text-white">
          {type !== 'team' && (
            <>
              <div className="w-full flex items-center gap-4 px-3 py-2 text-sm text-gray-300 border-b">
                <div className="min-w-[260px] font-medium">Product</div>
                <div className="w-40 font-medium">SKU</div>
                <div className="w-40 font-medium">RFID</div>
                <div className="w-40 font-medium">Current Zone</div>
                <div className="w-40 font-medium">ZoneName</div>
                <div className="w-40 font-medium">Last Seen</div>
                <div className="w-36 text-center font-medium">Stock</div>
                <div className="w-36 text-center font-medium">Status</div>
              </div>

              {type === 'total' && (
                <div className="mt-3">
                  {filteredProducts.map(p => <ProductRow key={p.SKU || p.RFID || p._rawApi?.EPC || Math.random()} p={p} onClick={() => onOpenItem(p)} />)}
                </div>
              )}

              {type === 'misplaced' && (
                <div className="mt-3">
                  {filteredMisplaced.map(p => <ProductRow key={p.SKU || p.RFID || p._rawApi?.EPC || Math.random()} p={p} onClick={() => onOpenItem(p)} />)}
                </div>
              )}
            </>
          )}

          {type === 'team' && (
            <div className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredStaff.map(s => (
                  <div key={s.id} className="relative bg-white rounded-xl p-4 border text-gray-800">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={s.Image ? (s.Image.startsWith('/') ? s.Image : `/assets/staff/${s.Image}`) : (s.id ? `/assets/staff/${s.id}.jpg` : DEFAULT_STAFF_IMG)}
                            alt={s.Name}
                            className="w-12 h-12 object-cover rounded-full border"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = DEFAULT_STAFF_IMG;
                            }}
                          />
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${s.In ? 'bg-green-500' : 'bg-gray-300'}`} />
                        </div>

                        <div className="text-left">
                          <div className="flex items-baseline gap-2">
                            <div className="font-semibold text-gray-900">{s.Name}</div>
                            {s.id && <div className="text-xs text-gray-500">• {s.id}</div>}
                          </div>

                          {/* Title/Role if present in staff JSON */}
                          { (s.Title || s.Role) && <div className="text-xs text-gray-500">{s.Title || s.Role}</div> }
                        </div>
                      </div>

                      <div className="text-gray-400">⋯</div>
                    </div>

                    <div className="mt-4 bg-gray-50 rounded p-3 text-sm text-gray-700 space-y-2">
                      <div className="flex justify-between">
                        <div className="text-xs text-gray-500">Assigned zone</div>
                        <div className="text-xs font-medium">{s.RespectiveZone || s.RespectiveZoneName || s.Zone || '—'}</div>
                      </div>

                      <div className="flex justify-between">
                        <div className="text-xs text-gray-500">In store</div>
                        <div className="text-xs font-medium">{s.In ? 'In' : 'Out'}</div>
                      </div>

                      <div className="flex justify-between">
                        <div className="text-xs text-gray-500">Phone</div>
                        <div className="text-xs font-medium">{s.Phone || s.PHONE || '—'}</div>
                      </div>

                      {/* optional fields if available in staff JSON */}
                      { (s.Department || s.Team) && (
                        <div className="flex justify-between">
                          <div className="text-xs text-gray-500">Department</div>
                          <div className="text-xs font-medium">{s.Department || s.Team}</div>
                        </div>
                      )}

                      { (s.HireDate || s.HiredDate) && (
                        <div className="flex justify-between">
                          <div className="text-xs text-gray-500">Hired Date</div>
                          <div className="text-xs font-medium">{s.HireDate || s.HiredDate}</div>
                        </div>
                      )}

                      { (s.Email || s.EmailAddress || s.email) && (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8.5v7A2.5 2.5 0 0 0 5.5 18h13A2.5 2.5 0 0 0 21 15.5v-7A2.5 2.5 0 0 0 18.5 6h-13A2.5 2.5 0 0 0 3 8.5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 8.5l-9 6-9-6" /></svg>
                          <div className="truncate">{s.Email || s.EmailAddress || s.email}</div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M22 16.92V21a1 1 0 0 1-1.11 1 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2 3.11 1 1 0 0 1 3 2h4.09a1 1 0 0 1 1 .75c.12.73.33 1.44.62 2.11a1 1 0 0 1-.24 1.04L7.7 8.7a16 16 0 0 0 6 6l1.78-1.78a1 1 0 0 1 1.04-.24c.67.29 1.38.5 2.11.62a1 1 0 0 1 .75 1z" /></svg>
                        <div className="truncate">{s.Phone || s.PHONE || '—'}</div>
                      </div>
                    </div>

                    {/* click to open more staff details */}
                    <div className="mt-3 flex justify-end">
                      <button onClick={() => onOpenItem && onOpenItem(s)} className="px-3 py-1 border rounded text-sm">View</button>
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
  );
}