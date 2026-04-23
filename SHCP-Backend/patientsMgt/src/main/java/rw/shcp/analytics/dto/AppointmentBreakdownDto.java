package rw.shcp.analytics.dto;

/**
 * Appointment counts grouped by status.
 * Used inside both PlatformStatsDto and ProviderStatsDto.
 */
public record AppointmentBreakdownDto(
        long pending,
        long confirmed,
        long inProgress,
        long completed,
        long cancelled,
        long noShow,
        long total
) {
    public static AppointmentBreakdownDto of(
            long pending, long confirmed, long inProgress,
            long completed, long cancelled, long noShow) {
        return new AppointmentBreakdownDto(
                pending, confirmed, inProgress, completed, cancelled, noShow,
                pending + confirmed + inProgress + completed + cancelled + noShow);
    }
}
