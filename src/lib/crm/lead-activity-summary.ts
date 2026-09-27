type Activity = {
  createdAt: Date | string;
  completedAt: Date | string | null;
  dueAt: Date | string | null;
};

// Match listLeads' SQL aggregates regardless of timeline display order.
export function summarizeLeadActivities(activities: Activity[], now: Date) {
  let completedActivities = 0;
  let overdueFollowUps = 0;
  let nextFollowUpAt: Date | null = null;
  let lastActivityAt: Date | null = null;

  for (const activity of activities) {
    const createdAt = new Date(activity.createdAt);
    if (!lastActivityAt || createdAt > lastActivityAt) lastActivityAt = createdAt;
    if (activity.completedAt) {
      completedActivities++;
      continue;
    }
    if (!activity.dueAt) continue;
    const dueAt = new Date(activity.dueAt);
    if (dueAt < now) overdueFollowUps++;
    else if (!nextFollowUpAt || dueAt < nextFollowUpAt) nextFollowUpAt = dueAt;
  }

  return {
    totalActivities: activities.length,
    openFollowUps: activities.length - completedActivities,
    completedActivities,
    overdueFollowUps,
    nextFollowUpAt,
    lastActivityAt,
  };
}
