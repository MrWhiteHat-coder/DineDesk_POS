import React from 'react';

/* Chef Bot — DineDesk Mascot
   Each pose is a self-contained SVG illustration.
   All share the same character: friendly chef with tall hat, big smile.
*/

const ChefBase = ({ children, className = '' }) => (
  <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {children}
  </svg>
);

/* ── Chef Bot: Shrugging (empty state) ── */
export function ChefShrugging({ className = 'w-32 h-32' }) {
  return (
    <ChefBase className={className}>
      {/* Chef hat */}
      <ellipse cx="100" cy="38" rx="30" ry="12" fill="#E5E7EB" />
      <rect x="78" y="20" width="44" height="20" rx="4" fill="white" stroke="#D1D5DB" strokeWidth="1.5" />
      <rect x="72" y="35" width="56" height="8" rx="3" fill="white" stroke="#D1D5DB" strokeWidth="1.5" />
      {/* Head */}
      <circle cx="100" cy="65" r="22" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.5" />
      {/* Eyes */}
      <circle cx="91" cy="62" r="3" fill="#1F2937" />
      <circle cx="109" cy="62" r="3" fill="#1F2937" />
      <circle cx="92" cy="61" r="1" fill="white" />
      <circle cx="110" cy="61" r="1" fill="white" />
      {/* Smile */}
      <path d="M90 72 Q100 80 110 72" stroke="#1F2937" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Body */}
      <rect x="80" y="87" width="40" height="45" rx="8" fill="white" stroke="#D1D5DB" strokeWidth="1.5" />
      <line x1="100" y1="95" x2="100" y2="120" stroke="#D1D5DB" strokeWidth="1" />
      {/* Arms shrugging */}
      <path d="M80 95 Q65 85 55 95" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M120 95 Q135 85 145 95" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* Spatula in left hand */}
      <rect x="48" y="88" width="3" height="18" rx="1.5" fill="#9CA3AF" />
      <ellipse cx="49.5" cy="85" rx="6" ry="4" fill="#9CA3AF" />
      {/* Plate in right hand */}
      <ellipse cx="145" cy="92" rx="12" ry="3" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1" />
      {/* Legs */}
      <rect x="88" y="132" width="10" height="18" rx="4" fill="#FEF3C7" />
      <rect x="102" y="132" width="10" height="18" rx="4" fill="#FEF3C7" />
      {/* Shoes */}
      <ellipse cx="93" cy="152" rx="7" ry="4" fill="#1F2937" />
      <ellipse cx="107" cy="152" rx="7" ry="4" fill="#1F2937" />
    </ChefBase>
  );
}

/* ── Chef Bot: Thumbs Up (order placed) ── */
export function ChefThumbsUp({ className = 'w-32 h-32' }) {
  return (
    <ChefBase className={className}>
      <ellipse cx="100" cy="38" rx="30" ry="12" fill="#D1FAE5" />
      <rect x="78" y="20" width="44" height="20" rx="4" fill="white" stroke="#6EE7B7" strokeWidth="1.5" />
      <rect x="72" y="35" width="56" height="8" rx="3" fill="white" stroke="#6EE7B7" strokeWidth="1.5" />
      <circle cx="100" cy="65" r="22" fill="#FEF3C7" stroke="#10B981" strokeWidth="1.5" />
      <circle cx="91" cy="62" r="3" fill="#1F2937" />
      <circle cx="109" cy="62" r="3" fill="#1F2937" />
      <circle cx="92" cy="61" r="1" fill="white" />
      <circle cx="110" cy="61" r="1" fill="white" />
      {/* Big grin */}
      <path d="M87 70 Q100 82 113 70" stroke="#1F2937" strokeWidth="2" fill="#FCA5A5" strokeLinecap="round" />
      <rect x="80" y="87" width="40" height="45" rx="8" fill="white" stroke="#D1D5DB" strokeWidth="1.5" />
      <line x1="100" y1="95" x2="100" y2="120" stroke="#D1D5DB" strokeWidth="1" />
      {/* Left arm normal */}
      <path d="M80 100 Q70 110 65 120" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* Right arm thumbs up */}
      <path d="M120 100 Q130 90 135 78" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      <circle cx="135" cy="74" r="6" fill="#FEF3C7" />
      <rect x="132" y="62" width="6" height="12" rx="3" fill="#FEF3C7" />
      {/* Green checkmark */}
      <circle cx="150" cy="60" r="12" fill="#10B981" />
      <path d="M144 60 L148 64 L156 56" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="88" y="132" width="10" height="18" rx="4" fill="#FEF3C7" />
      <rect x="102" y="132" width="10" height="18" rx="4" fill="#FEF3C7" />
      <ellipse cx="93" cy="152" rx="7" ry="4" fill="#1F2937" />
      <ellipse cx="107" cy="152" rx="7" ry="4" fill="#1F2937" />
    </ChefBase>
  );
}

/* ── Chef Bot: Winking with Cash (payment success) ── */
export function ChefWinking({ className = 'w-32 h-32' }) {
  return (
    <ChefBase className={className}>
      <ellipse cx="100" cy="38" rx="30" ry="12" fill="#FEF3C7" />
      <rect x="78" y="20" width="44" height="20" rx="4" fill="white" stroke="#FCD34D" strokeWidth="1.5" />
      <rect x="72" y="35" width="56" height="8" rx="3" fill="white" stroke="#FCD34D" strokeWidth="1.5" />
      <circle cx="100" cy="65" r="22" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.5" />
      {/* Left eye open */}
      <circle cx="91" cy="62" r="3" fill="#1F2937" />
      <circle cx="92" cy="61" r="1" fill="white" />
      {/* Right eye winking */}
      <path d="M106 62 Q109 60 112 62" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Smile */}
      <path d="M88 72 Q100 80 112 72" stroke="#1F2937" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Blush */}
      <circle cx="82" cy="68" r="4" fill="#FCA5A5" opacity="0.5" />
      <circle cx="118" cy="68" r="4" fill="#FCA5A5" opacity="0.5" />
      <rect x="80" y="87" width="40" height="45" rx="8" fill="white" stroke="#D1D5DB" strokeWidth="1.5" />
      <line x1="100" y1="95" x2="100" y2="120" stroke="#D1D5DB" strokeWidth="1" />
      {/* Arms holding cash */}
      <path d="M80 100 Q70 95 60 100" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M120 100 Q130 95 140 100" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* Cash note in right hand */}
      <rect x="132" y="92" width="22" height="14" rx="2" fill="#86EFAC" stroke="#22C55E" strokeWidth="1" />
      <text x="143" y="102" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#166534">₹</text>
      {/* Sparkles */}
      <text x="55" y="85" fontSize="12">✨</text>
      <text x="145" y="80" fontSize="12">✨</text>
      <rect x="88" y="132" width="10" height="18" rx="4" fill="#FEF3C7" />
      <rect x="102" y="132" width="10" height="18" rx="4" fill="#FEF3C7" />
      <ellipse cx="93" cy="152" rx="7" ry="4" fill="#1F2937" />
      <ellipse cx="107" cy="152" rx="7" ry="4" fill="#1F2937" />
    </ChefBase>
  );
}

/* ── Chef Bot: Sleeping (day not open) ── */
export function ChefSleeping({ className = 'w-32 h-32' }) {
  return (
    <ChefBase className={className}>
      <ellipse cx="100" cy="38" rx="30" ry="12" fill="#E5E7EB" />
      <rect x="78" y="20" width="44" height="20" rx="4" fill="white" stroke="#D1D5DB" strokeWidth="1.5" />
      <rect x="72" y="35" width="56" height="8" rx="3" fill="white" stroke="#D1D5DB" strokeWidth="1.5" />
      <circle cx="100" cy="65" r="22" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.5" />
      {/* Closed eyes */}
      <path d="M86 62 Q91 64 96 62" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M104 62 Q109 64 114 62" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Sleep mouth */}
      <ellipse cx="100" cy="74" rx="3" ry="2.5" fill="#1F2937" />
      <rect x="80" y="87" width="40" height="45" rx="8" fill="white" stroke="#D1D5DB" strokeWidth="1.5" />
      <line x1="100" y1="95" x2="100" y2="120" stroke="#D1D5DB" strokeWidth="1" />
      {/* Arms relaxed */}
      <path d="M80 105 Q72 115 68 125" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M120 105 Q128 115 132 125" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* ZZZ */}
      <text x="140" y="50" fontSize="16" fontWeight="bold" fill="#9CA3AF" opacity="0.8">Z</text>
      <text x="152" y="40" fontSize="12" fontWeight="bold" fill="#9CA3AF" opacity="0.6">z</text>
      <text x="160" y="32" fontSize="9" fontWeight="bold" fill="#9CA3AF" opacity="0.4">z</text>
      {/* Counter/pillow */}
      <rect x="55" y="128" width="90" height="12" rx="4" fill="#E5E7EB" />
      {/* Slumped on counter */}
      <rect x="88" y="132" width="10" height="18" rx="4" fill="#FEF3C7" />
      <rect x="102" y="132" width="10" height="18" rx="4" fill="#FEF3C7" />
      <ellipse cx="93" cy="152" rx="7" ry="4" fill="#1F2937" />
      <ellipse cx="107" cy="152" rx="7" ry="4" fill="#1F2937" />
    </ChefBase>
  );
}

/* ── Chef Bot: Running (KDS new order) ── */
export function ChefRunning({ className = 'w-32 h-32' }) {
  return (
    <ChefBase className={className}>
      <ellipse cx="100" cy="38" rx="30" ry="12" fill="#FEE2E2" />
      <rect x="78" y="20" width="44" height="20" rx="4" fill="white" stroke="#FCA5A5" strokeWidth="1.5" />
      <rect x="72" y="35" width="56" height="8" rx="3" fill="white" stroke="#FCA5A5" strokeWidth="1.5" />
      <circle cx="100" cy="65" r="22" fill="#FEF3C7" stroke="#EF4444" strokeWidth="1.5" />
      {/* Determined eyes */}
      <circle cx="91" cy="62" r="3.5" fill="#1F2937" />
      <circle cx="109" cy="62" r="3.5" fill="#1F2937" />
      <circle cx="92.5" cy="61" r="1.2" fill="white" />
      <circle cx="110.5" cy="61" r="1.2" fill="white" />
      {/* Focused mouth */}
      <path d="M92 73 L108 73" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
      <rect x="80" y="87" width="40" height="45" rx="8" fill="white" stroke="#D1D5DB" strokeWidth="1.5" />
      <line x1="100" y1="95" x2="100" y2="120" stroke="#D1D5DB" strokeWidth="1" />
      {/* Arms running */}
      <path d="M80 100 Q60 85 50 95" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M120 100 Q140 110 150 100" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* Running legs */}
      <path d="M93 132 L80 155" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" />
      <path d="M107 132 L120 155" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="78" cy="157" rx="7" ry="4" fill="#1F2937" />
      <ellipse cx="122" cy="157" rx="7" ry="4" fill="#1F2937" />
      {/* Speed lines */}
      <line x1="35" y1="90" x2="55" y2="90" stroke="#FCA5A5" strokeWidth="1.5" opacity="0.6" />
      <line x1="40" y1="100" x2="55" y2="100" stroke="#FCA5A5" strokeWidth="1.5" opacity="0.4" />
      <line x1="38" y1="110" x2="52" y2="110" stroke="#FCA5A5" strokeWidth="1.5" opacity="0.3" />
      {/* Hat flying off */}
      <ellipse cx="115" cy="25" rx="18" ry="7" fill="white" stroke="#D1D5DB" strokeWidth="1" transform="rotate(-15 115 25)" />
    </ChefBase>
  );
}

/* ── Chef Bot: Relaxing with Chai (KDS all clear) ── */
export function ChefRelaxing({ className = 'w-32 h-32' }) {
  return (
    <ChefBase className={className}>
      <ellipse cx="100" cy="38" rx="30" ry="12" fill="#D1FAE5" />
      <rect x="78" y="20" width="44" height="20" rx="4" fill="white" stroke="#6EE7B7" strokeWidth="1.5" />
      <rect x="72" y="35" width="56" height="8" rx="3" fill="white" stroke="#6EE7B7" strokeWidth="1.5" />
      <circle cx="100" cy="65" r="22" fill="#FEF3C7" stroke="#10B981" strokeWidth="1.5" />
      {/* Happy closed eyes */}
      <path d="M86 61 Q91 58 96 61" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M104 61 Q109 58 114 61" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Content smile */}
      <path d="M88 72 Q100 80 112 72" stroke="#1F2937" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="80" y="87" width="40" height="45" rx="8" fill="white" stroke="#D1D5DB" strokeWidth="1.5" />
      <line x1="100" y1="95" x2="100" y2="120" stroke="#D1D5DB" strokeWidth="1" />
      {/* Arms relaxed */}
      <path d="M80 105 Q72 115 68 125" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* Right hand holding chai cup */}
      <path d="M120 105 Q128 100 135 95" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      <rect x="128" y="88" width="14" height="12" rx="2" fill="#FDE68A" stroke="#F59E0B" strokeWidth="1" />
      <ellipse cx="135" cy="88" rx="7" ry="2" fill="#FDE68A" stroke="#F59E0B" strokeWidth="1" />
      {/* Steam from chai */}
      <path d="M132 82 Q134 76 136 82" stroke="#9CA3AF" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M136 80 Q138 74 140 80" stroke="#9CA3AF" strokeWidth="1" fill="none" opacity="0.4" />
      {/* Relaxed legs */}
      <rect x="88" y="132" width="10" height="18" rx="4" fill="#FEF3C7" />
      <rect x="102" y="132" width="10" height="18" rx="4" fill="#FEF3C7" />
      <ellipse cx="93" cy="152" rx="7" ry="4" fill="#1F2937" />
      <ellipse cx="107" cy="152" rx="7" ry="4" fill="#1F2937" />
      {/* Relaxed emoji */}
      <text x="150" y="55" fontSize="14">😌</text>
    </ChefBase>
  );
}

/* ── Chef Bot: Worried (low stock) ── */
export function ChefWorried({ className = 'w-32 h-32' }) {
  return (
    <ChefBase className={className}>
      <ellipse cx="100" cy="38" rx="30" ry="12" fill="#FEF3C7" />
      <rect x="78" y="20" width="44" height="20" rx="4" fill="white" stroke="#FCD34D" strokeWidth="1.5" />
      <rect x="72" y="35" width="56" height="8" rx="3" fill="white" stroke="#FCD34D" strokeWidth="1.5" />
      <circle cx="100" cy="65" r="22" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.5" />
      {/* Worried eyes */}
      <circle cx="91" cy="63" r="3.5" fill="#1F2937" />
      <circle cx="109" cy="63" r="3.5" fill="#1F2937" />
      <circle cx="92" cy="62" r="1.2" fill="white" />
      <circle cx="110" cy="62" r="1.2" fill="white" />
      {/* Worried eyebrows */}
      <path d="M85 56 L95 58" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
      <path d="M115 56 L105 58" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
      {/* Worried mouth */}
      <path d="M92 74 Q100 70 108 74" stroke="#1F2937" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Sweat drop */}
      <path d="M125 55 Q128 50 131 55 Q128 60 125 55" fill="#93C5FD" />
      <rect x="80" y="87" width="40" height="45" rx="8" fill="white" stroke="#D1D5DB" strokeWidth="1.5" />
      <line x1="100" y1="95" x2="100" y2="120" stroke="#D1D5DB" strokeWidth="1" />
      {/* Arms gesturing worry */}
      <path d="M80 95 Q65 90 55 100" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M120 95 Q135 90 145 100" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* Empty container */}
      <rect x="138" y="92" width="16" height="14" rx="2" fill="white" stroke="#D1D5DB" strokeWidth="1" strokeDasharray="2 2" />
      <text x="146" y="102" textAnchor="middle" fontSize="8" fill="#D1D5DB">?</text>
      {/* Warning triangle */}
      <text x="48" y="88" fontSize="14">⚠️</text>
      <rect x="88" y="132" width="10" height="18" rx="4" fill="#FEF3C7" />
      <rect x="102" y="132" width="10" height="18" rx="4" fill="#FEF3C7" />
      <ellipse cx="93" cy="152" rx="7" ry="4" fill="#1F2937" />
      <ellipse cx="107" cy="152" rx="7" ry="4" fill="#1F2937" />
    </ChefBase>
  );
}

/* ── Chef Bot: Presenting (menu/header) ── */
export function ChefPresenting({ className = 'w-32 h-32' }) {
  return (
    <ChefBase className={className}>
      <ellipse cx="100" cy="38" rx="30" ry="12" fill="#EDE9FE" />
      <rect x="78" y="20" width="44" height="20" rx="4" fill="white" stroke="#C4B5FD" strokeWidth="1.5" />
      <rect x="72" y="35" width="56" height="8" rx="3" fill="white" stroke="#C4B5FD" strokeWidth="1.5" />
      <circle cx="100" cy="65" r="22" fill="#FEF3C7" stroke="#8B5CF6" strokeWidth="1.5" />
      <circle cx="91" cy="62" r="3" fill="#1F2937" />
      <circle cx="109" cy="62" r="3" fill="#1F2937" />
      <circle cx="92" cy="61" r="1" fill="white" />
      <circle cx="110" cy="61" r="1" fill="white" />
      <path d="M90 72 Q100 78 110 72" stroke="#1F2937" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="80" y="87" width="40" height="45" rx="8" fill="white" stroke="#D1D5DB" strokeWidth="1.5" />
      <line x1="100" y1="95" x2="100" y2="120" stroke="#D1D5DB" strokeWidth="1" />
      {/* Arms presenting outward */}
      <path d="M80 100 Q60 90 50 100" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M120 100 Q140 90 150 100" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* Plate with food */}
      <ellipse cx="50" cy="102" rx="14" ry="4" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1" />
      <circle cx="47" cy="98" r="4" fill="#FCA5A5" />
      <circle cx="53" cy="96" r="3" fill="#86EFAC" />
      <rect x="88" y="132" width="10" height="18" rx="4" fill="#FEF3C7" />
      <rect x="102" y="132" width="10" height="18" rx="4" fill="#FEF3C7" />
      <ellipse cx="93" cy="152" rx="7" ry="4" fill="#1F2937" />
      <ellipse cx="107" cy="152" rx="7" ry="4" fill="#1F2937" />
    </ChefBase>
  );
}

/* ── Chef Bot: Celebrating (milestone) ── */
export function ChefCelebrating({ className = 'w-32 h-32' }) {
  return (
    <ChefBase className={className}>
      <ellipse cx="100" cy="38" rx="30" ry="12" fill="#FEF3C7" />
      <rect x="78" y="20" width="44" height="20" rx="4" fill="white" stroke="#FCD34D" strokeWidth="1.5" />
      <rect x="72" y="35" width="56" height="8" rx="3" fill="white" stroke="#FCD34D" strokeWidth="1.5" />
      <circle cx="100" cy="65" r="22" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.5" />
      {/* Star eyes */}
      <text x="87" y="66" fontSize="8">⭐</text>
      <text x="105" y="66" fontSize="8">⭐</text>
      {/* Big smile */}
      <path d="M85 72 Q100 85 115 72" stroke="#1F2937" strokeWidth="2" fill="#FCA5A5" strokeLinecap="round" />
      <rect x="80" y="87" width="40" height="45" rx="8" fill="white" stroke="#D1D5DB" strokeWidth="1.5" />
      <line x1="100" y1="95" x2="100" y2="120" stroke="#D1D5DB" strokeWidth="1" />
      {/* Arms up celebrating */}
      <path d="M80 95 Q60 75 55 65" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M120 95 Q140 75 145 65" stroke="#FEF3C7" strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* Confetti */}
      <text x="40" y="55" fontSize="10">🎊</text>
      <text x="150" y="50" fontSize="10">🎉</text>
      <text x="50" y="40" fontSize="8">✨</text>
      <text x="145" y="38" fontSize="8">✨</text>
      <rect x="88" y="132" width="10" height="18" rx="4" fill="#FEF3C7" />
      <rect x="102" y="132" width="10" height="18" rx="4" fill="#FEF3C7" />
      <ellipse cx="93" cy="152" rx="7" ry="4" fill="#1F2937" />
      <ellipse cx="107" cy="152" rx="7" ry="4" fill="#1F2937" />
    </ChefBase>
  );
}

export default {
  ChefShrugging,
  ChefThumbsUp,
  ChefWinking,
  ChefSleeping,
  ChefRunning,
  ChefRelaxing,
  ChefWorried,
  ChefPresenting,
  ChefCelebrating,
};
