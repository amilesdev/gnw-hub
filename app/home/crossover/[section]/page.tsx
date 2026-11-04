import { CrossoverSectionPage } from '@/components/crossover/pages';

export const dynamic = 'force-dynamic';

export default async function MemberCrossoverSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <CrossoverSectionPage base="/home" section={section} />;
}
