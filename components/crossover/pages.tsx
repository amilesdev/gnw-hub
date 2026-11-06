import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { getCrossoverData } from '@/lib/crossover';
import { crossoverOpenFor, scheduleComesFirst } from '@/lib/crossover-season';
import { toYmd, startOfToday } from '@/lib/dates';
import { prisma } from '@/lib/prisma';
import { parseProgram, parseTimed } from '@/lib/crossover-schedule';
import { Video } from '@/components/shared/Icons';
import { CrossoverSchedule } from './CrossoverSchedule';
import { getSeasonSets } from '@/lib/crossover-sets';
import { totalMinutes } from '@/lib/crossover-season';
import { SongLibrary } from '@/components/leader/SongLibrary';
import { CrossoverHome } from './CrossoverHome';
import { CrossoverCalendar } from './CrossoverCalendar';
import { CrossoverSets } from './CrossoverSets';
import { CrossoverAttire } from './CrossoverAttire';
import { getLooks, seasonAttire } from '@/lib/crossover-attire';
import { canReviewLooks } from '@/lib/access';
import { getSuggestions } from '@/lib/suggestions';
import { SuggestionsScreen } from '@/components/shared/SuggestionsScreen';

// Server bodies for the Crossover routes, shared by /home/crossover/* and
// /dashboard/crossover/* (the route files only pick the base). Each one gates
// on the season: off-season, or before the viewer's open date, it sends them
// back to Home.

type Base = '/home' | '/dashboard';

async function load(base: Base) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!crossoverOpenFor(user.role)) redirect(base);
  const data = await getCrossoverData(user.role);
  if (!data) redirect(base);
  return { user, data, todayYmd: toYmd(startOfToday()) };
}

const LOOK_LABEL = {
  pending: 'waiting on review',
  changes_requested: 'changes requested',
  approved: 'approved',
} as const;

export async function CrossoverHomePage({ base }: { base: Base }) {
  const { user, data, todayYmd } = await load(base);
  const [sets, { mine }, openSuggestions] = await Promise.all([
    getSeasonSets(data.season),
    getLooks(data.season.id, user),
    prisma.songSuggestion.count({ where: { scope: 'crossover', status: 'open' } }),
  ]);
  const songCount = sets.reduce((n, s) => n + s.songs.length, 0);
  const minutes = totalMinutes(sets);

  return (
    <CrossoverHome
      base={base}
      year={data.year}
      events={data.events}
      todayYmd={todayYmd}
      scheduleFirst={scheduleComesFirst()}
      serverNow={Date.now()}
      summaries={{
        sets: `${sets.length} set${sets.length === 1 ? '' : 's'} · ${minutes ? `${minutes} min` : `${songCount} song${songCount === 1 ? '' : 's'}`}`,
        attire: mine ? `Your look: ${LOOK_LABEL[mine.status]}` : 'Submit your look',
        suggestions: openSuggestions ? `${openSuggestions} waiting` : 'Song ideas for Crossover',
        schedule: 'Setup and Program Schedule',
      }}
    />
  );
}

export async function CrossoverSchedulePage({ base }: { base: Base }) {
  const { user, data } = await load(base);
  return (
    <CrossoverSchedule
      base={base}
      year={data.year}
      initial={{
        dayOf: parseTimed(data.season.dayOfSchedule),
        dress: parseTimed(data.season.dressSchedule),
        program: parseProgram(data.season.program),
      }}
      sets={await getSeasonSets(data.season)}
      canManage={base === '/dashboard' && user.role === 'leader'}
    />
  );
}

export async function CrossoverSetsPage({ base }: { base: Base }) {
  const { user, data } = await load(base);
  return (
    <CrossoverSets
      base={base}
      year={data.year}
      initialSets={await getSeasonSets(data.season)}
      canManage={base === '/dashboard' && user.role === 'leader'}
    />
  );
}

export async function CrossoverAttirePage({ base }: { base: Base }) {
  const { user, data } = await load(base);
  const { mine, looks } = await getLooks(data.season.id, user);
  return (
    <CrossoverAttire
      base={base}
      year={data.year}
      userId={user.id}
      initialAttire={seasonAttire(data.season)}
      initialMine={mine}
      initialLooks={looks}
      canManage={base === '/dashboard' && user.role === 'leader'}
      canReview={canReviewLooks(user)}
    />
  );
}

export async function CrossoverSuggestionsPage({ base }: { base: Base }) {
  const { user } = await load(base);
  return (
    <SuggestionsScreen
      scope="crossover"
      canManage={base === '/dashboard' && user.role === 'leader'}
      meId={user.id}
      initialSuggestions={await getSuggestions(user, 'crossover')}
      backHref={`${base}/crossover`}
    />
  );
}

/** The Crossover song list (leaders): its own songs, with import from / copy to the Song Library. */
export async function CrossoverSongsPage() {
  await load('/dashboard');
  return <SongLibrary scope="crossover" />;
}

export async function CrossoverCalendarPage({ base }: { base: Base }) {
  const { user, data, todayYmd } = await load(base);
  return (
    <CrossoverCalendar
      base={base}
      year={data.year}
      events={data.events}
      todayYmd={todayYmd}
      canManage={base === '/dashboard' && user.role === 'leader'}
    />
  );
}

// Sections that land in later updates. Each tile on the Crossover home opens
// one of these until its screen is built.
const SECTIONS = {
  production: {
    title: 'Production',
    icon: Video,
    body: 'The stage map and setup checklist for Dec 30, built on the app-wide Production feature.',
  },
} as const;

export async function CrossoverSectionPage({ base, section }: { base: Base; section: string }) {
  const info = SECTIONS[section as keyof typeof SECTIONS];
  if (!info) notFound();
  const { data } = await load(base);
  const Icon = info.icon;
  const later = section === 'production';

  return (
    <div className="space-y-5 pt-2">
      <ScreenHeader
        back={{ href: `${base}/crossover`, label: 'Crossover' }}
        eyebrow={`Crossover ${data.year}`}
        title={info.title}
        className="mb-0"
      />
      <div className="card grain-block flex flex-col items-center px-6 py-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent-ink">
          <Icon width={28} height={28} />
        </div>
        <span className="chip mt-5 bg-accent/10 text-accent-ink">{later ? 'Coming later' : 'Coming soon'}</span>
        <p className="mt-3 text-sm text-ink-soft">{info.body}</p>
      </div>
    </div>
  );
}
