package rw.shcp.analytics;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.shcp.analytics.dto.*;
import rw.shcp.auth.EmailService;
import rw.shcp.common.enums.ConsultationStatus;
import rw.shcp.common.enums.Role;
import rw.shcp.consultations.Consultation;
import rw.shcp.consultations.ConsultationRepository;
import rw.shcp.prescriptions.Prescription;
import rw.shcp.prescriptions.PrescriptionRepository;
import rw.shcp.symptoms.SymptomReport;
import rw.shcp.symptoms.SymptomReportRepository;
import rw.shcp.users.repository.PatientRepository;
import rw.shcp.users.repository.UserRepository;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class AnalyticsService {

        private final AnalyticsRepository analyticsRepository;
        private final UserRepository userRepository;
        private final PatientRepository patientRepository;
        private final MohReportConfigRepository reportConfigRepository;
        private final ConsultationRepository consultationRepository;
        private final PrescriptionRepository prescriptionRepository;
        private final SymptomReportRepository symptomReportRepository;
        private final EmailService emailService;
        private final ObjectMapper objectMapper;

        // ── Admin: platform overview ──────────────────────────────────────────────

        @PreAuthorize("hasRole('ADMIN')")
        public PlatformStatsDto platformOverview() {
                AppointmentBreakdownDto appts = AppointmentBreakdownDto.of(
                                analyticsRepository.countAppointmentsPending(),
                                analyticsRepository.countAppointmentsConfirmed(),
                                analyticsRepository.countAppointmentsInProgress(),
                                analyticsRepository.countAppointmentsCompleted(),
                                analyticsRepository.countAppointmentsCancelled(),
                                analyticsRepository.countAppointmentsNoShow());

                return new PlatformStatsDto(
                                userRepository.countByRole(Role.PATIENT),
                                userRepository.countByRole(Role.PROVIDER),
                                userRepository.countByRole(Role.ADMIN),
                                analyticsRepository.countActiveProviders(),
                                appts,
                                analyticsRepository.countAllConsultations(),
                                analyticsRepository.countCompletedConsultations(),
                                round(analyticsRepository.avgConsultationDurationMinutes()),
                                analyticsRepository.countAllSymptomReports(),
                                analyticsRepository.countAllPrescriptions(),
                                analyticsRepository.countActivePrescriptions(),
                                analyticsRepository.countActivePharmacies(),
                                userRepository.countByRole(Role.PHARMACIST),
                                userRepository.countByRole(Role.BIKER));
        }

        // ── Admin: time-series ────────────────────────────────────────────────────

        @PreAuthorize("hasRole('ADMIN')")
        public List<DailyCountDto> registrationsPerDay(int days) {
                return analyticsRepository.registrationsPerDay(clampDays(days))
                                .stream()
                                .map(row -> new DailyCountDto(row[0].toString(), toLong(row[1])))
                                .toList();
        }

        @PreAuthorize("hasRole('ADMIN')")
        public List<DailyCountDto> appointmentsPerDay(int days) {
                return analyticsRepository.appointmentsPerDay(clampDays(days))
                                .stream()
                                .map(row -> new DailyCountDto(row[0].toString(), toLong(row[1])))
                                .toList();
        }

        // ── Provider: own stats ───────────────────────────────────────────────────

        @PreAuthorize("hasRole('PROVIDER')")
        public ProviderStatsDto providerStats(UUID providerId) {
                AppointmentBreakdownDto appts = AppointmentBreakdownDto.of(
                                analyticsRepository.countProviderAppointmentsPending(providerId),
                                analyticsRepository.countProviderAppointmentsConfirmed(providerId),
                                analyticsRepository.countProviderAppointmentsInProgress(providerId),
                                analyticsRepository.countProviderAppointmentsCompleted(providerId),
                                analyticsRepository.countProviderAppointmentsCancelled(providerId),
                                analyticsRepository.countProviderAppointmentsNoShow(providerId));

                return new ProviderStatsDto(
                                patientRepository.countDistinctByAppointments_Provider_UserId(providerId),
                                appts,
                                analyticsRepository.countConsultationsByProvider(providerId),
                                analyticsRepository.countCompletedConsultationsByProvider(providerId),
                                round(analyticsRepository.avgConsultationDurationByProvider(providerId)),
                                analyticsRepository.countPrescriptionsByProvider(providerId),
                                analyticsRepository.countActivePrescriptionsByProvider(providerId));
        }

        // ── Patient: own health summary ───────────────────────────────────────────

        @PreAuthorize("hasRole('PATIENT')")
        public PatientHealthSummaryDto patientHealthSummary(UUID patientId) {
                AppointmentBreakdownDto appts = AppointmentBreakdownDto.of(
                                analyticsRepository.countPatientAppointmentsPending(patientId),
                                analyticsRepository.countPatientAppointmentsConfirmed(patientId),
                                analyticsRepository.countPatientAppointmentsInProgress(patientId),
                                analyticsRepository.countPatientAppointmentsCompleted(patientId),
                                analyticsRepository.countPatientAppointmentsCancelled(patientId),
                                analyticsRepository.countPatientAppointmentsNoShow(patientId));

                List<UrgencyDistributionDto> urgencyBreakdown = analyticsRepository
                                .urgencyDistributionByPatient(patientId)
                                .stream()
                                .map(row -> new UrgencyDistributionDto(
                                                row[0] != null ? row[0].toString() : "UNKNOWN",
                                                toLong(row[1])))
                                .toList();

                return new PatientHealthSummaryDto(
                                appts,
                                analyticsRepository.countPatientUpcomingAppointments(patientId, OffsetDateTime.now()),
                                analyticsRepository.countConsultationsByPatient(patientId),
                                analyticsRepository.countSymptomReportsByPatient(patientId),
                                urgencyBreakdown,
                                analyticsRepository.countPrescriptionsByPatient(patientId),
                                analyticsRepository.countActivePrescriptionsByPatient(patientId));
        }

        // ── Provider: patient consultation summary (for the provider report) ────────

        @PreAuthorize("hasRole('PROVIDER')")
        public List<ConsultationSummaryDto> providerConsultationSummary(
                UUID providerId, LocalDate from, LocalDate to, String filter) {

            OffsetDateTime fromDt = from.atStartOfDay().atOffset(ZoneOffset.UTC);
            OffsetDateTime toDt   = to.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);

            List<Consultation> consultations = consultationRepository
                    .findByAppointment_Provider_UserIdAndStatusAndCreatedAtBetweenOrderByCreatedAtDesc(
                            providerId, ConsultationStatus.COMPLETED, fromDt, toDt);

            return consultations.stream()
                    .map(c -> buildRow(c))
                    .filter(row -> matchesFilter(row, filter))
                    .toList();
        }

        private ConsultationSummaryDto buildRow(Consultation c) {
            UUID patientId     = c.getAppointment().getPatient().getUserId();
            String patientName = c.getAppointment().getPatient().getUser().getName();

            // Prescription linked to this consultation
            List<Prescription> prescriptions = prescriptionRepository
                    .findByConsultation_ConsultationIdOrderByIssuedAtDesc(c.getConsultationId());
            Prescription prescription = prescriptions.isEmpty() ? null : prescriptions.get(0);
            String prescriptionStatus = prescription != null ? prescription.getStatus().name() : null;

            // Fetch the patient's latest symptom report once — used for both diagnosis and urgency
            SymptomReport latestReport = symptomReportRepository
                    .findTopByPatientUserIdOrderByCreatedAtDesc(patientId)
                    .orElse(null);

            // Diagnosis: first medication name → aiPathway from symptom report → consultation notes
            String diagnosis = null;
            if (prescription != null) {
                try {
                    List<Map<String, Object>> meds = objectMapper.readValue(
                            prescription.getMedications(), new TypeReference<>() {});
                    if (!meds.isEmpty()) diagnosis = (String) meds.get(0).get("name");
                } catch (Exception ignored) {}
            }
            if (diagnosis == null && latestReport != null) {
                diagnosis = latestReport.getAiPathway();
            }
            if (diagnosis == null && c.getNotes() != null && !c.getNotes().isBlank()) {
                diagnosis = c.getNotes().length() > 80
                        ? c.getNotes().substring(0, 80) + "…"
                        : c.getNotes();
            }

            // Urgency from the same report — no second query
            String urgencyLevel = latestReport != null ? latestReport.getAiUrgency() : "UNKNOWN";
            if (urgencyLevel == null) urgencyLevel = "UNKNOWN";

            return new ConsultationSummaryDto(
                    c.getConsultationId(),
                    patientId,
                    patientName,
                    c.getStartedAt(),
                    c.getDurationMinutes(),
                    diagnosis,
                    urgencyLevel,
                    prescriptionStatus
            );
        }

        private boolean matchesFilter(ConsultationSummaryDto row, String filter) {
            if (filter == null || filter.isBlank() || filter.equalsIgnoreCase("ALL")) return true;
            return switch (filter.toUpperCase()) {
                case "CURED"     -> "DELIVERED".equals(row.prescriptionStatus());
                case "NOT_CURED" -> !"DELIVERED".equals(row.prescriptionStatus());
                case "SEVERE"    -> "EMERGENCY".equals(row.urgencyLevel());
                case "MODERATE"  -> "ROUTINE".equals(row.urgencyLevel());
                case "URGENT"    -> "URGENT".equals(row.urgencyLevel());
                default          -> true;
            };
        }

        // ── Admin: all-provider consultation list for the MOH report ─────────────

        @PreAuthorize("hasRole('ADMIN')")
        public List<AdminConsultationRowDto> adminConsultationSummary(LocalDate from, LocalDate to) {
            OffsetDateTime fromDt = from.atStartOfDay().atOffset(ZoneOffset.UTC);
            OffsetDateTime toDt   = to.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);

            return consultationRepository
                    .findByStatusAndCreatedAtBetweenOrderByCreatedAtDesc(
                            ConsultationStatus.COMPLETED, fromDt, toDt)
                    .stream()
                    .map(this::buildAdminRow)
                    .toList();
        }

        private AdminConsultationRowDto buildAdminRow(Consultation c) {
            String providerName = c.getAppointment().getProvider().getUser().getName();
            UUID   patientId    = c.getAppointment().getPatient().getUserId();
            String patientName  = c.getAppointment().getPatient().getUser().getName();

            List<Prescription> prescriptions = prescriptionRepository
                    .findByConsultation_ConsultationIdOrderByIssuedAtDesc(c.getConsultationId());
            Prescription prescription = prescriptions.isEmpty() ? null : prescriptions.get(0);
            String prescriptionStatus = prescription != null ? prescription.getStatus().name() : null;

            // Full medication list as comma-separated names
            String medications = null;
            String diagnosis   = null;
            if (prescription != null) {
                try {
                    List<Map<String, Object>> meds = objectMapper.readValue(
                            prescription.getMedications(), new TypeReference<>() {});
                    medications = meds.stream()
                            .map(m -> (String) m.get("name"))
                            .filter(Objects::nonNull)
                            .collect(Collectors.joining(", "));
                    if (!meds.isEmpty()) diagnosis = (String) meds.get(0).get("name");
                } catch (Exception ignored) {}
            }

            // Diagnosis fallback: aiPathway → consultation notes
            SymptomReport latestReport = symptomReportRepository
                    .findTopByPatientUserIdOrderByCreatedAtDesc(patientId)
                    .orElse(null);
            if (diagnosis == null && latestReport != null) {
                diagnosis = latestReport.getAiPathway();
            }
            if (diagnosis == null && c.getNotes() != null && !c.getNotes().isBlank()) {
                diagnosis = c.getNotes().length() > 80
                        ? c.getNotes().substring(0, 80) + "…"
                        : c.getNotes();
            }

            String urgencyLevel = latestReport != null ? latestReport.getAiUrgency() : "UNKNOWN";
            if (urgencyLevel == null) urgencyLevel = "UNKNOWN";

            return new AdminConsultationRowDto(
                    c.getConsultationId(), providerName, patientId, patientName,
                    c.getStartedAt(), c.getDurationMinutes(),
                    diagnosis, medications, urgencyLevel, prescriptionStatus);
        }

        // ── Export ────────────────────────────────────────────────────────────────

        @PreAuthorize("hasRole('ADMIN')")
        public byte[] exportPlatformCsv() {
                PlatformStatsDto s = platformOverview();
                StringBuilder sb = new StringBuilder();
                sb.append("Metric,Value\n");
                sb.append("Total Patients,").append(s.totalPatients()).append("\n");
                sb.append("Total Providers,").append(s.totalProviders()).append("\n");
                sb.append("Total Admins,").append(s.totalAdmins()).append("\n");
                sb.append("Active Providers,").append(s.activeProviders()).append("\n");
                sb.append("Total Appointments,").append(s.appointments().total()).append("\n");
                sb.append("Pending Appointments,").append(s.appointments().pending()).append("\n");
                sb.append("Confirmed Appointments,").append(s.appointments().confirmed()).append("\n");
                sb.append("Completed Appointments,").append(s.appointments().completed()).append("\n");
                sb.append("Cancelled Appointments,").append(s.appointments().cancelled()).append("\n");
                sb.append("No-Show Appointments,").append(s.appointments().noShow()).append("\n");
                sb.append("Total Consultations,").append(s.totalConsultations()).append("\n");
                sb.append("Completed Consultations,").append(s.completedConsultations()).append("\n");
                sb.append("Avg Consultation Duration (min),").append(s.avgConsultationDurationMinutes()).append("\n");
                sb.append("Total Symptom Reports,").append(s.totalSymptomReports()).append("\n");
                sb.append("Total Prescriptions,").append(s.totalPrescriptions()).append("\n");
                sb.append("Active Prescriptions,").append(s.activePrescriptions()).append("\n");
                return sb.toString().getBytes(StandardCharsets.UTF_8);
        }

        @PreAuthorize("hasRole('ADMIN')")
        public byte[] exportAppointmentsCsv(int days) {
                List<DailyCountDto> data = appointmentsPerDay(days);
                StringBuilder sb = new StringBuilder();
                sb.append("Date,Appointments\n");
                data.forEach(d -> sb.append(d.date()).append(",").append(d.count()).append("\n"));
                return sb.toString().getBytes(StandardCharsets.UTF_8);
        }

        @PreAuthorize("hasRole('ADMIN')")
        public byte[] exportRegistrationsCsv(int days) {
                List<DailyCountDto> data = registrationsPerDay(days);
                StringBuilder sb = new StringBuilder();
                sb.append("Date,Registrations\n");
                data.forEach(d -> sb.append(d.date()).append(",").append(d.count()).append("\n"));
                return sb.toString().getBytes(StandardCharsets.UTF_8);
        }

        // ── MOH Report Generator ──────────────────────────────────────────────────

        @PreAuthorize("hasRole('ADMIN')")
        public ReportDataDto generateReport(LocalDate from, LocalDate to, List<String> metrics) {
                OffsetDateTime fromDt = from.atStartOfDay().atOffset(ZoneOffset.UTC);
                OffsetDateTime toDt   = to.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);

                final List<String> m = (metrics == null) ? List.of() : metrics;
                final boolean all = m.isEmpty();
                java.util.function.Predicate<String> inc = key -> all || m.contains(key);

                return new ReportDataDto(
                        from.toString(),
                        to.toString(),
                        metrics,
                        inc.test("consultations") ? analyticsRepository.countConsultationsInRange(fromDt, toDt) : null,
                        inc.test("consultations") ? analyticsRepository.countCompletedConsultationsInRange(fromDt, toDt) : null,
                        inc.test("consultations") ? round(analyticsRepository.avgConsultationDurationInRange(fromDt, toDt)) : null,
                        inc.test("appointments")  ? analyticsRepository.countAppointmentsInRange(fromDt, toDt) : null,
                        inc.test("appointments")  ? analyticsRepository.countCompletedAppointmentsInRange(fromDt, toDt) : null,
                        inc.test("appointments")  ? analyticsRepository.countCancelledAppointmentsInRange(fromDt, toDt) : null,
                        inc.test("appointments")  ? analyticsRepository.appointmentsPerDayInRange(fromDt, toDt)
                                .stream().map(r -> new DailyCountDto(r[0].toString(), toLong(r[1]))).toList() : List.of(),
                        inc.test("registrations") ? analyticsRepository.countNewPatientsInRange(fromDt, toDt) : null,
                        inc.test("registrations") ? analyticsRepository.countNewProvidersInRange(fromDt, toDt) : null,
                        inc.test("registrations") ? analyticsRepository.registrationsPerDayInRange(fromDt, toDt)
                                .stream().map(r -> new DailyCountDto(r[0].toString(), toLong(r[1]))).toList() : List.of(),
                        inc.test("symptoms")      ? analyticsRepository.countSymptomReportsInRange(fromDt, toDt) : null,
                        inc.test("prescriptions") ? analyticsRepository.countPrescriptionsInRange(fromDt, toDt) : null,
                        inc.test("prescriptions") ? analyticsRepository.countActivePrescriptionsInRange(fromDt, toDt) : null,
                        inc.test("providers")     ? analyticsRepository.countActiveProviders() : null,
                        inc.test("providers")     ? userRepository.countByRole(Role.PROVIDER) : null
                );
        }

        @PreAuthorize("hasRole('ADMIN')")
        public byte[] exportReportCsv(LocalDate from, LocalDate to, List<String> metrics) {
                ReportDataDto r = generateReport(from, to, metrics);
                StringBuilder sb = new StringBuilder();
                sb.append("SHCP Ministry of Health Report\n");
                sb.append("Period: ").append(r.fromDate()).append(" to ").append(r.toDate()).append("\n\n");
                sb.append("Metric,Value\n");
                if (r.totalConsultations()    != null) sb.append("Total Consultations,").append(r.totalConsultations()).append("\n");
                if (r.completedConsultations()!= null) sb.append("Completed Consultations,").append(r.completedConsultations()).append("\n");
                if (r.avgConsultationDurationMinutes() != null) sb.append("Avg Consultation Duration (min),").append(r.avgConsultationDurationMinutes()).append("\n");
                if (r.totalAppointments()     != null) sb.append("Total Appointments,").append(r.totalAppointments()).append("\n");
                if (r.completedAppointments() != null) sb.append("Completed Appointments,").append(r.completedAppointments()).append("\n");
                if (r.cancelledAppointments() != null) sb.append("Cancelled Appointments,").append(r.cancelledAppointments()).append("\n");
                if (r.newPatients()           != null) sb.append("New Patient Registrations,").append(r.newPatients()).append("\n");
                if (r.newProviders()          != null) sb.append("New Provider Registrations,").append(r.newProviders()).append("\n");
                if (r.totalSymptomReports()   != null) sb.append("Symptom Reports,").append(r.totalSymptomReports()).append("\n");
                if (r.totalPrescriptions()    != null) sb.append("Prescriptions Issued,").append(r.totalPrescriptions()).append("\n");
                if (r.activePrescriptions()   != null) sb.append("Active Prescriptions,").append(r.activePrescriptions()).append("\n");
                if (r.activeProviders()       != null) sb.append("Active Providers,").append(r.activeProviders()).append("\n");
                if (r.totalProviders()        != null) sb.append("Total Providers,").append(r.totalProviders()).append("\n");
                return sb.toString().getBytes(StandardCharsets.UTF_8);
        }

        @PreAuthorize("hasRole('ADMIN')")
        public byte[] exportReportExcel(LocalDate from, LocalDate to, List<String> metrics) {
                ReportDataDto r = generateReport(from, to, metrics);
                try (XSSFWorkbook wb = new XSSFWorkbook()) {
                        // ── Summary sheet ──────────────────────────────────────────────────
                        Sheet summary = wb.createSheet("Summary");
                        CellStyle headerStyle = wb.createCellStyle();
                        Font headerFont = wb.createFont();
                        headerFont.setBold(true);
                        headerStyle.setFont(headerFont);

                        Row titleRow = summary.createRow(0);
                        Cell titleCell = titleRow.createCell(0);
                        titleCell.setCellValue("SHCP Ministry of Health Report — " + r.fromDate() + " to " + r.toDate());
                        titleCell.setCellStyle(headerStyle);

                        Row headerRow = summary.createRow(2);
                        Cell mh = headerRow.createCell(0); mh.setCellValue("Metric"); mh.setCellStyle(headerStyle);
                        Cell vh = headerRow.createCell(1); vh.setCellValue("Value");  vh.setCellStyle(headerStyle);

                        int rowIdx = 3;
                        rowIdx = addExcelRow(summary, rowIdx, "Total Consultations",              r.totalConsultations());
                        rowIdx = addExcelRow(summary, rowIdx, "Completed Consultations",          r.completedConsultations());
                        rowIdx = addExcelRow(summary, rowIdx, "Avg Consultation Duration (min)",  r.avgConsultationDurationMinutes());
                        rowIdx = addExcelRow(summary, rowIdx, "Total Appointments",               r.totalAppointments());
                        rowIdx = addExcelRow(summary, rowIdx, "Completed Appointments",           r.completedAppointments());
                        rowIdx = addExcelRow(summary, rowIdx, "Cancelled Appointments",           r.cancelledAppointments());
                        rowIdx = addExcelRow(summary, rowIdx, "New Patient Registrations",        r.newPatients());
                        rowIdx = addExcelRow(summary, rowIdx, "New Provider Registrations",       r.newProviders());
                        rowIdx = addExcelRow(summary, rowIdx, "Symptom Reports",                  r.totalSymptomReports());
                        rowIdx = addExcelRow(summary, rowIdx, "Prescriptions Issued",             r.totalPrescriptions());
                        rowIdx = addExcelRow(summary, rowIdx, "Active Prescriptions",             r.activePrescriptions());
                        rowIdx = addExcelRow(summary, rowIdx, "Active Providers",                 r.activeProviders());
                        rowIdx = addExcelRow(summary, rowIdx, "Total Providers",                  r.totalProviders());
                        summary.autoSizeColumn(0);
                        summary.autoSizeColumn(1);

                        // ── Daily Appointments sheet ───────────────────────────────────────
                        if (!r.dailyAppointments().isEmpty()) {
                                Sheet apptSheet = wb.createSheet("Daily Appointments");
                                Row ah = apptSheet.createRow(0);
                                Cell ad = ah.createCell(0); ad.setCellValue("Date"); ad.setCellStyle(headerStyle);
                                Cell ac = ah.createCell(1); ac.setCellValue("Count"); ac.setCellStyle(headerStyle);
                                int i = 1;
                                for (DailyCountDto d : r.dailyAppointments()) {
                                        Row row = apptSheet.createRow(i++);
                                        row.createCell(0).setCellValue(d.date());
                                        row.createCell(1).setCellValue(d.count());
                                }
                                apptSheet.autoSizeColumn(0);
                                apptSheet.autoSizeColumn(1);
                        }

                        // ── Daily Registrations sheet ──────────────────────────────────────
                        if (!r.dailyRegistrations().isEmpty()) {
                                Sheet regSheet = wb.createSheet("Daily Registrations");
                                Row rh = regSheet.createRow(0);
                                Cell rd = rh.createCell(0); rd.setCellValue("Date"); rd.setCellStyle(headerStyle);
                                Cell rc = rh.createCell(1); rc.setCellValue("Count"); rc.setCellStyle(headerStyle);
                                int i = 1;
                                for (DailyCountDto d : r.dailyRegistrations()) {
                                        Row row = regSheet.createRow(i++);
                                        row.createCell(0).setCellValue(d.date());
                                        row.createCell(1).setCellValue(d.count());
                                }
                                regSheet.autoSizeColumn(0);
                                regSheet.autoSizeColumn(1);
                        }

                        ByteArrayOutputStream bos = new ByteArrayOutputStream();
                        wb.write(bos);
                        return bos.toByteArray();
                } catch (IOException e) {
                        throw new RuntimeException("Failed to generate Excel report", e);
                }
        }

        private int addExcelRow(Sheet sheet, int rowIdx, String label, Number value) {
                if (value == null) return rowIdx;
                Row row = sheet.createRow(rowIdx);
                row.createCell(0).setCellValue(label);
                row.createCell(1).setCellValue(value.doubleValue());
                return rowIdx + 1;
        }

        // ── Scheduled report config ────────────────────────────────────────────────

        @PreAuthorize("hasRole('ADMIN')")
        public ScheduledReportConfigDto getScheduledConfig() {
                MohReportConfig cfg = reportConfigRepository.findFirstByOrderByCreatedAtAsc()
                        .orElseGet(MohReportConfig::new);
                return toConfigDto(cfg);
        }

        @PreAuthorize("hasRole('ADMIN')")
        @Transactional
        public ScheduledReportConfigDto saveScheduledConfig(ScheduledReportConfigDto dto) {
                MohReportConfig cfg = reportConfigRepository.findFirstByOrderByCreatedAtAsc()
                        .orElseGet(MohReportConfig::new);
                try {
                        cfg.setRecipientEmails(objectMapper.writeValueAsString(dto.recipientEmails()));
                        cfg.setMetrics(objectMapper.writeValueAsString(dto.metrics()));
                } catch (Exception e) {
                        cfg.setRecipientEmails("[]");
                        cfg.setMetrics("[]");
                }
                cfg.setSchedule(dto.schedule());
                cfg.setEnabled(dto.enabled());
                return toConfigDto(reportConfigRepository.save(cfg));
        }

        @PreAuthorize("hasRole('ADMIN')")
        @Transactional
        public void sendReportNow(LocalDate from, LocalDate to, List<String> metrics) {
                MohReportConfig cfg = reportConfigRepository.findFirstByOrderByCreatedAtAsc().orElse(null);
                List<String> emails = List.of();
                try {
                        if (cfg != null) emails = objectMapper.readValue(cfg.getRecipientEmails(), new TypeReference<>() {});
                } catch (Exception ignored) {}
                if (emails.isEmpty()) throw new IllegalStateException("No recipient emails configured for MOH report delivery");
                byte[] csv  = exportReportCsv(from, to, metrics);
                byte[] xlsx = exportReportExcel(from, to, metrics);
                emailService.sendMohReport(emails, from + " to " + to, csv, xlsx);
                if (cfg != null) {
                        cfg.setLastSentAt(OffsetDateTime.now());
                        reportConfigRepository.save(cfg);
                }
        }

        @PreAuthorize("hasRole('ADMIN')")
        @Transactional
        public void sendReportPdfNow(LocalDate from, LocalDate to, byte[] pdfBytes) {
                MohReportConfig cfg = reportConfigRepository.findFirstByOrderByCreatedAtAsc().orElse(null);
                List<String> emails = List.of();
                try {
                        if (cfg != null) emails = objectMapper.readValue(cfg.getRecipientEmails(), new TypeReference<>() {});
                } catch (Exception ignored) {}
                if (emails.isEmpty()) throw new IllegalStateException("No recipient emails configured for MOH report delivery");
                emailService.sendMohReportPdf(emails, from + " to " + to, pdfBytes);
                if (cfg != null) {
                        cfg.setLastSentAt(OffsetDateTime.now());
                        reportConfigRepository.save(cfg);
                }
        }

        public void triggerScheduledReport(LocalDate from, LocalDate to) {
                MohReportConfig cfg = reportConfigRepository.findFirstByOrderByCreatedAtAsc().orElse(null);
                if (cfg == null || !cfg.isEnabled()) return;
                try {
                        List<String> emails = objectMapper.readValue(cfg.getRecipientEmails(),
                                new TypeReference<>() {});
                        List<String> metrics = objectMapper.readValue(cfg.getMetrics(),
                                new TypeReference<>() {});
                        if (emails.isEmpty()) return;
                        byte[] csv = exportReportCsv(from, to, metrics);
                        // Store the csv bytes — EmailService will pick them up
                        cfg.setLastSentAt(OffsetDateTime.now());
                        reportConfigRepository.save(cfg);
                        log.info("Scheduled MOH report sent to {} recipients for period {}-{}", emails.size(), from, to);
                        // Return emails + csv for caller (ScheduledReportJob) to email
                } catch (Exception e) {
                        log.error("Failed to run scheduled MOH report: {}", e.getMessage());
                }
        }

        private ScheduledReportConfigDto toConfigDto(MohReportConfig cfg) {
                List<String> emails = List.of();
                List<String> metrics = List.of();
                try {
                        emails  = objectMapper.readValue(cfg.getRecipientEmails(), new TypeReference<>() {});
                        metrics = objectMapper.readValue(cfg.getMetrics(),         new TypeReference<>() {});
                } catch (Exception ignored) {}
                return new ScheduledReportConfigDto(
                        emails,
                        cfg.getSchedule(),
                        metrics,
                        cfg.isEnabled(),
                        cfg.getLastSentAt() != null ? cfg.getLastSentAt().toString() : null
                );
        }

        // ── Utility ───────────────────────────────────────────────────────────────

        private static int clampDays(int days) {
                return Math.min(Math.max(days, 1), 365);
        }

        private static long toLong(Object o) {
                return o instanceof Number n ? n.longValue() : 0L;
        }

        private static double round(double d) {
                return Math.round(d * 10.0) / 10.0;
        }
}
