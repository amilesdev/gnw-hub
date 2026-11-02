import { MessageCircle } from './Icons';
import { ComingSoon } from './ComingSoon';

/**
 * Placeholder for the Chat tab. Chat will come from the wider organization's
 * existing chat app (an integration, not a chat built here); until then the tab
 * holds its place in the nav.
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
