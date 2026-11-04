import { CrossoverSectionPage } from '@/components/crossover/pages';

export const dynamic = 'force-dynamic';

export default async function LeaderCrossoverSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <CrossoverSectionPage base="/dashboard" section={section} />;
}
