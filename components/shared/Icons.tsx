import * as React from 'react';

// GNW icon set — inline, hand-drawn, stroke-based. viewBox 0 0 24 24,
// fill none, stroke currentColor, strokeWidth 1.9, round caps. (§7)
type P = React.SVGProps<SVGSVGElement>;

function Base({ children, width = 20, height = 20, ...p }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={width}
      height={height}
      {...p}
    >
      {children}
    </svg>
  );
}

export const Home = (p: P) => (
  <Base {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </Base>
);

export const Calendar = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="3" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </Base>
);

export const Music = (p: P) => (
  <Base {...p}>
    <path d="M9 18V6l11-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="17.5" cy="16" r="2.5" />
  </Base>
);

export const UserIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Base>
);

export const Users = (p: P) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18 20a6 6 0 0 0-3.2-5.3" />
  </Base>
);

export const Bell = (p: P) => (
  <Base {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 1.5 6.5 2 7H4c.5-.5 2-2 2-7Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Base>
);

export const Eye = (p: P) => (
  <Base {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);

export const EyeOff = (p: P) => (
  <Base {...p}>
    <path d="M4 4l16 16" />
    <path d="M9.6 5.9A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.7" />
    <path d="M6.5 7.8A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9.3 9.3 0 0 0 3.4-.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Base>
);

export const Plus = (p: P) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const X = (p: P) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const Check = (p: P) => (
  <Base {...p}>
    <path d="M5 12.5 10 17l9-10" />
  </Base>
);

export const Pencil = (p: P) => (
  <Base {...p}>
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="M14.5 7.5 16.5 9.5" />
  </Base>
);

export const Trash = (p: P) => (
  <Base {...p}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
  </Base>
);

export const Clock = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </Base>
);

export const MapPin = (p: P) => (
  <Base {...p}>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.6" />
  </Base>
);

export const ChevronRight = (p: P) => (
  <Base {...p}>
    <path d="M9 5l7 7-7 7" />
  </Base>
);

export const ChevronLeft = (p: P) => (
  <Base {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Base>
);

export const ChevronDown = (p: P) => (
  <Base {...p}>
    <path d="M6 9l6 6 6-6" />
  </Base>
);

export const Play = (p: P) => (
  <Base {...p}>
    <path d="M7 5l12 7-12 7V5Z" />
  </Base>
);

// The GNW Play tab mark: a bold play triangle (the hero) with one faint halo ring
// so it reads as a sibling of the other line-drawn nav icons, not a target.
export const PlayRings = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9.6" opacity={0.28} />
    <path d="M10 8 16.5 12 10 16V8Z" fill="currentColor" />
  </Base>
);

export const Pause = (p: P) => (
  <Base {...p}>
    <path d="M8 5v14M16 5v14" />
  </Base>
);

export const Repeat = (p: P) => (
  <Base {...p}>
    <path d="M17 3l3 3-3 3" />
    <path d="M20 6H8a4 4 0 0 0-4 4v1" />
    <path d="M7 21l-3-3 3-3" />
    <path d="M4 18h12a4 4 0 0 0 4-4v-1" />
  </Base>
);

export const Link = (p: P) => (
  <Base {...p}>
    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
    <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
  </Base>
);

export const Upload = (p: P) => (
  <Base {...p}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M5 20h14" />
  </Base>
);

export const Sparkle = (p: P) => (
  <Base {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
  </Base>
);

export const Lock = (p: P) => (
  <Base {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Base>
);

export const Grip = (p: P) => (
  <Base {...p}>
    <circle cx="9" cy="6" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1.1" fill="currentColor" stroke="none" />
  </Base>
);

export const Shirt = (p: P) => (
  <Base {...p}>
    <path d="M8 3 4 6l2 3 2-1v10a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V8l2 1 2-3-4-3-1.5 2a3.5 3.5 0 0 1-5 0L8 3Z" />
  </Base>
);

export const Book = (p: P) => (
  <Base {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5Z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" />
  </Base>
);

export const LogOut = (p: P) => (
  <Base {...p}>
    <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
    <path d="M18 15l3-3-3-3M9 12h12" />
  </Base>
);

export const Pray = (p: P) => (
  <Base {...p}>
    <path d="M12 4v7" />
    <path d="M12 11c0-1.9 1-3.4 2.4-4.8C15.7 4.9 17.5 5.4 17.5 7.4v6c0 1.4-.7 2.7-1.8 3.5L13 19" />
    <path d="M12 11c0-1.9-1-3.4-2.4-4.8C8.3 4.9 6.5 5.4 6.5 7.4v6c0 1.4.7 2.7 1.8 3.5L11 19" />
    <path d="M9 21h6" />
  </Base>
);

export const FileText = (p: P) => (
  <Base {...p}>
    <path d="M6 3.5h7l5 5V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5" />
    <path d="M13 3.5V9h5" />
    <path d="M9 13h6M9 16.5h6" />
  </Base>
);

export const Poll = (p: P) => (
  <Base {...p}>
    <path d="M4 20.5h16" />
    <path d="M7 20.5v-7M12 20.5V5.5M17 20.5v-10" />
  </Base>
);

export const Settings = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v2.3M12 19.2v2.3M21.5 12h-2.3M4.8 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
  </Base>
);

export const Pin = (p: P) => (
  <Base {...p}>
    <path d="M9 4h6M10 4l-.5 6-3 2.5v1.5h11V12.5L14.5 10 14 4" />
    <path d="M12 15.5V21" />
  </Base>
);

export const Moon = (p: P) => (
  <Base {...p}>
    <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a7 7 0 1 0 11 11Z" />
  </Base>
);

export const Phone = (p: P) => (
  <Base {...p}>
    <path d="M21 16.5v2.8a2 2 0 0 1-2.2 2 19.5 19.5 0 0 1-8.5-3 19 19 0 0 1-6-6 19.5 19.5 0 0 1-3-8.6A2 2 0 0 1 3.3 1.5h2.8a2 2 0 0 1 2 1.7c.13.9.35 1.8.66 2.7a2 2 0 0 1-.45 2.1L7 9.3a15.5 15.5 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.86.3 1.76.53 2.68.66a2 2 0 0 1 1.72 2Z" />
  </Base>
);

export const PhoneOff = (p: P) => (
  <Base {...p}>
    <path d="M21 16.5v2.8a2 2 0 0 1-2.2 2 19.5 19.5 0 0 1-8.5-3 19 19 0 0 1-6-6 19.5 19.5 0 0 1-3-8.6A2 2 0 0 1 3.3 1.5h2.8a2 2 0 0 1 2 1.7c.13.9.35 1.8.66 2.7a2 2 0 0 1-.45 2.1L7 9.3a15.5 15.5 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.86.3 1.76.53 2.68.66a2 2 0 0 1 1.72 2Z" />
    <path d="M2 2l20 20" />
  </Base>
);

export const Video = (p: P) => (
  <Base {...p}>
    <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
    <path d="M15.5 10 21 7v10l-5.5-3" />
  </Base>
);

export const VideoOff = (p: P) => (
  <Base {...p}>
    <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
    <path d="M15.5 10 21 7v10l-5.5-3" />
    <path d="M3 3l18 18" />
  </Base>
);

export const Mic = (p: P) => (
  <Base {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
    <path d="M12 17.5V21" />
  </Base>
);

export const MicOff = (p: P) => (
  <Base {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
    <path d="M12 17.5V21" />
    <path d="M4 4l16 16" />
  </Base>
);

export const Maximize = (p: P) => (
  <Base {...p}>
    <path d="M9 4H4v5" />
    <path d="M15 4h5v5" />
    <path d="M15 20h5v-5" />
    <path d="M9 20H4v-5" />
  </Base>
);
