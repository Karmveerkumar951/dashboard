import React from 'react';

const StatCard = React.forwardRef(function StatCard(
  { title, value, onClick, gradient = '', shadow = '', ariaLabel, active = false },
  ref
) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`rounded-md px-6 py-4 min-w-[200px] text-left flex items-center justify-between text-white border border-white/8 focus:outline-none transform transition-transform
        ${gradient} ${shadow}
        ${active ? 'ring-2 ring-white/30 scale-[1.01]' : 'hover:scale-[1.01]'}
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
