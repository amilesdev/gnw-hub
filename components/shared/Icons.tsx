import * as React from 'react';
import {
  ArrowDown as LArrowDown,
  ArrowUp as LArrowUp,
  Bell as LBell,
  BellOff as LBellOff,
  BookOpen,
  Calendar as LCalendar,
  CalendarOff as LCalendarOff,
  Camera as LCamera,
  ChartBar,
  Check as LCheck,
  ChevronDown as LChevronDown,
  ChevronLeft as LChevronLeft,
  ChevronRight as LChevronRight,
  Clock as LClock,
  Copy as LCopy,
  DoorOpen,
  Download as LDownload,
  Ellipsis,
  ExternalLink as LExternalLink,
  Eye as LEye,
  EyeOff as LEyeOff,
  FileText as LFileText,
  GripVertical,
  House,
  Link as LLink,
  ListPlus,
  Lock as LLock,
  LogOut as LLogOut,
  MapPin as LMapPin,
  Maximize2,
  MessageCircle as LMessageCircle,
  Mic as LMic,
  MicOff as LMicOff,
  Moon as LMoon,
  Music as LMusic,
  Pause as LPause,
  Pencil as LPencil,
  Phone as LPhone,
  PhoneOff as LPhoneOff,
  Pin as LPin,
  Play as LPlay,
  Plus as LPlus,
  Repeat as LRepeat,
  Reply as LReply,
  RotateCcw as LRotateCcw,
  Search as LSearch,
  Send as LSend,
  Settings as LSettings,
  Shirt as LShirt,
  Sparkles,
  Sun as LSun,
  Trash2,
  Upload as LUpload,
  User,
  Users as LUsers,
  Video as LVideo,
  VideoOff as LVideoOff,
  X as LX,
  type LucideIcon,
} from 'lucide-react';

// GNW icon set (CMP-18): Lucide (ISC) at stroke 1.75, round caps, no fill.
// Every export keeps its old name so call sites don't change. A few custom
// glyphs stay hand-drawn: Pray and Crossover (no Lucide equivalent) and the
// GNW Play marks (Play is outside the redesign, so they're untouched).
type P = React.SVGProps<SVGSVGElement>;

const lucide = (Icon: LucideIcon, defaults?: Partial<P>) => {
  const C = ({ width = 20, height = 20, ...p }: P) => (
    <Icon width={width} height={height} strokeWidth={1.75} {...defaults} {...(p as object)} />
  );
  C.displayName = Icon.displayName;
  return C;
};

function Base({ children, width = 20, height = 20, ...p }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
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

export const Home = lucide(House);
export const Calendar = lucide(LCalendar);
export const CalendarOff = lucide(LCalendarOff);
export const Music = lucide(LMusic);
export const MusicPlus = lucide(ListPlus);
export const UserIcon = lucide(User);
export const Users = lucide(LUsers);
export const Bell = lucide(LBell);
export const BellOff = lucide(LBellOff);
export const Eye = lucide(LEye);
export const EyeOff = lucide(LEyeOff);
export const Plus = lucide(LPlus);
export const Camera = lucide(LCamera);
export const X = lucide(LX);
export const Check = lucide(LCheck);
export const Pencil = lucide(LPencil);
export const Trash = lucide(Trash2);
export const Clock = lucide(LClock);
export const MapPin = lucide(LMapPin);
export const ChevronRight = lucide(LChevronRight);
export const ChevronLeft = lucide(LChevronLeft);
export const ChevronDown = lucide(LChevronDown);
// Media play/pause are filled in media buttons.
export const Play = lucide(LPlay, { fill: 'currentColor' });
export const Pause = lucide(LPause, { fill: 'currentColor' });
export const Repeat = lucide(LRepeat);
export const RotateCcw = lucide(LRotateCcw);
export const Link = lucide(LLink);
export const ExternalLink = lucide(LExternalLink);
export const Upload = lucide(LUpload);
export const Download = lucide(LDownload);
export const Sparkle = lucide(Sparkles);
export const MoreHorizontal = lucide(Ellipsis);
export const Lock = lucide(LLock);
export const Grip = lucide(GripVertical);
export const Shirt = lucide(LShirt);
export const Book = lucide(BookOpen);
export const LogOut = lucide(LLogOut);
export const FileText = lucide(LFileText);
export const Poll = lucide(ChartBar);
export const Settings = lucide(LSettings);
export const Pin = lucide(LPin);
export const Moon = lucide(LMoon);
export const Sun = lucide(LSun);
export const Phone = lucide(LPhone);
export const PhoneOff = lucide(LPhoneOff);
// Leaving a room reads as "exit", not "hang up" — the call carries on without you.
export const DoorExit = lucide(DoorOpen);
export const Video = lucide(LVideo);
export const VideoOff = lucide(LVideoOff);
export const Mic = lucide(LMic);
export const MicOff = lucide(LMicOff);
export const Maximize = lucide(Maximize2);
export const MessageCircle = lucide(LMessageCircle);
export const Send = lucide(LSend);
export const ArrowDown = lucide(LArrowDown);
export const ArrowUp = lucide(LArrowUp);
export const Search = lucide(LSearch);
export const Reply = lucide(LReply);
export const Copy = lucide(LCopy);

export const Pray = (p: P) => (
  <Base {...p}>
    <path d="M12 4v7" />
    <path d="M12 11c0-1.9 1-3.4 2.4-4.8C15.7 4.9 17.5 5.4 17.5 7.4v6c0 1.4-.7 2.7-1.8 3.5L13 19" />
    <path d="M12 11c0-1.9-1-3.4-2.4-4.8C8.3 4.9 6.5 5.4 6.5 7.4v6c0 1.4.7 2.7 1.8 3.5L11 19" />
    <path d="M9 21h6" />
  </Base>
);

// Two paths crossing over, each ending in an arrow — the Crossover tab.
export const Crossover = (p: P) => (
  <Base {...p}>
    <path d="M3 7h3.5a5 5 0 0 1 4.2 2.3l2.6 4.4A5 5 0 0 0 17.5 16H21" />
    <path d="M3 17h3.5a5 5 0 0 0 4.2-2.3" />
    <path d="M13.3 9.3A5 5 0 0 1 17.5 7H21" />
    <path d="M18 4l3 3-3 3" />
    <path d="M18 13l3 3-3 3" />
  </Base>
);
