import type { PollResultsDTO } from '@/lib/serialize';

function cell(value: string): string {
  // Quote if the value contains a comma, quote or newline; double inner quotes.
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** A simple per-choice vote distribution, as CSV text. */
export function pollResultsToCsv(r: PollResultsDTO): string {
  const denom = r.totalVoters || 1;
  const rows: string[][] = [
    ['Question', r.question],
    ['Ended', new Date(r.endsAt).toLocaleString()],
    [],
    ['Choice', 'Votes', 'Percent'],
    ...r.choices.map((c) => [c.text, String(c.votes), `${Math.round((c.votes / denom) * 100)}%`]),
    [],
    ['Total votes', String(r.totalVotes)],
    ['Total voters', String(r.totalVoters)],
  ];
  return rows.map((row) => row.map(cell).join(',')).join('\n');
}

/** A filesystem-safe filename for a poll's results export. */
export function pollCsvFilename(r: PollResultsDTO): string {
  const slug = r.question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'poll';
  return `poll-${slug}.csv`;
}
