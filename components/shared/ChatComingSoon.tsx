import { MessageCircle } from './Icons';
import { ComingSoon } from './ComingSoon';

/**
 * What the Chat tab shows someone who can't use chat yet. During the soft
 * launch (lib/access → CHAT_OPEN_TO_MEMBERS) that's every member, so the tab
 * holds its place in the nav while leaders test.
 */
export function ChatComingSoon() {
  return (
    <ComingSoon
      title="Chat"
      icon={MessageCircle}
      headline="Team chat is on its way."
      body="We’re bringing the conversation into the Hub so everything lives in one place."
    />
  );
}
