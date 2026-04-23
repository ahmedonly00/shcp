package rw.shcp.analytics.dto;

import java.util.List;

public record ScheduledReportConfigDto(
        List<String> recipientEmails,
        String schedule,       // "WEEKLY" or "MONTHLY"
        List<String> metrics,
        boolean enabled,
        String lastSentAt      // ISO string or null
) {}
