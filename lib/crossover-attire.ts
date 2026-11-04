import type { CrossoverSeason, LookStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendPush } from '@/lib/push';
import { canReviewLooks, type Viewer } from '@/lib/access';

// Crossover attire: the season's look (colors, notes, reference photos), and
// each member's submitted look, reviewed by the attire reviewer (Judy). Members
// see their own look plus the approved ones; leaders and the reviewer see all.

export type SeasonAttireDTO = {
  attirePrimary: string | null;
  attirePrimaryHex: string | null;
  attireSecondary: string | null;
  attireSecondaryHex: string | null;
  attireComplement: string | null;
  attireComplementHex: string | null;
  attireNotes: string | null;
  attirePhotos: string[];
};

export type LookDTO = {
  id: string;
  userId: string;
  name: string;
  image: string | null;
  photos: string[];
  note: string | null;
  status: LookStatus;
  reviewNote: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  submittedAt: string;
};

export function seasonAttire(s: CrossoverSeason): SeasonAttireDTO {
  return {
    attirePrimary: s.attirePrimary,
    attirePrimaryHex: s.attirePrimaryHex,
    attireSecondary: s.attireSecondary,
    attireSecondaryHex: s.attireSecondaryHex,
    attireComplement: s.attireComplement,
    attireComplementHex: s.attireComplementHex,
    attireNotes: s.attireNotes,
    attirePhotos: s.attirePhotos,
  };
}

export const lookInclude = { user: { select: { name: true, image: true } } } as const;
type LookRow = Prisma.CrossoverLookGetPayload<{ include: typeof lookInclude }>;

export function serializeLook(l: LookRow): LookDTO {
  return {
    id: l.id,
    userId: l.userId,
    name: l.user.name,
    image: l.user.image,
    photos: l.photos,
    note: l.note,
    status: l.status,
    reviewNote: l.reviewNote,
    reviewedByName: l.reviewedByName,
    reviewedAt: l.reviewedAt?.toISOString() ?? null,
    submittedAt: l.submittedAt.toISOString(),
  };
}

// Waiting for review first, then sent back, then approved; oldest first within each.
const STATUS_ORDER: Record<LookStatus, number> = { pending: 0, changes_requested: 1, approved: 2 };

/**
 * The viewer's own look plus the looks they may see: every look for a leader or
 * the reviewer, otherwise just the approved ones.
 */
export async function getLooks(
  seasonId: string,
  viewer: Viewer & { id: string },
): Promise<{ mine: LookDTO | null; looks: LookDTO[] }> {
  const seeAll = viewer.role === 'leader' || canReviewLooks(viewer);
  const rows = await prisma.crossoverLook.findMany({
    where: { seasonId, ...(seeAll ? {} : { OR: [{ status: 'approved' }, { userId: viewer.id }] }) },
    include: lookInclude,
    orderBy: { submittedAt: 'asc' },
  });
  const looks = rows.map(serializeLook).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  return { mine: looks.find((l) => l.userId === viewer.id) ?? null, looks };
}

/** Where a push should open for this person: their side of the app. */
const attirePath = (role: Role) => `${role === 'leader' ? '/dashboard' : '/home'}/crossover/attire`;

/** Tell the reviewer(s) a look is waiting. */
export async function notifyReviewers(memberName: string, resubmitted: boolean): Promise<void> {
  const reviewers = await prisma.user.findMany({
    where: { attireReviewer: true, status: 'active' },
    select: { id: true, role: true },
  });
  for (const r of reviewers) {
    await sendPush(
      {
        title: resubmitted ? 'Updated Crossover look' : 'New Crossover look',
        body: `${memberName} ${resubmitted ? 'updated their look' : 'submitted a look'} for review.`,
        url: attirePath(r.role),
        tag: 'crossover-look-review',
      },
      [r.id],
    );
  }
}

/** Tell a member how their look was reviewed. */
export async function notifyMember(userId: string, role: Role, status: LookStatus, reviewerName: string): Promise<void> {
  await sendPush(
    status === 'approved'
      ? { title: 'Your Crossover look is approved', body: `${reviewerName} approved your look. You're all set!`, url: attirePath(role), tag: 'crossover-look' }
      : { title: 'Changes requested on your look', body: `${reviewerName} left a note on your Crossover look.`, url: attirePath(role), tag: 'crossover-look' },
    [userId],
  );
}
