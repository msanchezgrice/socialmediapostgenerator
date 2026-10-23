function calendarDateInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Match the durable reservation ledger's UTC day boundary. */
export function isDailyRadarScanDue(lastScannedAt, now = new Date()) {
  if (!lastScannedAt) return true;
  const lastScan = new Date(lastScannedAt);
  return calendarDateInTimeZone(lastScan, "UTC") !== calendarDateInTimeZone(now, "UTC");
}

export function cachedProjectsForDailyDigest(projects, now = new Date()) {
  return projects
    .filter((project) => project.last_scanned_at
      && project.analysis_summary
      && !isDailyRadarScanDue(project.last_scanned_at, now))
    .map((project) => ({
      projectId: project.id,
      profileId: project.profile_id,
      name: project.name,
      domain: project.domain,
      analysisSummary: project.analysis_summary,
      topSignalTitle: null,
      topSignalUrl: null,
      leadProposalHeadline: null,
      leadProposalX: null,
    }));
}

export { calendarDateInTimeZone };
