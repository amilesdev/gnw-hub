import type { StageCable, StageDevice, StageMapData, ZoneId } from './types';

// The hotel setup for Sunday Service, from "GNW Production - Sheet1.csv" and
// the follow-up answers (Docs/). This is the seed: the first time Production
// is opened with no stage map in the database, this document is saved as the
// active Service map (lib/production/server.ts → getActiveStageMap). After that
// the database copy is the source of truth.
//
// Out of scope on purpose: the Wing, its link to the stage box and mics 1–3
// (sound team), and the mains/subs (another group).

const devices: StageDevice[] = [
  { id: 'keys1', name: 'Keys 1', model: 'Yamaha Montage 8', zone: 'instruments', power: 'AC adapter', packed: 'Case', where: 'Bottom tier, closest to the player', prop: 'keys' },
  { id: 'keys2', name: 'Keys 2', model: 'Roland Fantom 06', zone: 'instruments', power: 'DC adapter', packed: 'Case', where: 'Top tier, on top of Keys 1', prop: 'keys' },
  { id: 'iface', name: 'Tracks interface', model: 'Red audio interface', zone: 'instruments', power: 'DC adapter', where: 'On the Montage, at the end next to the computer', prop: 'iface' },
  { id: 'laptop', name: 'Computer', model: 'Keys player\'s computer', zone: 'instruments', where: 'Beside the keys, next to the interface', prop: 'laptop', own: true },
  { id: 'guitar', name: 'Guitar', model: 'Player brings their own rig', zone: 'instruments', where: 'Between keys and bass', prop: 'guitar', own: true },
  { id: 'bass', name: 'Bass', model: 'Player brings their own rig', zone: 'instruments', where: 'Between guitar and drums', prop: 'bass', own: true },
  { id: 'drums', name: 'Drums', model: '7 wired mics', zone: 'instruments', packed: 'Case', where: 'Stage right, facing the keys', prop: 'drums' },
  { id: 'di', name: 'DI box', model: 'Behringer 8-channel DI', zone: 'di', power: 'AC adapter', where: 'Behind the guitarist', prop: 'di' },
  { id: 'sb', name: 'Stage box', model: 'Behringer S32', zone: 'stagebox', power: 'AC adapter', where: 'On the table at the far right, by the wall', prop: 'stagebox' },
  { id: 'hub', name: 'P16 hub', model: 'Feeds the four P16s', zone: 'musician_ears', power: 'AC adapter', packed: 'Bag within Bin', where: 'On top of the stage box', prop: 'hub' },
  { id: 'p16k', name: 'Keys P16', model: 'Personal mixer', kind: 'p16', zone: 'musician_ears', packed: 'Bag within Bin', where: 'Just left of the talkback, right beside the keys cables', prop: 'p16k' },
  { id: 'p16g', name: 'Guitar P16', model: 'Personal mixer', kind: 'p16', zone: 'musician_ears', packed: 'Bag within Bin', where: 'Between guitar and bass, next to the Bass P16', prop: 'p16gb' },
  { id: 'p16b', name: 'Bass P16', model: 'Personal mixer', kind: 'p16', zone: 'musician_ears', packed: 'Bag within Bin', where: 'Between guitar and bass, next to the Guitar P16', prop: 'p16gb' },
  { id: 'p16d', name: 'Drums P16', model: 'Personal mixer', kind: 'p16', zone: 'musician_ears', packed: 'Bag within Bin', where: 'Directly to the drummer\'s right', prop: 'p16d' },
  { id: 'txL', name: 'Lead transmitter', model: 'Shure PSM300', kind: 'tx', group: 'lead', zone: 'vocal_ears', power: 'DC adapter', packed: 'Box within Bin', where: 'On top of the DI box', prop: 'tx', gc: 'Group 1 · Ch 1' },
  { id: 'txB', name: 'BGV transmitter', model: 'Shure PSM300', kind: 'tx', group: 'bgv', zone: 'vocal_ears', power: 'DC adapter', packed: 'Box within Bin', where: 'On top of the DI box', prop: 'tx', gc: 'Group 2 · Ch 1' },
  { id: 'txG', name: 'Guest transmitter', model: 'Shure PSM300', kind: 'tx', group: 'guest', zone: 'vocal_ears', power: 'DC adapter', packed: 'Box within Bin', where: 'On top of the DI box', prop: 'tx', gc: 'Group 3 · Ch 1' },
  { id: 'packsL', name: 'Lead packs', model: 'In-ear bodypacks', kind: 'packs', zone: 'vocal_ears', power: 'Batteries', where: 'With the singers', gc: 'Group 1 · Ch 1' },
  { id: 'packsB', name: 'BGV packs', model: 'In-ear bodypacks', kind: 'packs', zone: 'vocal_ears', power: 'Batteries', where: 'With the singers', gc: 'Group 2 · Ch 1' },
  { id: 'packsG', name: 'Guest packs', model: 'In-ear bodypacks', kind: 'packs', zone: 'vocal_ears', power: 'Batteries', where: 'With the singers', gc: 'Group 3 · Ch 1' },
  { id: 'talk', name: 'Talkback mic', model: 'Wired, for the keyboardist / MD', zone: 'mics', where: 'Directly to the keys player\'s left', prop: 'talkback' },
];

const C = (id: string, zone: ZoneId, from: [string, string], to: [string, string], type: StageCable['type'], color: StageCable['color'] = 'black', extra: Partial<StageCable> = {}): StageCable =>
  ({ id, zone, from, to, type, color, ...extra });

const cables: StageCable[] = [
  C('k1l', 'instruments', ['keys1', 'Out L'], ['di', 'In 1'], 'TRS', 'gray'),
  C('k1r', 'instruments', ['keys1', 'Out R'], ['di', 'In 2'], 'TRS', 'red'),
  C('trl', 'instruments', ['iface', 'Monitor 1'], ['di', 'In 3'], 'TRS', 'blue'),
  C('trr', 'instruments', ['iface', 'Monitor 2'], ['di', 'In 4'], 'TRS', 'black'),
  C('gtr', 'instruments', ['guitar', 'Out'], ['di', 'In 5'], 'TS'),
  C('bas', 'instruments', ['bass', 'Out'], ['di', 'In 6'], 'TS'),
  C('k2l', 'instruments', ['keys2', 'Out L'], ['di', 'In 7'], 'TRS'),
  C('k2r', 'instruments', ['keys2', 'Out R'], ['di', 'In 8'], 'TRS'),
  C('usb', 'instruments', ['laptop', 'USB'], ['iface', 'USB'], 'USB', 'black', { noTrace: true }),
];

const drumMics: StageMapData['drumMics'] = [
  { port: 'Kick mic', input: 1, mount: 'stand', label: 'Kick' },
  { port: 'Snare mic', input: 2, mount: 'clip', label: 'Snare' },
  { port: 'High tom mic', input: 3, mount: 'clip', label: 'High Tom' },
  { port: 'Mid tom mic', input: 4, mount: 'clip', label: 'Mid Tom' },
  { port: 'Floor tom mic', input: 5, mount: 'clip', label: 'Floor Tom' },
  { port: 'Overhead L', input: 7, mount: 'stand', label: 'Overhead L' },
  { port: 'Overhead R', input: 8, mount: 'stand', label: 'Overhead R' },
];
for (const m of drumMics) cables.push(C('dr' + m.input, 'instruments', ['drums', m.port], ['sb', 'In ' + m.input], 'XLR', 'black', { label: m.label }));

// DI outputs → stage box inputs (watch the jumps at 6, 7 and 8).
([[1, 11, 'Keys 1 L'], [2, 12, 'Keys 1 R'], [3, 13, 'Tracks L'], [4, 14, 'Tracks R'],
  [5, 15, 'Guitar'], [6, 10, 'Bass'], [7, 31, 'Keys 2 L'], [8, 32, 'Keys 2 R']] as const)
  .forEach(([d, s, label]) => cables.push(C('di' + d, 'di', ['di', 'Out ' + d], ['sb', 'In ' + s], 'XLR', 'black', { label })));

// Wireless receivers, in the order they sit in the stack.
([['m4', 'Mic 4', 24], ['m5', 'Mic 5', 23], ['m6', 'Mic 6', 22], ['m7', 'Mic 7', 21],
  ['i1', 'Interview Mic 1', 25], ['i2', 'Interview Mic 2', 26], ['ap', 'Apostle', 19], ['pa', 'Pastora', 30]] as const)
  .forEach(([k, name, n]) => {
    devices.push({ id: 'mic_' + k, name, model: 'Wireless handheld', kind: 'mic', zone: 'mics', power: 'Batteries', where: 'With whoever is using it' });
    devices.push({ id: 'rx_' + k, name: name + ' receiver', short: name, model: 'Wireless receiver', kind: 'rx', zone: 'mics', power: 'DC adapter', where: 'In the receiver stack on the stage box table', prop: 'rx', pairs: name });
    cables.push(C('w_' + k, 'mics', ['mic_' + k, 'Wireless'], ['rx_' + k, 'Antenna'], 'Wireless'));
    cables.push(C('x_' + k, 'mics', ['rx_' + k, 'Out'], ['sb', 'In ' + n], 'XLR', 'black', { label: name }));
  });
cables.push(C('tb', 'mics', ['talk', 'Out'], ['sb', 'In 17'], 'XLR', 'black', { label: 'Talkback' }));

// Musician ears.
cables.push(C('ultra', 'musician_ears', ['sb', 'Ultranet'], ['hub', 'Ultranet in'], 'Ethernet', 'gray', { label: 'P16 hub' }));
([['p16k', 1, 'Long cable'], ['p16g', 2, ''], ['p16b', 3, ''], ['p16d', 4, '']] as const)
  .forEach(([d, n, note]) => cables.push(C('hub' + n, 'musician_ears', ['hub', 'Port ' + n], [d, 'In'], 'Ethernet', 'black', note ? { note } : {})));

// Vocalist in-ears: a stage-box XLR joined to a ¼″-to-XLR into the transmitter.
([['txL', 'packsL', 1, 'Lead ears'], ['txB', 'packsB', 2, 'BGV ears'], ['txG', 'packsG', 3, 'Guest ears']] as const)
  .forEach(([tx, pk, n, label]) => {
    cables.push(C('ve' + n, 'vocal_ears', ['sb', 'Out ' + n], [tx, 'Input 1 L'], 'XLRP', 'black', { label }));
    cables.push(C('vw' + n, 'vocal_ears', [tx, 'Wireless'], [pk, 'Wireless'], 'Wireless'));
  });

export const HOTEL_SERVICE_MAP: StageMapData = {
  version: 1,
  devices,
  cables,
  drumMics,
  p16Channels: [
    { ch: '1–2', label: 'Drums', span: 2, color: '#E0A75E' },
    { ch: '3', label: 'Guitar', span: 1, color: '#E07B5E' },
    { ch: '4', label: 'Bass', span: 1, color: '#C98BD9' },
    { ch: '5–6', label: 'Keys', span: 2, color: '#6FB3E0' },
    { ch: '7–8', label: 'Tracks', span: 2, color: '#5EC2B0' },
    { ch: '9', label: 'Talkback', span: 1, color: '#B8B8C2' },
    { ch: '10', label: 'Click / Cues', span: 1, color: '#E0D25E' },
    { ch: '11–12', label: 'Lead Vox', span: 2, color: '#E86A8A' },
    { ch: '13–14', label: 'BGV', span: 2, color: '#D98AB8' },
    { ch: '15', label: 'Sound Talkback', span: 1, color: '#9DA3B0' },
    { ch: '16', label: 'Apostle', span: 1, color: '#8FD38A' },
  ],
  steps: {
    instruments: [
      'Set Keys 1 (Montage 8) on the bottom tier and Keys 2 (Fantom 06) on top, keys facing the player. Plug in the Montage\'s AC adapter and the Fantom\'s DC adapter.',
      'Put the red tracks interface on the end of the Montage next to the computer. Plug in its DC adapter and connect the computer by USB.',
      'Connect every keys and tracks cable around the back of the keyboards (the singer side) to the DI box: gray to DI 1, red to DI 2, blue to DI 3, black to DI 4.',
      'Connect Keys 2 the same way to DI 7 (left) and DI 8 (right).',
      'Guitar goes to DI 5 and bass to DI 6. The players handle their own pedalboards.',
      'Drum mics: clips on the snare and the three toms, stands for the kick and both overheads. Connect each to stage box inputs 1–8. Input 6 stays open.',
    ],
    musician_ears: [
      'Set the P16 hub on top of the stage box and plug in its AC power.',
      'Connect the gray ethernet from the stage box\'s Ultranet port to the hub.',
      'Connect ethernet from the hub to each P16: port 1 to keys (the long cable), 2 to guitar, 3 to bass, 4 to drums.',
      'Keys P16 goes just left of the talkback, beside the keys cables. Guitar and bass P16s sit side by side between the two players. Drums P16 goes directly to the drummer\'s right.',
    ],
    vocal_ears: [
      'Set the three PSM300 transmitters on top of the DI box and plug in each DC adapter.',
      'For each one, connect an XLR from the stage box joined to a ¼″-to-XLR cable into the transmitter\'s Input 1 L. Output 1 goes to Lead, 2 to BGV, 3 to Guest.',
      'Check each transmitter\'s group and channel: Lead is Group 1, BGV is Group 2, Guest is Group 3, all on Channel 1. Packs must match their transmitter.',
      'Hand out packs using the list above.',
    ],
    mics: [
      'Set the receiver stack on the stage box table, wall side. Plug in each DC adapter.',
      'Connect an XLR from each receiver to its stage box input.',
      'Put the talkback mic directly to the keys player\'s left and connect it to stage box input 17.',
    ],
    stagebox: [
      'Set up the table at the far right, by the wall. The stage box, P16 hub and receivers all go on it.',
      'Plug in the stage box\'s AC power. Everything else connects to it. Use the panel above to find the right jack. Open jacks are free for extras.',
    ],
    di: [
      'Set the 8-channel DI behind the guitarist and plug in its AC power. The vocalist in-ear transmitters sit on top of it.',
      'Inputs 1–8 come from the instruments. Each output connects to the stage box by XLR.',
      'Watch the jumps: DI 6 (bass) goes to stage box 10, and DI 7–8 (Keys 2) go to 31–32.',
    ],
  },
  notes: {
    mics: 'Mics 1–3 plug straight into the Wing. The sound team handles those.',
    stagebox: 'The Wing and its link to the stage box belong to the sound team.',
    musician_ears: 'The P16s don\'t need their own power.',
  },
};

/** The Service checklist template, grouped by zone. Encounter Night starts as a copy. */
export const SERVICE_TEMPLATE_TASKS: { zone: ZoneId; title: string; notes?: string }[] = [
  { zone: 'stagebox', title: 'Set up the table, stage box and its power', notes: 'Far right by the wall. The P16 hub and receivers go on the same table.' },
  { zone: 'instruments', title: 'Set up the keyboard stand with Keys 1 and Keys 2', notes: 'Plug in the Montage (AC adapter) and the Fantom (DC adapter).' },
  { zone: 'instruments', title: 'Set up the computer and tracks interface', notes: 'Interface on the end of the Montage next to the computer. USB to the computer, DC adapter for power.' },
  { zone: 'instruments', title: 'Connect the keys and tracks cables to the DI box', notes: 'Around the back of the keyboards. Gray to DI 1, red to DI 2, blue to DI 3, black to DI 4, Keys 2 to DI 7 and 8.' },
  { zone: 'instruments', title: 'Set up the drum kit' },
  { zone: 'instruments', title: 'Mic the drums and connect them to stage box 1–8', notes: 'Clips on the snare and toms, stands for the kick and both overheads. Input 6 stays open.' },
  { zone: 'instruments', title: 'Plug guitar into DI 5 and bass into DI 6' },
  { zone: 'di', title: 'Set up the DI box and connect its 8 outputs to the stage box', notes: 'Watch the jumps: DI 6 goes to 10, DI 7 and 8 go to 31 and 32.' },
  { zone: 'mics', title: 'Plug in and set up the receivers', notes: 'On the stage box table, wall side. Each receiver has a DC adapter.' },
  { zone: 'mics', title: 'Connect receivers to stage box', notes: 'An XLR from each receiver to its stage box input: Mic 4–7 to 24–21, Interview 1–2 to 25–26, Apostle to 19, Pastora to 30.' },
  { zone: 'mics', title: 'Set up the talkback mic at the keys (input 17)' },
  { zone: 'mics', title: 'Check batteries in all 8 handhelds' },
  { zone: 'musician_ears', title: 'Set up the P16 hub: gray Ultranet cable and power' },
  { zone: 'musician_ears', title: 'Connect ethernet to the four P16s and place them' },
  { zone: 'vocal_ears', title: 'Set up the 3 transmitters on the DI and connect them to stage box 1–3' },
  { zone: 'vocal_ears', title: 'Check transmitter groups: Lead G1, BGV G2, Guest G3' },
  { zone: 'vocal_ears', title: 'Hand out in-ear packs to the singers' },
];
