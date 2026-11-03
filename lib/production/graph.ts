import type { CableType, PackGroup, StageCable, StageDevice, StageMapData, ZoneId } from './types';

// Pure helpers over a stage map: naming, signal tracing and sentences. Shared by
// the client screens and the server, so nothing here touches the DB.

export const ZONES: { id: ZoneId; name: string; blurb: string }[] = [
  { id: 'instruments', name: 'Instruments', blurb: 'Keys, tracks, guitar, bass, drum mics' },
  { id: 'musician_ears', name: 'Musician Ears', blurb: 'P16 hub and the band\'s four mixers' },
  { id: 'vocal_ears', name: 'Vocalist In-Ears', blurb: 'Three PSM300 transmitters and who gets which pack' },
  { id: 'mics', name: 'Microphones', blurb: 'Wireless receivers and the talkback' },
  { id: 'stagebox', name: 'Stage Box', blurb: 'Where everything plugs in' },
  { id: 'di', name: 'DI Box', blurb: 'Turns instrument cables into XLR' },
];
export const ZONE_IDS = ZONES.map((z) => z.id);
export const zoneName = (z: string | null | undefined) => ZONES.find((x) => x.id === z)?.name ?? 'General';
/** CSS color for a zone (tokens live in app/globals.css). */
export const zoneColor = (z: string | null | undefined) => (ZONES.some((x) => x.id === z) ? `var(--pd-z-${z})` : 'rgb(var(--ink-faint))');

export const CABLE_TYPE_LABEL: Record<CableType, string> = {
  XLR: 'XLR', TRS: '¼″ TRS', TS: '¼″ TS', Ethernet: 'Ethernet', USB: 'USB', XLRP: 'XLR + ¼″-to-XLR', Wireless: 'Wireless',
};
export const CABLE_COLOR: Record<string, string> = {
  black: 'var(--pd-c-black)', gray: 'var(--pd-c-gray)', red: 'var(--pd-c-red)', blue: 'var(--pd-c-blue)',
};
export const PACK_LABEL: Record<PackGroup, [string, string]> = { lead: ['Lead', 'G1 · Ch 1'], bgv: ['BGV', 'G2 · Ch 1'], guest: ['Guest', 'G3 · Ch 1'] };

export class StageGraph {
  readonly devices: Map<string, StageDevice>;
  readonly drum: Map<string, StageMapData['drumMics'][number]>;
  constructor(readonly data: StageMapData) {
    this.devices = new Map(data.devices.map((d) => [d.id, d]));
    this.drum = new Map(data.drumMics.map((m) => [m.port, m]));
  }

  dev(id: string): StageDevice {
    return this.devices.get(id) ?? { id, name: id, zone: 'instruments' };
  }

  get cables(): StageCable[] {
    return this.data.cables;
  }

  /** Name for one end of a cable — drum mics read as "Kick", "Snare"… */
  endName(devId: string, port: string): string {
    const m = devId === 'drums' ? this.drum.get(port) : undefined;
    return m ? m.label : this.dev(devId).name;
  }
  endSub(devId: string, port: string): string {
    const m = devId === 'drums' ? this.drum.get(port) : undefined;
    if (m) return m.mount === 'clip' ? 'Clip-on mic' : 'Mic on a stand';
    return prettyPort(port);
  }

  internalFwd(d: string, p: string): string | null {
    const k = this.devices.get(d)?.kind;
    if (d === 'di' && p.startsWith('In ')) return 'Out ' + p.slice(3);
    if (k === 'rx' && p === 'Antenna') return 'Out';
    if (k === 'tx' && p === 'Input 1 L') return 'Wireless';
    return null;
  }
  internalBack(d: string, p: string): string | null {
    const k = this.devices.get(d)?.kind;
    if (d === 'di' && p.startsWith('Out ')) return 'In ' + p.slice(4);
    if (k === 'rx' && p === 'Out') return 'Antenna';
    if (k === 'tx' && p === 'Wireless') return 'Input 1 L';
    if (d === 'hub' && p.startsWith('Port ')) return 'Ultranet in';
    return null;
  }

  /** Every cable and box a signal passes through, in order, around one cable. */
  pathThrough(c: StageCable): { cables: StageCable[]; nodes: { dev: string; in?: string; out?: string | null }[] } {
    const all = this.cables;
    const list = [c];
    let cur = c;
    for (let g = 0; g < 20; g++) {
      const ip = this.internalBack(cur.from[0], cur.from[1]);
      if (!ip) break;
      const prev = all.find((x) => x.to[0] === cur.from[0] && x.to[1] === ip);
      if (!prev) break;
      list.unshift(prev);
      cur = prev;
    }
    cur = c;
    for (let g = 0; g < 20; g++) {
      const ip = this.internalFwd(cur.to[0], cur.to[1]);
      if (!ip) break;
      const next = all.find((x) => x.from[0] === cur.to[0] && x.from[1] === ip);
      if (!next) break;
      list.push(next);
      cur = next;
    }
    const nodes: { dev: string; in?: string; out?: string | null }[] = [];
    list.forEach((cb, i) => {
      if (i === 0) nodes.push({ dev: cb.from[0], out: cb.from[1] });
      const nxt = list[i + 1];
      nodes.push({ dev: cb.to[0], in: cb.to[1], out: nxt ? nxt.from[1] : null });
    });
    return { cables: list, nodes };
  }

  /** Choices for "Trace a sound": sources going in, destinations coming out. */
  traceChoices() {
    const all = this.cables.filter((c) => !c.noTrace);
    const ins = all.filter((c) => c.from[0] !== 'sb' && !this.internalBack(c.from[0], c.from[1]));
    const outs = all.filter((c) => c.to[0] !== 'sb' && c.to[0] !== 'hub' && !this.internalFwd(c.to[0], c.to[1]));
    return {
      ins: ins.map((c) => ({ id: c.id, label: this.startLabel(c) })),
      outs: outs.map((c) => ({ id: c.id, label: this.dev(c.to[0]).name })),
    };
  }
  private startLabel(c: StageCable): string {
    const [d, p] = c.from;
    if (d === 'drums') return this.endName(d, p);
    if (d === 'keys1' || d === 'keys2') return `${this.dev(d).name} · ${p === 'Out L' ? 'left' : 'right'}`;
    if (d === 'iface') return `Tracks · ${p === 'Monitor 1' ? 'left' : 'right'}`;
    return this.dev(d).name;
  }

  /** "Use a gray ¼″ TRS cable from Keys 1 left output to DI box input 1." as parts, so the UI can bold names. */
  sentence(c: StageCable): { text: string; bold?: boolean }[] {
    const A = this.endName(...c.from);
    const B = this.endName(...c.to);
    const pa = portWords(c.from[0], c.from[1], this);
    const pb = portWords(c.to[0], c.to[1], this);
    const a = this.dev(c.from[0]);
    const b = this.dev(c.to[0]);
    if (c.type === 'Wireless') {
      const gc = b.gc || a.gc;
      return [{ text: A, bold: true }, { text: ' sends to ' }, { text: B, bold: true }, { text: ` wirelessly${gc ? ` on ${gc}` : ''}.` }];
    }
    if (c.type === 'XLRP') {
      return [{ text: 'Connect a ' }, { text: 'black XLR', bold: true }, { text: ' from ' }, { text: A, bold: true }, { text: ` ${pa}, join it to a ` },
        { text: '¼″-to-XLR', bold: true }, { text: ' cable, and plug the ¼″ end into ' }, { text: B, bold: true }, { text: ` ${pb}.` }];
    }
    return [{ text: 'Use a ' }, { text: `${c.color} ${CABLE_TYPE_LABEL[c.type]}`, bold: true }, { text: ' cable from ' }, { text: A, bold: true },
      { text: `${pa ? ' ' + pa : ''} to ` }, { text: B, bold: true }, { text: `${pb ? ' ' + pb : ''}.` }];
  }

  zoneStats(z: ZoneId) {
    const cables = this.cables.filter((c) => c.zone === z && c.type !== 'Wireless').length;
    const devs = this.data.devices.filter((d) => d.zone === z && d.kind !== 'mic' && d.kind !== 'packs');
    const powered = devs.filter((d) => d.power === 'AC adapter' || d.power === 'DC adapter').length;
    return { cables, powered, gear: devs.length };
  }

  openInputs(): number[] {
    const used = new Set(this.cables.filter((c) => c.to[0] === 'sb').map((c) => Number(c.to[1].slice(3))));
    return Array.from({ length: 32 }, (_, i) => i + 1).filter((n) => !used.has(n));
  }
}

export function prettyPort(p: string): string {
  return p.replace(/^In (\d+)$/, 'Input $1').replace(/^Out (\d+)$/, 'Output $1');
}

function portWords(d: string, p: string, g: StageGraph): string {
  if (d === 'drums' && g.drum.has(p)) return '';
  const map: Record<string, string> = {
    'Out L': 'left output', 'Out R': 'right output', 'Monitor 1': 'monitor output 1 (left)', 'Monitor 2': 'monitor output 2 (right)',
    Out: 'output', In: 'input', USB: 'USB port', Ultranet: 'Ultranet port', 'Ultranet in': 'Ultranet input',
  };
  return map[p] ?? prettyPort(p).replace(/^Input/, 'input').replace(/^Output/, 'output').replace(/^Port/, 'port');
}
