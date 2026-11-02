import { ComingSoon } from '@/components/shared/ComingSoon';
import { Crossover } from '@/components/shared/Icons';

export default function MemberCrossoverPage() {
  return (
    <ComingSoon
      title="Crossover"
      icon={Crossover}
      headline="Crossover is on its way."
      body="Something new is coming to the Hub. Stay tuned."
    />
  );
}
