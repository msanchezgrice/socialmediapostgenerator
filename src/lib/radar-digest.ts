import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { RefreshedRadarProject } from "@/lib/radar-store";

type DigestRecipient = {
  id: string;
  email: string | null;
  name: string | null;
};

function trimText(value: string | null | undefined, maxLength: number) {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function subjectForDate(now: Date) {
  return `Social Radar daily highlights for ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(now)}`;
}

function buildDigestHtml(input: { recipientName: string; projects: RefreshedRadarProject[]; appUrl: string }) {
  const items = input.projects
    .slice(0, 8)
    .map((project) => {
      const sourceLink = project.topSignalUrl ? `<p style="margin:8px 0 0;"><a href="${escapeHtml(project.topSignalUrl)}" style="color:#14b8a6;text-decoration:none;">Open source</a></p>` : "";
      return `
        <div style="margin:0 0 18px;padding:18px;border:1px solid #1f2937;border-radius:18px;background:#07121b;">
          <div style="font:600 18px/1.3 Georgia,serif;color:#ffffff;">${escapeHtml(project.name)}</div>
          <div style="margin-top:6px;font:12px/1.5 Arial,sans-serif;color:#94a3b8;">${escapeHtml(project.domain || "No domain")}</div>
          ${project.topSignalTitle ? `<div style="margin-top:12px;font:600 13px/1.5 Arial,sans-serif;color:#5eead4;">Signal: ${escapeHtml(project.topSignalTitle)}</div>` : ""}
          ${project.leadProposalHeadline ? `<div style="margin-top:8px;font:600 14px/1.5 Arial,sans-serif;color:#ffffff;">Post angle: ${escapeHtml(project.leadProposalHeadline)}</div>` : ""}
          <p style="margin:12px 0 0;font:14px/1.7 Arial,sans-serif;color:#cbd5e1;">${escapeHtml(trimText(project.analysisSummary, 240))}</p>
          ${project.leadProposalX ? `<p style="margin:12px 0 0;padding:12px;border-radius:14px;background:#020617;font:13px/1.6 Arial,sans-serif;color:#e2e8f0;">${escapeHtml(trimText(project.leadProposalX, 220))}</p>` : ""}
          ${sourceLink}
        </div>`;
    })
    .join("");

  return `
    <div style="margin:0;padding:32px;background:#03060b;">
      <div style="max-width:760px;margin:0 auto;padding:28px;border:1px solid #17202b;border-radius:28px;background:#08111b;">
        <div style="font:600 11px/1 Arial,sans-serif;letter-spacing:.25em;text-transform:uppercase;color:#5eead4;">Social Radar</div>
        <h1 style="margin:14px 0 0;font:600 34px/1.05 Georgia,serif;color:#ffffff;">Daily highlights for your active companies</h1>
        <p style="margin:14px 0 0;font:14px/1.8 Arial,sans-serif;color:#cbd5e1;">${escapeHtml(input.recipientName)}, ${input.projects.length} project${input.projects.length === 1 ? "" : "s"} refreshed today. Open the dashboard to review signals, edit criteria, and ship posts.</p>
        <p style="margin:18px 0 24px;"><a href="${escapeHtml(input.appUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#14b8a6;color:#041117;font:600 13px/1 Arial,sans-serif;text-decoration:none;">Open dashboard</a></p>
        ${items}
      </div>
    </div>`;
}

function buildDigestText(input: { recipientName: string; projects: RefreshedRadarProject[]; appUrl: string }) {
  return [
    `Social Radar daily highlights for ${input.recipientName}`,
    "",
    `${input.projects.length} active project${input.projects.length === 1 ? "" : "s"} refreshed today.`,
    `Open dashboard: ${input.appUrl}`,
    "",
    ...input.projects.slice(0, 8).flatMap((project) => [
      `${project.name}${project.domain ? ` (${project.domain})` : ""}`,
      project.topSignalTitle ? `Signal: ${project.topSignalTitle}` : "",
      project.leadProposalHeadline ? `Post angle: ${project.leadProposalHeadline}` : "",
      trimText(project.analysisSummary, 240),
      project.leadProposalX ? `Draft X post: ${trimText(project.leadProposalX, 220)}` : "",
      project.topSignalUrl ? `Source: ${project.topSignalUrl}` : "",
      "",
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

async function listRecipients(profileIds: string[]) {
  if (!profileIds.length) return [] as DigestRecipient[];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("profiles").select("id,email,name").in("id", profileIds);
  if (error) throw new Error(`DIGEST_RECIPIENT_QUERY_FAILED:${error.message}`);
  return (data ?? []) as DigestRecipient[];
}

async function sendEmail(args: { to: string; subject: string; html: string; text: string }) {
  const from =
    process.env.RADAR_FROM_EMAIL?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "noreply@nametobiz.com";

  const resendApiKey = process.env.RESEND_API_KEY?.trim() || "";
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${resendApiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [args.to],
          subject: args.subject,
          html: args.html,
          text: args.text,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return {
          sent: false,
          reason: `Resend request failed with ${response.status}${body ? `: ${body}` : ""}`,
        };
      }

      return {
        sent: true,
        reason: null,
      };
    } catch (error) {
      return {
        sent: false,
        reason: error instanceof Error ? error.message : "UNKNOWN",
      };
    }
  }

  const postmarkApiKey = process.env.POSTMARK_API_KEY?.trim() || "";
  if (!postmarkApiKey) {
    return {
      sent: false,
      reason: "RESEND_API_KEY and POSTMARK_API_KEY missing",
    };
  }

  try {
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": postmarkApiKey,
      },
      body: JSON.stringify({
        From: from,
        To: args.to,
        Subject: args.subject,
        HtmlBody: args.html,
        TextBody: args.text,
        MessageStream: "outbound",
      }),
    });

    if (response.ok) {
      return {
        sent: true,
        reason: null,
      };
    }

    const body = await response.text().catch(() => "");
    return {
      sent: false,
      reason: `Postmark request failed with ${response.status}${body ? `: ${body}` : ""}`,
    };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "UNKNOWN",
    };
  }
}

export async function sendRadarDigestEmails(projects: RefreshedRadarProject[]) {
  if (!projects.length) {
    return {
      sentCount: 0,
      attemptedCount: 0,
      skippedCount: 0,
      failures: [] as Array<{ profileId: string; reason: string }>,
    };
  }

  const appUrl = process.env.RADAR_APP_URL?.trim() || "https://socialmediapostgenerator.vercel.app/dashboard";
  const recipients = await listRecipients(Array.from(new Set(projects.map((project) => project.profileId))));
  const recipientMap = new Map(recipients.map((recipient) => [recipient.id, recipient]));
  const grouped = new Map<string, RefreshedRadarProject[]>();

  for (const project of projects) {
    const current = grouped.get(project.profileId) ?? [];
    current.push(project);
    grouped.set(project.profileId, current);
  }

  let sentCount = 0;
  let attemptedCount = 0;
  let skippedCount = 0;
  const failures: Array<{ profileId: string; reason: string }> = [];
  const subject = subjectForDate(new Date());

  for (const [profileId, items] of grouped) {
    const recipient = recipientMap.get(profileId);
    if (!recipient?.email) {
      skippedCount += 1;
      continue;
    }

    attemptedCount += 1;
    const recipientName = recipient.name?.trim() || recipient.email.split("@")[0] || "Operator";
    const html = buildDigestHtml({ recipientName, projects: items, appUrl });
    const text = buildDigestText({ recipientName, projects: items, appUrl });
    const result = await sendEmail({
      to: recipient.email,
      subject,
      html,
      text,
    });

    if (result.sent) {
      sentCount += 1;
    } else {
      failures.push({
        profileId,
        reason: result.reason || "UNKNOWN",
      });
    }
  }

  return {
    sentCount,
    attemptedCount,
    skippedCount,
    failures,
  };
}
