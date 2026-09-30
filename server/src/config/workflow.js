const configuredInactivityHours = Number.parseInt(process.env.CAPTAIN_INACTIVITY_HOURS || '4', 10);

export const workflowConfig = {
  captainInactivityHours: Number.isFinite(configuredInactivityHours)
    ? Math.max(1, configuredInactivityHours)
    : 4,
};
