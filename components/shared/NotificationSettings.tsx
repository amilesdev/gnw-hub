'use client';

import { usePushNotifications } from '@/lib/use-push-notifications';
import { Bell, Check } from './Icons';

/**
 * Profile card to enable/disable Web Push on this device. Handles the platform
 * gates: iOS requires the PWA be installed to the Home Screen before push is
 * even possible, and a user can hard-block notifications in the browser.
 */
export function NotificationSettings() {
  const { status, busy, error, subscribe, unsubscribe } = usePushNotifications();

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-soft">
            <Bell width={18} height={18} />
          </span>
          <div>
            <p className="font-semibold">Notifications</p>
            <p className="text-sm text-ink-faint">{subtitle(status)}</p>
          </div>
        </div>

        {status === 'subscribed' && (
          <button className="btn-ghost" onClick={unsubscribe} disabled={busy} type="button">
            {busy ? '…' : 'Turn off'}
          </button>
        )}
        {status === 'unsubscribed' && (
          <button className="btn-primary" onClick={subscribe} disabled={busy} type="button">
            {busy ? 'Enabling…' : 'Turn on'}
          </button>
        )}
      </div>

      {status === 'subscribed' && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-good">
          <Check width={16} height={16} /> You'll get alerts on this device.
        </p>
      )}

      {status === 'needs-install' && (
        <p className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-soft">
          To get notifications on iPhone or iPad, first add GNW Hub to your Home
          Screen: tap the <strong>Share</strong> button, then{' '}
          <strong>Add to Home Screen</strong>. Open the app from there and you can
          turn notifications on.
        </p>
      )}

      {status === 'denied' && (
        <p className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-soft">
          Notifications are blocked for this app. Re-enable them in your browser or
          device settings, then come back here.
        </p>
      )}

      {status === 'unsupported' && (
        <p className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-soft">
          This browser doesn't support push notifications.
        </p>
      )}

      {error && <p className="mt-3 text-sm font-semibold text-bad">{error}</p>}
    </section>
  );
}

function subtitle(status: ReturnType<typeof usePushNotifications>['status']): string {
  switch (status) {
    case 'subscribed':
      return 'On for this device.';
    case 'unsubscribed':
      return 'Get alerts for announcements and setlists.';
    case 'needs-install':
      return 'Add to Home Screen to enable.';
    case 'denied':
      return 'Blocked in your settings.';
    case 'unsupported':
      return 'Not available on this browser.';
    default:
      return 'Checking…';
  }
}
