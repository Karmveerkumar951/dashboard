// StatCard.jsx
import React from 'react';

const StatCard = React.forwardRef(function StatCard(
  { title, value, onClick, gradient = '', ariaLabel, active = false },
  ref
) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`rounded-md px-6 py-4 min-w-[200px] text-left flex items-center justify-between text-white border border-white/10 focus:outline-none
        ${gradient}
        ${active ? 'border-white/50' : ''}
      `}
      style={{ minHeight: 64 }}
    >
      <div>
        <div className="text-sm font-semibold tracking-wide">{title}</div>
        <div className="mt-2 text-2xl font-extrabold">{value}</div>
      </div>

      {/* small chevron to hint clickability */}
      <div className="ml-4 text-white/80 text-xl">›</div>
    </button>
  );
});

export default StatCard;