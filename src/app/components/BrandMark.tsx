export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 48 48"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="ledgero-stack" x1="6" x2="42" y1="6" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B8976C" />
          <stop offset="1" stopColor="#D4C3A3" />
        </linearGradient>
      </defs>
      <rect
        fill="url(#ledgero-stack)"
        height="25"
        rx="7"
        transform="rotate(-30 24 18)"
        width="25"
        x="11.5"
        y="5.5"
      />
      <rect
        fill="url(#ledgero-stack)"
        height="25"
        rx="7"
        transform="rotate(30 24 30)"
        width="25"
        x="11.5"
        y="17.5"
      />
      <path
        d="M20 16v17h11"
        fill="none"
        stroke="#6B573F"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity=".78"
        strokeWidth="3"
      />
    </svg>
  );
}
