import { PROPS } from './layout';
import type { CableType } from './types';

// Top-down gear drawings as SVG markup, drawn around (0,0). Static strings with
// no user text in them, injected with dangerouslySetInnerHTML by the map, the
// gear thumbnails and the item sheet. Colors are the --pd-* tokens in
// app/globals.css; the shared <defs> (key pattern, drop shadow) are rendered
// once by <ProductionDefs/>.

const v = (name: string) => `var(--pd-${name})`;
const st = (s: string) => `style="${s}"`;

function sel(w: number, h: number, r = 8) {
  return `<rect class="pd-sel" x="${-w / 2 - 4}" y="${-h / 2 - 4}" width="${w + 8}" height="${h + 8}" rx="${r}"/>`;
}
function keybed(x: number, y: number, w: number, sy = 1) {
  return `<g transform="translate(${x},${y}) scale(1,${sy})"><rect width="${w}" height="18" fill="url(#pd-kbr)"/></g>`;
}
function outline(x: number, y: number, w: number, h: number, r: number, width = 0.8) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${st(`fill: none; stroke: ${v('edge')}; stroke-width: ${width}`)}/>`;
}
function p16(x: number) {
  return `<g filter="url(#pd-sh)" transform="translate(${x},0)">
    <rect x="-11" y="-9" width="22" height="18" rx="2.5" ${st(`fill: ${v('metal-dark')}`)}/>${outline(-11, -9, 22, 18, 2.5, 0.7)}
    <rect x="-8" y="-6.5" width="8" height="3.4" rx=".6" ${st(`fill: ${v('lcd')}`)}/>
    ${Array.from({ length: 8 }, (_, i) => `<rect x="${-8 + (i % 4) * 4.2}" y="${-1 + Math.floor(i / 4) * 4}" width="3" height="2.6" rx=".5" ${st(`fill: ${[0, 3, 5].includes(i) ? v('led') : v('metal-hi')}`)}/>`).join('')}
    <circle cx="6.5" cy="-4.8" r="2.2" ${st(`fill: ${v('silver-dark')}`)}/></g>`;
}

export function drawProp(pid: string): string {
  switch (pid) {
    case 'keys':
      return `${sel(164, 70)}
      <g filter="url(#pd-sh)" transform="translate(0,16)">
        <rect x="-64" y="-12" width="128" height="30" rx="4" ${st(`fill: ${v('metal')}`)}/>${outline(-64, -12, 128, 30, 4)}
        ${keybed(-52.5, -10, 105, 0.85)}
        <rect x="-10" y="7" width="20" height="7" rx="1" ${st(`fill: ${v('lcd')}`)}/>
        <rect x="42" y="10" width="18" height="2" rx="1" ${st(`fill: ${v('c-red')}`)}/>
        ${[-50, -43, -36, -29, -22].map((x) => `<circle cx="${x}" cy="10.5" r="1.8" ${st(`fill: ${v('silver-dark')}`)}/>`).join('')}
      </g>
      <g filter="url(#pd-sh)" transform="translate(0,-16)">
        <rect x="-80" y="-19" width="160" height="38" rx="4" ${st(`fill: ${v('metal-dark')}`)}/>${outline(-80, -19, 160, 38, 4)}
        ${keybed(-74, -15, 147)}
        <rect x="-74" y="2.5" width="147" height="1.4" ${st(`fill: ${v('edge')}`)} opacity=".5"/>
        <rect x="-12" y="6" width="24" height="9" rx="1.2" ${st(`fill: ${v('lcd')}`)}/>
        ${[-60, -52, -44, 22, 30, 38, 46, 54, 62].map((x) => `<circle cx="${x}" cy="10.5" r="2" ${st(`fill: ${v('silver-dark')}`)}/>`).join('')}
      </g>`;
    case 'iface':
      return `${sel(30, 18, 5)}<g filter="url(#pd-sh)">
      <rect x="-15" y="-9" width="30" height="18" rx="3" ${st(`fill: ${v('iface')}`)}/>
      <circle cx="-7" cy="0" r="3.4" ${st(`fill: ${v('silver')}`)}/><circle cx="1.5" cy="0" r="3.4" ${st(`fill: ${v('silver')}`)}/>
      <circle cx="10" cy="0" r="4.4" ${st(`fill: ${v('metal-dark')}`)}/><circle cx="10" cy="0" r="1.5" ${st(`fill: ${v('silver')}`)}/>
      <circle cx="-11.5" cy="-6" r=".9" ${st(`fill: ${v('led')}`)}/></g>`;
    case 'laptop':
      // Turned so the trackpad faces the keyboard.
      return `<g transform="rotate(90)">${sel(52, 36)}<g filter="url(#pd-sh)">
      <rect x="-26" y="12" width="52" height="6" rx="2" ${st(`fill: ${v('metal')}`)}/>
      <rect x="-26" y="-18" width="52" height="31" rx="3" ${st(`fill: ${v('silver')}`)}/>
      <g ${st(`fill: ${v('silver-dark')}`)}>${Array.from({ length: 4 }, (_, r) => Array.from({ length: 11 }, (_, i) => `<rect x="${-22 + i * 4}" y="${-2 + r * 3.6}" width="3.2" height="2.8" rx=".5"/>`).join('')).join('')}</g>
      <rect x="-9" y="-15" width="18" height="9" rx="1.5" ${st(`fill: ${v('silver-dark')}`)} opacity=".7"/></g></g>`;
    case 'talkback':
      return `${sel(26, 28, 13)}
      <g ${st(`stroke: ${v('metal-hi')}; stroke-width: 1.4; stroke-linecap: round`)}><line x1="0" y1="4" x2="-8" y2="10"/><line x1="0" y1="4" x2="8" y2="10"/><line x1="0" y1="4" x2="0" y2="-6"/></g>
      <g filter="url(#pd-sh)" transform="rotate(150)"><rect x="-2.6" y="-4" width="5.2" height="14" rx="2.4" ${st(`fill: ${v('metal-dark')}`)}/>
      <circle cx="0" cy="-6" r="5.2" ${st(`fill: ${v('silver-dark')}; stroke: ${v('metal-dark')}; stroke-width: .8`)}/>
      <path d="M-3.5,-6 h7 M0,-9.5 v7" ${st(`stroke: ${v('metal-dark')}; stroke-width: .5`)}/></g>`;
    case 'di':
      return `${sel(68, 30, 6)}<g filter="url(#pd-sh)">
      <rect x="-34" y="-15" width="68" height="30" rx="3" ${st(`fill: ${v('di-body')}`)}/>${outline(-34, -15, 68, 30, 3)}
      ${Array.from({ length: 8 }, (_, i) => `<circle cx="${-27 + i * 7.7}" cy="9" r="2.5" ${st(`fill: ${v('metal-dark')}; stroke: ${v('silver')}; stroke-width: 1`)}/>`).join('')}
      <text x="26" y="1" ${st(`fill: ${v('silver')}; font: 800 6px system-ui, sans-serif; text-anchor: middle`)}>DI</text></g>`;
    case 'tx':
      return `${sel(62, 16, 5)}${[-19, 0, 19].map((x) => `<g filter="url(#pd-sh)" transform="translate(${x},0)">
      <rect x="-9" y="-6.5" width="18" height="13" rx="2" ${st(`fill: ${v('metal-dark')}`)}/>${outline(-9, -6.5, 18, 13, 2, 0.7)}
      <rect x="-6" y="-3" width="8" height="4" rx=".8" ${st(`fill: ${v('lcd')}`)}/><circle cx="5" cy="-1" r="1.6" ${st(`fill: ${v('silver-dark')}`)}/>
      <line x1="-7" y1="-6" x2="-9" y2="-14" ${st(`stroke: ${v('metal-hi')}; stroke-width: 1.2; stroke-linecap: round`)}/>
      <line x1="7" y1="-6" x2="9" y2="-14" ${st(`stroke: ${v('metal-hi')}; stroke-width: 1.2; stroke-linecap: round`)}/></g>`).join('')}`;
    case 'guitar':
      return `${sel(66, 36, 18)}<g filter="url(#pd-sh)" transform="rotate(-24)">
      <rect x="0" y="-2.6" width="34" height="5.2" rx="1" ${st(`fill: ${v('neck')}`)}/>
      ${[6, 12, 18, 24, 30].map((x) => `<rect x="${x}" y="-2.6" width=".6" height="5.2" ${st(`fill: ${v('rosewood')}`)} opacity=".6"/>`).join('')}
      <path d="M33,-3.4 h8 a2,2 0 0 1 2,2 v2 a2,2 0 0 1 -2,2 h-8 z" ${st(`fill: ${v('neck')}`)}/>
      <path d="M-34,0 C-34,-13 -22,-15 -13,-10 C-7,-15 0,-15 3,-11 C-1,-6 -1,6 3,11 C0,15 -7,15 -13,10 C-22,15 -34,13 -34,0 Z" ${st(`fill: ${v('strat')}; stroke: ${v('edge')}; stroke-width: .9`)}/>
      <path d="M-24,4 C-26,-6 -16,-10 -9,-7 C-5,-9 -1,-8 0,-5 L0,5 C-6,9 -18,11 -24,4 Z" ${st(`fill: ${v('metal-dark')}`)} opacity=".9"/>
      ${[-17, -11, -5].map((x) => `<rect x="${x}" y="-3.5" width="2.4" height="7" rx="1" ${st(`fill: ${v('key-white')}`)}/>`).join('')}
      <path d="M-28,0 H40" ${st(`stroke: ${v('silver')}; stroke-width: .5`)}/></g>`;
    case 'bass':
      return `${sel(76, 36, 18)}<g filter="url(#pd-sh)" transform="rotate(-20)">
      <rect x="0" y="-2.8" width="42" height="5.6" rx="1" ${st(`fill: ${v('rosewood')}`)}/>
      ${[7, 14, 21, 28, 35].map((x) => `<rect x="${x}" y="-2.8" width=".6" height="5.6" ${st(`fill: ${v('silver')}`)} opacity=".7"/>`).join('')}
      <path d="M41,-3.8 h9 a2,2 0 0 1 2,2 v3.6 a2,2 0 0 1 -2,2 h-9 z" ${st(`fill: ${v('metal-dark')}`)}/>
      <path d="M-36,0 C-36,-14 -23,-16 -14,-11 C-6,-17 1,-16 4,-12 C0,-6 0,6 4,12 C1,16 -6,17 -14,11 C-23,16 -36,14 -36,0 Z" ${st(`fill: ${v('metal-dark')}; stroke: ${v('edge')}; stroke-width: .9`)}/>
      ${[-20, -11].map((x) => `<rect x="${x}" y="-4.5" width="3" height="9" rx="1" ${st(`fill: ${v('metal')}`)}/>`).join('')}
      <path d="M-28,0 H50" ${st(`stroke: ${v('silver')}; stroke-width: .6`)}/></g>`;
    case 'drums': {
      const drum = (x: number, y: number, r: number) =>
        `<circle cx="${x}" cy="${y}" r="${r}" ${st(`fill: ${v('head')}; stroke: ${v('shell')}; stroke-width: 2.6`)}/><circle cx="${x}" cy="${y}" r="${r - 3}" ${st(`fill: none; stroke: ${v('silver-dark')}; stroke-width: .5`)}/>`;
      const cym = (x: number, y: number, r: number) =>
        `<g opacity=".95"><circle cx="${x}" cy="${y}" r="${r}" ${st(`fill: ${v('brass')}`)}/>${[0.66, 0.38].map((k) => `<circle cx="${x}" cy="${y}" r="${r * k}" ${st(`fill: none; stroke: ${v('brass-dark')}; stroke-width: .6`)}/>`).join('')}<circle cx="${x}" cy="${y}" r="${r * 0.2}" ${st(`fill: ${v('brass-dark')}`)}/></g>`;
      const mic = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="2.1" ${st(`fill: ${v('metal-dark')}; stroke: ${v('silver')}; stroke-width: .6`)}/>`;
      return `${sel(92, 96, 46)}<g filter="url(#pd-sh)">
        <rect x="-26" y="-13" width="38" height="26" rx="5" ${st(`fill: ${v('shell')}`)}/>
        <rect x="-28" y="-14" width="4" height="28" rx="1.6" ${st(`fill: ${v('silver')}`)}/><rect x="10" y="-14" width="4" height="28" rx="1.6" ${st(`fill: ${v('silver')}`)}/>
        <circle cx="31" cy="0" r="9" ${st(`fill: ${v('metal-dark')}`)}/>
        ${drum(-4, 10, 8.5)}${drum(-4, -10, 9)}${drum(19, -26, 12)}${drum(12, 21, 10)}
        ${cym(0, 37, 10)}${cym(-26, 28, 13.5)}${cym(-22, -32, 15)}
        ${mic(-30, 0)}${mic(12, 12)}${mic(-4, 2)}${mic(-4, -2)}${mic(19, -15)}${mic(-14, 24)}${mic(-14, -26)}
      </g>`;
    }
    case 'stagebox':
      return `${sel(32, 94, 6)}<g filter="url(#pd-sh)">
      <rect x="-16" y="-47" width="32" height="94" rx="3" ${st(`fill: ${v('metal-dark')}`)}/>${outline(-16, -47, 32, 94, 3)}
      <rect x="-16" y="-47" width="8" height="94" rx="2" ${st(`fill: ${v('metal')}`)}/>
      ${Array.from({ length: 16 }, (_, i) => `<circle cx="-12" cy="${-41 + i * 5.4}" r="1.4" ${st(`fill: ${v('silver')}`)}/>`).join('')}
      ${Array.from({ length: 9 }, (_, i) => `<rect x="-2" y="${-38 + i * 9}" width="14" height="1.4" rx=".7" ${st(`fill: ${v('metal-hi')}`)}/>`).join('')}
      <circle cx="10" cy="42" r="1.2" ${st(`fill: ${v('led')}`)}/></g>`;
    case 'hub':
      return `${sel(30, 18, 5)}<g filter="url(#pd-sh)">
      <rect x="-15" y="-9" width="30" height="18" rx="2.5" ${st(`fill: ${v('metal')}`)}/>${outline(-15, -9, 30, 18, 2.5, 0.7)}
      ${[0, 1, 2, 3].map((i) => `<rect x="-13" y="${-7 + i * 3.6}" width="5" height="2.6" rx=".4" ${st(`fill: ${v('gold')}`)}/>`).join('')}
      <circle cx="9" cy="-4" r="1.3" ${st(`fill: ${v('led-blue')}`)}/>
      <text x="4" y="4" ${st(`fill: ${v('silver')}; font: 800 4.5px system-ui, sans-serif; text-anchor: middle`)}>P16</text></g>`;
    case 'rx':
      return `${sel(30, 58, 6)}<g filter="url(#pd-sh)">
      <rect x="-15" y="-29" width="30" height="58" rx="3" ${st(`fill: ${v('metal')}`)}/>
      ${Array.from({ length: 8 }, (_, i) => `<rect x="-12" y="${-26 + i * 6.8}" width="24" height="5.4" rx="1" ${st(`fill: ${v('metal-dark')}`)}/><rect x="-9" y="${-24.8 + i * 6.8}" width="7" height="3" rx=".5" ${st(`fill: ${v('lcd')}`)}/><circle cx="8" cy="${-23.3 + i * 6.8}" r="1" ${st(`fill: ${v('led')}`)}/>`).join('')}</g>`;
    case 'p16k':
    case 'p16d':
      return `<rect class="pd-sel" x="-15" y="-13" width="30" height="26" rx="6"/>${p16(0)}`;
    case 'p16gb':
      return `${sel(52, 20, 6)}${p16(-13)}${p16(13)}`;
  }
  return '';
}

/** A standalone viewBox that frames one drawing (thumbnails, sheet header). */
export function propViewBox(pid: string): string {
  const p = PROPS[pid];
  const w = (p?.w ?? 40) + 28;
  const h = (p?.h ?? 40) + 28;
  return `${-w / 2} ${-h / 2} ${w} ${h}`;
}

/** A cable plug, drawn pointing right with its tip at x≈30; the cable enters at x=0. */
export function drawPlug(type: CableType, col: string): string {
  const halo = `stroke: ${v('cable-halo')}; stroke-width: 1`;
  const relief = `<rect x="0" y="-2.4" width="7" height="4.8" rx="2" ${st(`fill: ${col}`)}/>`;
  if (type === 'TRS' || type === 'TS') {
    return `${relief}<rect x="5" y="-5" width="13" height="10" rx="3" ${st(`fill: ${col}; ${halo}`)}/>
      <rect x="17" y="-2.5" width="10" height="5" ${st(`fill: ${v('silver')}`)}/><path d="M27,-2.5 h2 a2.5,2.5 0 0 1 0,5 h-2 z" ${st(`fill: ${v('silver')}`)}/>
      <rect x="25.6" y="-2.5" width=".9" height="5" ${st(`fill: ${v('metal-dark')}`)}/>${type === 'TRS' ? `<rect x="22" y="-2.5" width=".9" height="5" ${st(`fill: ${v('metal-dark')}`)}/>` : ''}`;
  }
  if (type === 'XLR') {
    return `${relief}<rect x="5" y="-7" width="17" height="14" rx="3" ${st(`fill: ${col}; ${halo}`)}/>
      <rect x="20" y="-7" width="7" height="14" rx="2" ${st(`fill: ${v('silver')}`)}/>
      <g ${st(`stroke: ${v('silver-dark')}; stroke-width: 1.2; stroke-linecap: round`)}><line x1="27" y1="-3.5" x2="30.5" y2="-3.5"/><line x1="27" y1="0" x2="30.5" y2="0"/><line x1="27" y1="3.5" x2="30.5" y2="3.5"/></g>`;
  }
  if (type === 'Ethernet') {
    return `${relief}<rect x="5" y="-5" width="12" height="10" rx="2" ${st(`fill: ${col}; ${halo}`)}/>
      <rect x="16" y="-4.5" width="13" height="9" rx="1" ${st(`fill: ${v('rj')}; opacity: .9`)}/>${[0, 1, 2, 3, 4].map((i) => `<rect x="25" y="${-3.4 + i * 1.6}" width="3.6" height=".8" ${st(`fill: ${v('gold')}`)}/>`).join('')}`;
  }
  if (type === 'USB') {
    return `${relief}<rect x="5" y="-4.5" width="12" height="9" rx="2" ${st(`fill: ${col}; ${halo}`)}/>
      <rect x="16" y="-3.5" width="12" height="7" rx="1" ${st(`fill: ${v('silver')}`)}/><rect x="19" y="-1.5" width="7" height="3" ${st(`fill: ${v('silver-dark')}`)}/>`;
  }
  return '';
}
