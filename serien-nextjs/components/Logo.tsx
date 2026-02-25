export default function Logo({ className = "h-8" }: { className?: string }) {
  return (
    <svg 
      className={className}
      viewBox="0 0 180 40" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="tmdbGradient" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#90CEA1" />
          <stop offset="56%" stopColor="#3CBEC9" />
          <stop offset="100%" stopColor="#00B3E5" />
        </linearGradient>
        
        <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F0F9FF" />
        </linearGradient>
      </defs>
      
      {/* S Symbol */}
      <g>
        <circle cx="20" cy="20" r="18" fill="url(#tmdbGradient)" />
        
        <text
          x="20"
          y="29"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="24"
          fontWeight="900"
          fill="#032541"
          textAnchor="middle"
        >
          S
        </text>
      </g>
      
      {/* Text serien.de */}
      <text 
        x="45" 
        y="27" 
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" 
        fontSize="22" 
        fontWeight="700" 
        fill="url(#textGradient)"
        style={{ letterSpacing: '-0.5px' }}
      >
        serien.de
      </text>
    </svg>
  );
}