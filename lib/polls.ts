import { prisma } from '@/lib/prisma';
import { serializePollResults, type PollResultsDTO } from '@/lib/serialize';

/**
 * Build the results DTO for one poll from a given viewer's perspective —
 * per-choice tallies, distinct turnout, and the viewer's own selections.
 * Returns null if the poll doesn't exist.
 */
export async function getPollResults(pollId: string, userId: string): Promise<PollResultsDTO | null> {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { choices: { include: { _count: { select: { votes: true } } } } },
  });
  if (!poll) return null;

  const [voters, mine] = await Promise.all([
    prisma.pollVote.findMany({ where: { pollId }, select: { userId: true }, distinct: ['userId'] }),
    prisma.pollVote.findMany({ where: { pollId, userId }, select: { choiceId: true } }),
  ]);

  return serializePollResults(poll, {
    totalVoters: voters.length,
    myChoiceIds: mine.map((v) => v.choiceId),
  });
}
