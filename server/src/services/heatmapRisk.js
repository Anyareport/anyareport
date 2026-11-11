const riskRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };

export function scoreHeatmapZones(zones) {
  return zones
    .map((zone) => {
      const critical = zone.severities.Critical || 0;
      const high = zone.severities.High || 0;
      const open = Object.entries(zone.statuses)
        .filter(([status]) => !['resolved', 'endorsed', 'flagged'].includes(status))
        .reduce((total, [, count]) => total + count, 0);

      let riskLevel = 'Low';
      if ((critical >= 2) || (critical >= 1 && open >= 1)) {
        riskLevel = 'Critical';
      } else if (critical >= 1 || high >= 2 || zone.incidents >= 5) {
        riskLevel = 'High';
      } else if (high >= 1 || zone.incidents >= 2) {
        riskLevel = 'Medium';
      }

      const riskReason =
        riskLevel === 'Critical'
          ? critical >= 2
            ? 'at least two critical reports'
            : 'a critical report is still open'
          : riskLevel === 'High'
            ? critical > 0
              ? 'a critical report is recorded'
              : high >= 2
                ? 'at least two high-severity reports'
                : 'at least five reports are recorded'
            : riskLevel === 'Medium'
              ? high > 0
                ? 'at least one high-severity report'
                : 'at least two reports are recorded'
              : 'there are no critical or high-severity reports and fewer than two reports';
      const rationale = `${riskLevel} because ${riskReason}. ${zone.incidents} report${zone.incidents === 1 ? '' : 's'} recorded; ${critical} critical, ${high} high-severity, and ${open} still open.`;
      const fallbackRecommendation = {
        Critical:
          'Review open urgent reports now and coordinate with the assigned responders. Recheck the area as conditions change.',
        High: 'Review high-severity and open reports soon. Coordinate follow-up with the responsible responders.',
        Medium:
          'Monitor new reports and review whether recurring incident types need a local response.',
        Low: 'Continue routine monitoring and review again if new reports increase.',
      }[riskLevel];

      return {
        ...zone,
        riskLevel,
        rationale,
        recommendation: fallbackRecommendation,
      };
    })
    .sort(
      (left, right) =>
        riskRank[right.riskLevel] - riskRank[left.riskLevel] ||
        right.incidents - left.incidents ||
        left.purok.localeCompare(right.purok, undefined, { numeric: true })
    );
}
