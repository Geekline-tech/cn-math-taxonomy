export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path
        d="M16 23V17m0 0-5.6-5.2M16 17l5.6-5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle cx="16" cy="24.2" r="2.9" fill="currentColor" />
      <circle cx="9.4" cy="10.6" r="2.3" fill="currentColor" opacity="0.55" />
      <circle cx="22.6" cy="10.6" r="2.3" fill="currentColor" opacity="0.55" />
    </svg>
  )
}
