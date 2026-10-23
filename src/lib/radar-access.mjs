export function isOwnedRadarProject(project, profileId, projectId) {
  return Boolean(
    project &&
    typeof project.id === "string" &&
    typeof project.profile_id === "string" &&
    project.id === projectId &&
    project.profile_id === profileId,
  );
}
