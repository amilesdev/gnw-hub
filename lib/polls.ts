import { prisma } from '@/lib/prisma';
import { serializePollResults, type PollResultsDTO, type PollVoterDTO } from '@/lib/serialize';

/**
 * Build the results DTO for one poll from a given viewer's perspective —
 * per-choice tallies, distinct turnout, and the viewer's own selections.
 * Returns null if the poll doesn't exist.
 *
 * Pass `includeVoters` (leader-only) to also resolve the per-voter breakdown of
 * who picked what. Keep it off for member-facing calls so votes stay anonymous
 * to non-leaders.
 */
export async function getPollResults(
  pollId: string,
  userId: string,
  opts: { includeVoters?: boolean } = {},
): Promise<PollResultsDTO | null> {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { choices: { include: { _count: { select: { votes: true } } } } },
  });
  if (!poll) return null;

  const [allVotes, mine] = await Promise.all([
    prisma.pollVote.findMany({ where: { pollId }, select: { userId: true, choiceId: true } }),
    prisma.pollVote.findMany({ where: { pollId, userId }, select: { choiceId: true } }),
  ]);

  const distinctUserIds = [...new Set(allVotes.map((v) => v.userId))];

  let voters: PollVoterDTO[] | undefined;
  if (opts.includeVoters) {
    // userId isn't a FK to User (removed voters' tallies still stand), so resolve
    // names with a separate query and fall back for anyone since removed.
    const users = await prisma.user.findMany({
      where: { id: { in: distinctUserIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    const choicesByUser = new Map<string, string[]>();
    for (const v of allVotes) {
      const list = choicesByUser.get(v.userId);
      if (list) list.push(v.choiceId);
      else choicesByUser.set(v.userId, [v.choiceId]);
    }
    voters = distinctUserIds
      .map((uid) => ({
        userId: uid,
        name: nameById.get(uid) ?? 'Removed member',
        choiceIds: choicesByUser.get(uid) ?? [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return serializePollResults(poll, {
    totalVoters: distinctUserIds.length,
    myChoiceIds: mine.map((v) => v.choiceId),
    voters,
  });
}
