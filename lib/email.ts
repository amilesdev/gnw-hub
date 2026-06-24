import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? 'GNW Worship Hub <onboarding@resend.dev>';

const resend = apiKey ? new Resend(apiKey) : null;

export async function sendInviteEmail(opts: {
  to: string;
  name: string;
  inviteUrl: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const { to, name, inviteUrl } = opts;

  if (!resend) {
    // No API key configured (e.g. local dev) — log the link instead of failing.
    console.warn(`[email] RESEND_API_KEY not set. Invite link for ${to}:\n${inviteUrl}`);
    return { ok: true, skipped: true };
  }

  try {
    await resend.emails.send({
      from,
      to,
      subject: 'You’re invited to the GNW Worship Hub',
      html: inviteEmailHtml({ name, inviteUrl }),
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown email error';
    console.error('[email] invite send failed:', message);
    return { ok: false, error: message };
  }
}

function inviteEmailHtml({ name, inviteUrl }: { name: string; inviteUrl: string }): string {
  // Inline styles echo the GNW palette (cream page, sage accent, white card).
  return `
  <div style="background:#FAF7F2;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1C1A22;">
    <div style="max-width:430px;margin:0 auto;background:#FFFFFF;border:1px solid #EAE4DB;border-radius:28px;padding:32px;">
      <div style="font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#96908A;margin-bottom:8px;">GNW Worship Hub</div>
      <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:26px;margin:0 0 16px;color:#1C1A22;">Hey ${escapeHtml(name)} \u{1F44B}</h1>
      <p style="font-size:15px;line-height:1.6;color:#68635C;margin:0 0 24px;">
        You've been invited to join the GNW praise &amp; worship team app. Tap the button below to set your password and get started. This link expires in <strong>48 hours</strong>.
      </p>
      <a href="${inviteUrl}" style="display:inline-block;background:#5E7048;color:#FFFFFF;text-decoration:none;font-weight:600;padding:14px 22px;border-radius:18px;">Claim your invite</a>
      <p style="font-size:13px;line-height:1.6;color:#96908A;margin:24px 0 0;">
        If the button doesn't work, paste this link into your browser:<br />
        <span style="color:#4A5938;word-break:break-all;">${inviteUrl}</span>
      </p>
    </div>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
