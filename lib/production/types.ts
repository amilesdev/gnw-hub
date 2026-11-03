// Shapes for the Production feature. A stage map is stored as one JSON document
// per venue (StageMap.data); it is always read and edited whole, and leader
// quick-adds ("Add mic") only append devices + cables to it.

export type ZoneId = 'instruments' | 'musician_ears' | 'vocal_ears' | 'mics' | 'stagebox' | 'di';

export type CableType = 'XLR' | 'TRS' | 'TS' | 'Ethernet' | 'USB' | 'XLRP' | 'Wireless';
export type CableColor = 'black' | 'gray' | 'red' | 'blue';
export type PowerKind = 'AC adapter' | 'DC adapter' | 'Batteries';
export type PackGroup = 'lead' | 'bgv' | 'guest';

/** A device's port, e.g. ['di', 'In 3'] or ['sb', 'Out 1']. */
export type PortRef = [deviceId: string, port: string];

export type StageDevice = {
  id: string;
  name: string;
  /** Short label for tabs where several units share a spot (receivers). */
  short?: string;
  model?: string;
  kind?: 'tx' | 'rx' | 'mic' | 'packs' | 'p16';
  /** Transmitters: which pack group they feed. */
  group?: PackGroup;
  zone: ZoneId;
  power?: PowerKind;
  packed?: string;
  where?: string;
  /** Which drawing on the map this device belongs to (see lib/production/layout.ts). */
  prop?: string;
  /** The player brings it (guitar, bass, keys computer). */
  own?: boolean;
  /** Frequency group/channel, e.g. "Group 1 · Ch 1". */
  gc?: string;
  /** Receivers: the handheld they pair with. */
  pairs?: string;
  /** Set on leader quick-adds so they can be removed again. */
  added?: boolean;
};

export type StageCable = {
  id: string;
  zone: ZoneId;
  from: PortRef;
  to: PortRef;
  type: CableType;
  color: CableColor;
  /** Name of the stage-box channel this cable lands on (front-panel label). */
  label?: string;
  note?: string;
  /** Not a sound path (the computer's USB), so it's left out of tracing. */
  noTrace?: boolean;
  added?: boolean;
};

export type DrumMic = { port: string; input: number; mount: 'clip' | 'stand'; label: string };
export type P16Channel = { ch: string; label: string; span: 1 | 2; color: string };

export type StageMapData = {
  version: 1;
  devices: StageDevice[];
  cables: StageCable[];
  drumMics: DrumMic[];
  p16Channels: P16Channel[];
  steps: Record<ZoneId, string[]>;
  notes: Partial<Record<ZoneId, string>>;
};

export type StageMapDTO = { id: string; name: string; venue: string; data: StageMapData };

export type ProductionTaskDTO = {
  id: string;
  templateTaskId: string | null;
  zone: string | null;
  title: string;
  notes: string | null;
  sortOrder: number;
  ownerId: string | null;
  ownerName: string | null;
  doneAt: string | null;
  doneByName: string | null;
  /** Added to this event only (not from the template). */
  oneOff: boolean;
};

export type TemplateTaskDTO = { id: string; zone: string | null; title: string; notes: string | null; sortOrder: number };
export type TemplateDTO = { id: string; kind: 'service' | 'encounter_night' | 'other'; name: string; tasks: TemplateTaskDTO[] };

export type PackSingerDTO = { userId: string; name: string; image: string | null; part: string | null; leads: string[]; group: PackGroup };

export type ProductionEventDTO = {
  id: string;
  eventName: string;
  type: string;
  date: string;
  time: string;
};

export type PersonDTO = { id: string; name: string; image: string | null };
