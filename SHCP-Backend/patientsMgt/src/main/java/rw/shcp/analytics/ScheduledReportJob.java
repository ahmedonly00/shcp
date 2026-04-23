package rw.shcp.analytics;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import rw.shcp.auth.EmailService;

import java.time.LocalDate;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class ScheduledReportJob {

    private final MohReportConfigRepository configRepository;
    private final AnalyticsService analyticsService;
    private final EmailService emailService;
    private final ObjectMapper objectMapper;

    /** Every Monday at 06:00 UTC — sends weekly report if enabled & schedule=WEEKLY */
    @Scheduled(cron = "0 0 6 * * MON")
    public void sendWeeklyReport() {
        run("WEEKLY", LocalDate.now().minusWeeks(1), LocalDate.now().minusDays(1));
    }

    /** First of every month at 06:00 UTC — sends monthly report if enabled & schedule=MONTHLY */
    @Scheduled(cron = "0 0 6 1 * *")
    public void sendMonthlyReport() {
        run("MONTHLY", LocalDate.now().minusMonths(1).withDayOfMonth(1),
                LocalDate.now().minusDays(1));
    }

    private void run(String schedule, LocalDate from, LocalDate to) {
        MohReportConfig cfg = configRepository.findFirstByOrderByCreatedAtAsc().orElse(null);
        if (cfg == null || !cfg.isEnabled() || !cfg.getSchedule().equals(schedule)) return;

        List<String> emails;
        List<String> metrics;
        try {
            emails  = objectMapper.readValue(cfg.getRecipientEmails(), new TypeReference<>() {});
            metrics = objectMapper.readValue(cfg.getMetrics(),         new TypeReference<>() {});
        } catch (Exception e) {
            log.error("Failed to parse MOH report config: {}", e.getMessage());
            return;
        }
        if (emails.isEmpty()) {
            log.warn("MOH report is enabled but no recipient emails configured");
            return;
        }

        try {
            byte[] csv  = analyticsService.exportReportCsv(from, to, metrics);
            byte[] xlsx = analyticsService.exportReportExcel(from, to, metrics);
            String period = from + " to " + to;
            emailService.sendMohReport(emails, period, csv, xlsx);
            cfg.setLastSentAt(java.time.OffsetDateTime.now());
            configRepository.save(cfg);
        } catch (Exception e) {
            log.error("Failed to send scheduled MOH report: {}", e.getMessage());
        }
    }
}
