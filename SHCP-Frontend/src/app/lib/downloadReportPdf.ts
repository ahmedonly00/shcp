import type { ReportData, DailyCount } from '@/app/api/analytics';
import type { ApiProviderStats, ProviderConsultationRow, AdminConsultationRow, ApiPatientCheckUpSummary, ApiHealthRecordDto, ApiSymptomReport, ApiPlatformStats, SymptomCheck } from '@/app/types';

// ── Brand palette ─────────────────────────────────────────────────────────────
const C = {
  navy:         '#0F2D54',
  primary:      '#1B6CA8',
  primaryLight: '#EBF3FB',
  accent:       '#2196F3',
  teal:         '#0891B2',
  green:        '#16A34A',
  greenLight:   '#DCFCE7',
  orange:       '#EA580C',
  orangeLight:  '#FFF0E6',
  red:          '#DC2626',
  redLight:     '#FEE2E2',
  amber:        '#D97706',
  amberLight:   '#FEF3C7',
  gray900:      '#111827',
  gray700:      '#374151',
  gray500:      '#6B7280',
  gray400:      '#9CA3AF',
  gray300:      '#D1D5DB',
  gray100:      '#F9FAFB',
  white:        '#FFFFFF',
  rowAlt:       '#EFF6FF',
};

type JsPDFDoc = InstanceType<typeof import('jspdf').jsPDF>;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/ivas-logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getLastY(doc: JsPDFDoc): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

// ── Footer with page number ───────────────────────────────────────────────────

function drawPageFooter(
  doc: JsPDFDoc,
  pw: number,
  ph: number,
  margin: number,
  generatedBy: string,
  pageNum: number,
) {
  const footY = ph - 15;

  // Accent stripe
  doc.setFillColor(C.accent);
  doc.rect(0, footY, pw, 1.5, 'F');

  // Footer bar
  doc.setFillColor(C.navy);
  doc.rect(0, footY + 1.5, pw, 13.5, 'F');

  const ts = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor('#A8C8E8');
  doc.text('SHCP · Smart Health Consultation Platform · Rwanda', margin, footY + 7);
  doc.setTextColor('#7AAFD4');
  doc.text('CONFIDENTIAL · Rwanda DPA Compliant', margin, footY + 12);

  doc.setFontSize(6);
  doc.setTextColor('#D9D9D9');
  doc.text(`Generated: ${ts}`, pw / 2, footY + 7, { align: 'center' });
  doc.text(`By: ${generatedBy}`, pw / 2, footY + 12, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(C.white);
  doc.text(`Page ${pageNum}`, pw - margin, footY + 10, { align: 'right' });
}

// ── MOH Report PDF ─────────────────────────────────────────────────────────────

async function buildMohReportDoc(
  data: ReportData,
  generatedBy: string,
  consultations: AdminConsultationRow[],
): Promise<JsPDFDoc> {
  const { jsPDF }     = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const logoDataUrl = await loadLogoDataUrl();
  const doc    = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw     = doc.internal.pageSize.getWidth();
  const ph     = doc.internal.pageSize.getHeight();
  const margin = 20;

  // ── Header ────────────────────────────────────────────────────────────────
  const headerH = 38;
  doc.setFillColor(C.navy);
  doc.rect(0, 0, pw, headerH, 'F');
  doc.setFillColor(C.primary);
  doc.rect(0, headerH, pw, 1.5, 'F');

  const logoW = 30, logoH = 19;
  const logoX = margin - 1;
  const logoY = (headerH - logoH) / 2;
  doc.setFillColor(C.white);
  doc.roundedRect(logoX - 1, logoY - 1, logoW + 2, logoH + 2, 3, 3, 'F');
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH); } catch { /* skip */ }
  }

  const lx = logoX + logoW + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(C.white);
  doc.text('SHCP', lx, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor('#A8C8E8');
  doc.text('Smart Health Consultation Platform', lx, 22);
  doc.setFontSize(6.5);
  doc.setTextColor('#7AAFD4');
  doc.text('Ministry of Health - Rwanda', lx, 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(C.white);
  doc.text('MINISTRY OF HEALTH REPORT', pw - margin, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor('#A8C8E8');
  doc.text('Platform Health Analytics', pw - margin, 22, { align: 'right' });
  doc.setFontSize(6.5);
  doc.setTextColor('#7AAFD4');
  doc.text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }), pw - margin, 29, { align: 'right' });

  let y = headerH + 1.5 + 10;

  // ── Report metadata block ─────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(C.gray700);
  doc.text('Reporting Period:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.gray900);
  doc.text(`${data.fromDate} to ${data.toDate}`, margin + 32, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(C.gray700);
  doc.text('Metrics Included:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.gray900);
  const metricsText = (data.metrics ?? []).length > 0 ? (data.metrics ?? []).join(', ') : 'All available metrics';
  doc.text(metricsText, margin + 32, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(C.gray700);
  doc.text('Generated by:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.gray900);
  doc.text(generatedBy, margin + 32, y);

  // Separator line
  y += 5;
  doc.setDrawColor(C.gray300);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  // ── Summary Metrics table ──────────────────────────────────────────────────
  const summaryRows: [string, string, string][] = (
    [
      data.totalConsultations             != null && ['Consultations',  'Total Consultations',         data.totalConsultations.toLocaleString()],
      data.completedConsultations         != null && ['Consultations',  'Completed Consultations',      data.completedConsultations.toLocaleString()],
      data.avgConsultationDurationMinutes != null && ['Consultations',  'Average Duration (min)',       `${data.avgConsultationDurationMinutes.toFixed(1)} min`],
      data.totalAppointments              != null && ['Appointments',   'Total Appointments',           data.totalAppointments.toLocaleString()],
      data.completedAppointments          != null && ['Appointments',   'Completed Appointments',       data.completedAppointments.toLocaleString()],
      data.cancelledAppointments          != null && ['Appointments',   'Cancelled Appointments',       data.cancelledAppointments.toLocaleString()],
      data.newPatients                    != null && ['Registrations',  'New Patient Registrations',    data.newPatients.toLocaleString()],
      data.newProviders                   != null && ['Registrations',  'New Provider Registrations',   data.newProviders.toLocaleString()],
      data.totalSymptomReports            != null && ['Symptom Reports','Reports Submitted',            data.totalSymptomReports.toLocaleString()],
      data.totalPrescriptions             != null && ['Prescriptions',  'Total Prescriptions Issued',   data.totalPrescriptions.toLocaleString()],
      data.activePrescriptions            != null && ['Prescriptions',  'Active Prescriptions',         data.activePrescriptions.toLocaleString()],
      data.activeProviders                != null && ['Providers',      'Active Healthcare Providers',  data.activeProviders.toLocaleString()],
      data.totalProviders                 != null && ['Providers',      'Total Providers Registered',   data.totalProviders.toLocaleString()],
    ] as Array<[string, string, string] | false>
  ).filter((r): r is [string, string, string] => Boolean(r));

  if (summaryRows.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(C.navy);
    doc.text('SUMMARY METRICS', margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Category', 'Metric', 'Value']],
      body: summaryRows,
      headStyles: {
        fillColor: C.navy,
        textColor: C.white,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: C.gray900,
        cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 },
      },
      alternateRowStyles: { fillColor: C.gray100 },
      columnStyles: {
        0: { cellWidth: 36, fontStyle: 'bold', textColor: C.gray700 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 32, halign: 'right', fontStyle: 'bold', textColor: C.navy },
      },
      tableLineColor: C.gray300,
      tableLineWidth: 0.2,
      theme: 'grid',
    });

    y = getLastY(doc) + 10;
  }

  // ── Daily Appointments ─────────────────────────────────────────────────────
  if ((data.dailyAppointments?.length ?? 0) > 0) {
    doc.addPage(); y = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(C.navy);
    doc.text('DAILY APPOINTMENTS BREAKDOWN', margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Date', 'Number of Appointments']],
      body: data.dailyAppointments.map(d => [d.date, d.count.toLocaleString()]),
      headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 } },
      bodyStyles: { fontSize: 8.5, textColor: C.gray900, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
      alternateRowStyles: { fillColor: C.gray100 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      tableLineColor: C.gray300,
      tableLineWidth: 0.2,
      theme: 'grid',
    });

    y = getLastY(doc) + 10;
  }

  // ── Daily Registrations ────────────────────────────────────────────────────
  if ((data.dailyRegistrations?.length ?? 0) > 0) {
    doc.addPage(); y = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(C.navy);
    doc.text('DAILY REGISTRATIONS BREAKDOWN', margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Date', 'New Users Registered']],
      body: data.dailyRegistrations.map(d => [d.date, d.count.toLocaleString()]),
      headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 } },
      bodyStyles: { fontSize: 8.5, textColor: C.gray900, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
      alternateRowStyles: { fillColor: C.gray100 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      tableLineColor: C.gray300,
      tableLineWidth: 0.2,
      theme: 'grid',
    });
  }

  // ── Provider-Patient Consultation Records (landscape for readable columns) ──
  if (consultations.length > 0) {
    doc.addPage('a4', 'landscape');
    const lMargin = 15;
    let cy = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(C.navy);
    doc.text(`PROVIDER-PATIENT CONSULTATION RECORDS  (${consultations.length} records)`, lMargin, cy);
    cy += 3;

    const urgencyLabel = (level: string | null) => {
      if (!level) return '—';
      const map: Record<string, string> = { EMERGENCY: 'SEVERE', URGENT: 'URGENT', ROUTINE: 'MODERATE', SELF_CARE: 'SELF-CARE', UNKNOWN: 'UNKNOWN' };
      return map[level] ?? level;
    };

    const adminUrgencyBg = (level: string | null) => {
      if (level === 'EMERGENCY') return '#FEE2E2';
      if (level === 'URGENT')    return '#FFEDD5';
      if (level === 'ROUTINE')   return '#FEF9C3';
      if (level === 'SELF_CARE') return '#DCFCE7';
      return '#F3F4F6';
    };
    const adminUrgencyColor = (level: string | null) => {
      if (level === 'EMERGENCY') return '#991B1B';
      if (level === 'URGENT')    return '#9A3412';
      if (level === 'ROUTINE')   return '#854D0E';
      if (level === 'SELF_CARE') return '#166534';
      return '#6B7280';
    };

    autoTable(doc, {
      startY: cy,
      margin: { left: lMargin, right: lMargin },
      head: [['#', 'Provider', 'Patient', 'Diagnosis', 'Medications', 'Urgency', 'Date & Time', 'Duration']],
      body: consultations.map((row, i) => [
        String(i + 1),
        `Dr. ${row.providerName}`,
        row.patientName,
        row.diagnosis ?? '—',
        row.medications ?? 'None prescribed',
        '',
        row.startedAt ? new Date(row.startedAt).toLocaleString('en-RW', { dateStyle: 'short', timeStyle: 'short' }) : '—',
        row.durationMinutes != null ? `${row.durationMinutes} min` : '—',
      ]),
      headStyles: {
        fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8,
        cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      },
      bodyStyles: { fontSize: 8, textColor: C.gray900, cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 } },
      alternateRowStyles: { fillColor: C.gray100 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', cellPadding: { top: 3, bottom: 3, left: 2, right: 2 } },
        1: { cellWidth: 33 },
        2: { cellWidth: 30 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 40 },
        5: { cellWidth: 22, halign: 'center' },
        6: { cellWidth: 30, halign: 'center' },
        7: { cellWidth: 16, halign: 'right' },
      },
      tableLineColor: C.gray300,
      tableLineWidth: 0.2,
      theme: 'grid',
      didDrawCell: (hook) => {
        if (hook.column.index === 5 && hook.section === 'body') {
          const level = consultations[hook.row.index]?.urgencyLevel ?? null;
          doc.setFillColor(adminUrgencyBg(level));
          doc.rect(hook.cell.x + 0.1, hook.cell.y + 0.1, hook.cell.width - 0.2, hook.cell.height - 0.2, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(adminUrgencyColor(level));
          doc.text(
            urgencyLabel(level),
            hook.cell.x + hook.cell.width / 2,
            hook.cell.y + hook.cell.height / 2 + 1.5,
            { align: 'center' },
          );
        }
      },
    });
  }

  // ── Footer on all pages (per-page dimensions handle landscape correctly) ────
  const totalPages = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const fpw = doc.internal.pageSize.getWidth();
    const fph = doc.internal.pageSize.getHeight();
    drawPageFooter(doc, fpw, fph, margin, generatedBy, p);
  }

  return doc;
}

export async function downloadMohReportPdf(
  data: ReportData,
  generatedBy = 'Administrator',
  consultations: AdminConsultationRow[] = [],
): Promise<void> {
  const doc = await buildMohReportDoc(data, generatedBy, consultations);
  doc.save(`SHCP-MOH-Report-${data.fromDate}-to-${data.toDate}.pdf`);
}

export async function generateMohReportPdfBytes(
  data: ReportData,
  generatedBy = 'Administrator',
  consultations: AdminConsultationRow[] = [],
): Promise<Uint8Array> {
  const doc = await buildMohReportDoc(data, generatedBy, consultations);
  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
}

// ── Provider Report PDF ────────────────────────────────────────────────────────

export async function downloadProviderReportPdf(
  stats: ApiProviderStats,
  providerName: string,
  consultations: ProviderConsultationRow[] = [],
  filterLabel = 'ALL',
  from?: string,
  to?: string,
): Promise<void> {
  const { jsPDF }     = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const logoDataUrl = await loadLogoDataUrl();
  const doc    = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw     = doc.internal.pageSize.getWidth();
  const ph     = doc.internal.pageSize.getHeight();
  const margin = 13;

  const periodLabel = from && to ? `${from} to ${to}` : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── Header ────────────────────────────────────────────────────────────────
  const headerH = 38;
  doc.setFillColor(C.navy);
  doc.rect(0, 0, pw, headerH, 'F');
  doc.setFillColor(C.primary);
  doc.rect(0, headerH, pw, 1.5, 'F');

  const logoW = 30, logoH = 19;
  const logoX = margin - 1;
  const logoY = (headerH - logoH) / 2;
  doc.setFillColor(C.white);
  doc.roundedRect(logoX - 1, logoY - 1, logoW + 2, logoH + 2, 3, 3, 'F');
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH); } catch { /* skip */ }
  }

  const lx = logoX + logoW + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(C.white);
  doc.text('SHCP', lx, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor('#A8C8E8');
  doc.text('Smart Health Consultation Platform', lx, 22);
  doc.setFontSize(6.5);
  doc.setTextColor('#7AAFD4');
  doc.text('Ministry of Health - Rwanda', lx, 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(C.white);
  doc.text('PROVIDER PERFORMANCE REPORT', pw - margin, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor('#A8C8E8');
  doc.text('Healthcare Provider Analytics', pw - margin, 22, { align: 'right' });
  doc.setFontSize(6.5);
  doc.setTextColor('#7AAFD4');
  doc.text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }), pw - margin, 29, { align: 'right' });

  let y = headerH + 1.5 + 10;

  // ── Metadata block ────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(C.gray700);
  doc.text('Healthcare Provider:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.gray900);
  doc.text(`Dr. ${providerName}`, margin + 38, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(C.gray700);
  doc.text('Reporting Period:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.gray900);
  doc.text(periodLabel, margin + 38, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(C.gray700);
  doc.text('Filter Applied:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C.gray900);
  doc.text(filterLabel, margin + 38, y);

  // Separator line
  y += 5;
  doc.setDrawColor(C.gray300);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  // ── Performance summary table ──────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(C.navy);
  doc.text('PERFORMANCE SUMMARY', margin, y);
  y += 3;

  const summaryRows: [string, string, string][] = [
    ['Appointments',  'Total Appointments',         (stats.appointments?.total      ?? 0).toLocaleString()],
    ['Appointments',  'Completed Appointments',     (stats.appointments?.completed  ?? 0).toLocaleString()],
    ['Appointments',  'Cancelled Appointments',     (stats.appointments?.cancelled  ?? 0).toLocaleString()],
    ['Appointments',  'No-Show Appointments',       (stats.appointments?.noShow     ?? 0).toLocaleString()],
    ['Consultations', 'Total Consultations',        (stats.totalConsultations       ?? 0).toLocaleString()],
    ['Consultations', 'Completed Consultations',    (stats.completedConsultations   ?? 0).toLocaleString()],
    ['Consultations', 'Average Consultation Duration', `${(stats.avgConsultationDurationMinutes ?? 0).toFixed(1)} min`],
    ['Patients',      'Unique Patients Served',     (stats.uniquePatients           ?? 0).toLocaleString()],
    ['Prescriptions', 'Total Prescriptions Issued', (stats.totalPrescriptionsIssued ?? 0).toLocaleString()],
    ['Prescriptions', 'Currently Active',           (stats.activePrescriptionsIssued ?? 0).toLocaleString()],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Category', 'Metric', 'Value']],
    body: summaryRows,
    headStyles: {
      fillColor: C.navy,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: C.gray900,
      cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 },
    },
    alternateRowStyles: { fillColor: C.gray100 },
    columnStyles: {
      0: { cellWidth: 36, fontStyle: 'bold', textColor: C.gray700 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 32, halign: 'right', fontStyle: 'bold', textColor: C.navy },
    },
    tableLineColor: C.gray300,
    tableLineWidth: 0.2,
    theme: 'grid',
  });

  y = getLastY(doc) + 10;

  // ── Patient consultations table ────────────────────────────────────────────
  if (consultations.length > 0) {
    doc.addPage(); y = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(C.navy);
    doc.text(`PATIENT CONSULTATION RECORDS  (${consultations.length} records)`, margin, y);
    y += 3;

    const urgencyColor = (level: string | null): string => {
      switch (level) {
        case 'EMERGENCY': return C.red;
        case 'URGENT':    return C.orange;
        case 'ROUTINE':   return C.amber;
        case 'SELF_CARE': return C.green;
        default:          return C.gray500;
      }
    };

    const urgencyBg = (level: string | null): string => {
      switch (level) {
        case 'EMERGENCY': return C.redLight;
        case 'URGENT':    return C.orangeLight;
        case 'ROUTINE':   return C.amberLight;
        case 'SELF_CARE': return C.greenLight;
        default:          return C.gray100;
      }
    };

    const urgencyLabel = (level: string | null): string => {
      const map: Record<string, string> = {
        EMERGENCY: 'EMERGENCY', URGENT: 'URGENT',
        ROUTINE: 'ROUTINE', SELF_CARE: 'SELF-CARE', UNKNOWN: 'UNKNOWN',
      };
      return level ? (map[level] ?? level) : '—';
    };

    const statusLabel = (row: ProviderConsultationRow): string => {
      if (row.urgencyLevel === 'EMERGENCY') return 'Severe';
      if (row.urgencyLevel === 'URGENT')    return 'Urgent';
      if (row.urgencyLevel === 'ROUTINE')   return 'Moderate';
      if (row.prescriptionStatus === 'DELIVERED') return 'Cured';
      return 'Not Cured';
    };
    const statusBg = (row: ProviderConsultationRow): string => {
      if (row.urgencyLevel === 'EMERGENCY') return C.redLight;
      if (row.urgencyLevel === 'URGENT')    return C.orangeLight;
      if (row.urgencyLevel === 'ROUTINE')   return C.amberLight;
      if (row.prescriptionStatus === 'DELIVERED') return C.greenLight;
      return C.gray100;
    };
    const statusColor = (row: ProviderConsultationRow): string => {
      if (row.urgencyLevel === 'EMERGENCY') return C.red;
      if (row.urgencyLevel === 'URGENT')    return C.orange;
      if (row.urgencyLevel === 'ROUTINE')   return C.amber;
      if (row.prescriptionStatus === 'DELIVERED') return C.green;
      return C.gray500;
    };

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Patient Name', 'Diagnosis / Condition', 'Status', 'Urgency', 'Prescription', 'Date & Time', 'Duration']],
      body: consultations.map((row, i) => [
        String(i + 1),
        row.patientName ?? '—',
        row.diagnosis   ?? '—',
        '',   // Status — rendered by didDrawCell
        '',   // Urgency — rendered by didDrawCell
        '',   // Prescription — rendered by didDrawCell
        row.startedAt
          ? new Date(row.startedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '—',
        row.durationMinutes != null ? `${row.durationMinutes} min` : '—',
      ]),
      headStyles: {
        fillColor: C.navy,
        textColor: C.white,
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: C.gray900,
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      },
      alternateRowStyles: { fillColor: C.rowAlt },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', textColor: C.gray500, cellPadding: { top: 3, bottom: 3, left: 2, right: 2 } },
        1: { cellWidth: 30, fontStyle: 'bold' },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 18, halign: 'center' },   // Status
        4: { cellWidth: 20, halign: 'center' },   // Urgency
        5: { cellWidth: 20, halign: 'center' },   // Prescription
        6: { cellWidth: 26, halign: 'center' },   // Date & Time
        7: { cellWidth: 14, halign: 'right' },    // Duration
      },
      tableLineColor: C.gray300,
      tableLineWidth: 0.2,
      theme: 'grid',
      didDrawCell: (hook) => {
        // Status badge (Cured / Not Cured / Severe / Urgent / Moderate)
        if (hook.column.index === 3 && hook.section === 'body') {
          const row = consultations[hook.row.index];
          doc.setFillColor(statusBg(row));
          doc.rect(hook.cell.x + 0.1, hook.cell.y + 0.1, hook.cell.width - 0.2, hook.cell.height - 0.2, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(statusColor(row));
          doc.text(
            statusLabel(row),
            hook.cell.x + hook.cell.width / 2,
            hook.cell.y + hook.cell.height / 2 + 1.5,
            { align: 'center' },
          );
        }
        // Urgency badge
        if (hook.column.index === 4 && hook.section === 'body') {
          const level = (consultations[hook.row.index]?.urgencyLevel) ?? null;
          doc.setFillColor(urgencyBg(level));
          doc.rect(hook.cell.x + 0.1, hook.cell.y + 0.1, hook.cell.width - 0.2, hook.cell.height - 0.2, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(urgencyColor(level));
          doc.text(
            urgencyLabel(level),
            hook.cell.x + hook.cell.width / 2,
            hook.cell.y + hook.cell.height / 2 + 1.5,
            { align: 'center' },
          );
        }
        // Prescription status
        if (hook.column.index === 5 && hook.section === 'body') {
          const rx = consultations[hook.row.index]?.prescriptionStatus;
          const col = rx === 'DELIVERED'
            ? C.green
            : (rx === 'CANCELLED' || rx === 'FAILED')
              ? C.red
              : rx
                ? C.primary
                : C.gray400;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(col);
          const label = rx ? rx.replace(/_/g, ' ') : 'None';
          doc.text(label, hook.cell.x + hook.cell.width / 2, hook.cell.y + hook.cell.height / 2 + 1.5, { align: 'center' });
        }
      },
    });
  }

  // ── Footer on all pages ────────────────────────────────────────────────────
  const totalPages = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawPageFooter(doc, pw, ph, margin, `Dr. ${providerName}`, p);
  }

  const dateSlug = new Date().toISOString().split('T')[0];
  doc.save(`SHCP-Provider-Report-${providerName.replace(/\s+/g, '-')}-${dateSlug}.pdf`);
}

// ── Patient Check-Up Report PDF ───────────────────────────────────────────────

export interface CheckUpReportInput {
  patient:          ApiPatientCheckUpSummary;
  ehr:              ApiHealthRecordDto;
  symptomReport?:   ApiSymptomReport | null;
  providerName:     string;
  observations:     string;
  nextSteps:        string;
  reportDate:       string;
}

export async function downloadPatientCheckUpPdf(input: CheckUpReportInput): Promise<void> {
  const { jsPDF }     = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const logoDataUrl = await loadLogoDataUrl();
  const doc    = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw     = doc.internal.pageSize.getWidth();
  const ph     = doc.internal.pageSize.getHeight();
  const margin = 20;

  const { patient, ehr, symptomReport, providerName, observations, nextSteps, reportDate } = input;

  // ── Calculate age from DOB ─────────────────────────────────────────────────
  let age = '';
  if (patient.dateOfBirth) {
    const dob  = new Date(patient.dateOfBirth);
    const now  = new Date();
    const diff = now.getFullYear() - dob.getFullYear();
    const adj  = now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0;
    age = `${diff - adj} years`;
  }

  // ── Header ────────────────────────────────────────────────────────────────
  const headerH = 38;
  doc.setFillColor(C.navy);
  doc.rect(0, 0, pw, headerH, 'F');
  doc.setFillColor(C.primary);
  doc.rect(0, headerH, pw, 1.5, 'F');

  const logoW = 30, logoH = 19;
  const logoX = margin - 1;
  const logoY = (headerH - logoH) / 2;
  doc.setFillColor(C.white);
  doc.roundedRect(logoX - 1, logoY - 1, logoW + 2, logoH + 2, 3, 3, 'F');
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH); } catch { /* skip */ }
  }

  const lx = logoX + logoW + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(C.white);
  doc.text('SHCP', lx, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor('#A8C8E8');
  doc.text('Smart Health Consultation Platform', lx, 22);
  doc.setFontSize(6.5);
  doc.setTextColor('#7AAFD4');
  doc.text('Ministry of Health - Rwanda', lx, 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(C.white);
  doc.text('GENERAL CHECK-UP REPORT', pw - margin, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor('#A8C8E8');
  doc.text('Patient Medical Summary', pw - margin, 22, { align: 'right' });
  doc.setFontSize(6.5);
  doc.setTextColor('#7AAFD4');
  doc.text(reportDate, pw - margin, 29, { align: 'right' });

  let y = headerH + 1.5 + 10;

  // ── Metadata block ────────────────────────────────────────────────────────
  const meta = (label: string, value: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(C.gray700);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.gray900);
    doc.text(value || '—', margin + 38, y);
    y += 6;
  };

  meta('Patient Name:', patient.name);
  meta('Attending Provider:', `Dr. ${providerName}`);
  meta('Report Date:', reportDate);

  y += 1;
  doc.setDrawColor(C.gray300);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  // ── Patient details ────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(C.navy);
  doc.text('PATIENT DETAILS', margin, y);
  y += 3;

  const detailRows: [string, string][] = [
    ['Full Name',         patient.name],
    ['Age',               age || '—'],
    ['Gender',            patient.gender ?? '—'],
    ['Blood Type',        patient.bloodType ?? '—'],
    ['National ID',       patient.nationalId ?? '—'],
    ['Phone',             patient.phone ?? '—'],
    ['Insurance Provider',patient.insuranceProvider ?? '—'],
    ['Insurance Number',  patient.insuranceNumber ?? '—'],
    ['Emergency Contact', patient.emergencyContactName
      ? `${patient.emergencyContactName}  ${patient.emergencyContactPhone ?? ''}`
      : '—'],
  ].filter(r => r[1] !== '—') as [string, string][];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: detailRows,
    bodyStyles: { fontSize: 8.5, textColor: C.gray900, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
    alternateRowStyles: { fillColor: C.gray100 },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: 'bold', textColor: C.gray700 },
      1: { cellWidth: 'auto' },
    },
    tableLineColor: C.gray300,
    tableLineWidth: 0.2,
    theme: 'grid',
  });

  y = getLastY(doc) + 10;

  // ── Medical history ────────────────────────────────────────────────────────
  const parseJson = <T>(val: string, fallback: T): T => {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  };

  const diagnoses    = parseJson<{name?: string; code?: string; description?: string}[]>(ehr.diagnoses,    []);
  const medications  = parseJson<{name?: string; dosage?: string; frequency?: string}[]>(ehr.medications,  []);
  const allergies    = parseJson<{allergen?: string; reaction?: string; severity?: string}[]>(ehr.allergies,    []);
  const vitals       = parseJson<{type?: string; value?: string | number; unit?: string; date?: string}[]>(ehr.vitals, []);

  if (diagnoses.length > 0 || medications.length > 0 || allergies.length > 0) {
    if (y + 40 > ph - 20) { doc.addPage(); y = 20; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(C.navy);
    doc.text('MEDICAL HISTORY', margin, y);
    y += 3;

    // Diagnoses
    if (diagnoses.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Diagnoses', 'ICD Code', 'Notes']],
        body: diagnoses.map(d => [d.name ?? '—', d.code ?? '—', d.description ?? '—']),
        headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 } },
        bodyStyles: { fontSize: 8.5, textColor: C.gray900, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
        alternateRowStyles: { fillColor: C.gray100 },
        columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' }, 1: { cellWidth: 30 }, 2: { cellWidth: 'auto' } },
        tableLineColor: C.gray300,
        tableLineWidth: 0.2,
        theme: 'grid',
      });
      y = getLastY(doc) + 5;
    }

    // Current Medications
    if (medications.length > 0) {
      if (y + 30 > ph - 20) { doc.addPage(); y = 20; }
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Current Medications', 'Dosage', 'Frequency']],
        body: medications.map(m => [m.name ?? '—', m.dosage ?? '—', m.frequency ?? '—']),
        headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 } },
        bodyStyles: { fontSize: 8.5, textColor: C.gray900, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
        alternateRowStyles: { fillColor: C.gray100 },
        columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' }, 1: { cellWidth: 35 }, 2: { cellWidth: 'auto' } },
        tableLineColor: C.gray300,
        tableLineWidth: 0.2,
        theme: 'grid',
      });
      y = getLastY(doc) + 5;
    }

    // Allergies
    if (allergies.length > 0) {
      if (y + 30 > ph - 20) { doc.addPage(); y = 20; }
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Allergies', 'Reaction', 'Severity']],
        body: allergies.map(a => [a.allergen ?? '—', a.reaction ?? '—', a.severity ?? '—']),
        headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 } },
        bodyStyles: { fontSize: 8.5, textColor: C.gray900, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
        alternateRowStyles: { fillColor: C.gray100 },
        columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 35 } },
        tableLineColor: C.gray300,
        tableLineWidth: 0.2,
        theme: 'grid',
      });
      y = getLastY(doc) + 5;
    }

    y += 5;
  }

  // ── Vitals ────────────────────────────────────────────────────────────────
  if (vitals.length > 0) {
    if (y + 30 > ph - 20) { doc.addPage(); y = 20; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(C.navy);
    doc.text('VITAL SIGNS', margin, y);
    y += 3;

    const vitalLabel = (type: string) => {
      const map: Record<string, string> = {
        'blood-pressure': 'Blood Pressure',
        'heart-rate':     'Heart Rate',
        'temperature':    'Body Temperature',
        'oxygen':         'Oxygen Saturation',
        'weight':         'Weight',
        'glucose':        'Blood Glucose',
      };
      return map[type] ?? type;
    };

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Vital Sign', 'Value', 'Unit', 'Recorded On']],
      body: vitals.map(v => [
        vitalLabel(v.type ?? ''),
        String(v.value ?? '—'),
        v.unit ?? '—',
        v.date ? new Date(v.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
      ]),
      headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 } },
      bodyStyles: { fontSize: 8.5, textColor: C.gray900, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
      alternateRowStyles: { fillColor: C.gray100 },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: 'bold' },
        1: { cellWidth: 35, halign: 'right', fontStyle: 'bold', textColor: C.navy },
        2: { cellWidth: 30 },
        3: { cellWidth: 'auto' },
      },
      tableLineColor: C.gray300,
      tableLineWidth: 0.2,
      theme: 'grid',
    });

    y = getLastY(doc) + 10;
  }

  // ── Latest AI Screening ────────────────────────────────────────────────────
  if (symptomReport) {
    if (y + 30 > ph - 20) { doc.addPage(); y = 20; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(C.navy);
    doc.text('LATEST AI SYMPTOM SCREENING', margin, y);
    y += 3;

    const screeningRows: [string, string][] = [
      ['Screening Date',    symptomReport.createdAt ? new Date(symptomReport.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'],
      ['Symptoms Reported', symptomReport.symptomText ?? '—'],
      ['AI Assessment',     symptomReport.aiDisease ?? symptomReport.aiPathway ?? '—'],
      ['Urgency Level',     symptomReport.aiUrgency ?? '—'],
      ['Confidence',        symptomReport.aiConfidence ? `${symptomReport.aiConfidence}%` : '—'],
      ['Care Recommendation', symptomReport.careRecommendation ?? '—'],
    ].filter(r => r[1] !== '—') as [string, string][];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: screeningRows,
      bodyStyles: { fontSize: 8.5, textColor: C.gray900, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
      alternateRowStyles: { fillColor: C.gray100 },
      columnStyles: {
        0: { cellWidth: 52, fontStyle: 'bold', textColor: C.gray700 },
        1: { cellWidth: 'auto' },
      },
      tableLineColor: C.gray300,
      tableLineWidth: 0.2,
      theme: 'grid',
    });

    y = getLastY(doc) + 10;
  }

  // ── Doctor's Observations ──────────────────────────────────────────────────
  if (observations.trim()) {
    if (y + 30 > ph - 20) { doc.addPage(); y = 20; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(C.navy);
    doc.text("DOCTOR'S OBSERVATIONS", margin, y);
    y += 3;

    const obsLines = doc.splitTextToSize(observations, pw - 2 * margin - 10);
    doc.setFillColor(C.gray100);
    const obsH = obsLines.length * 5 + 8;
    doc.rect(margin, y, pw - 2 * margin, obsH, 'F');
    doc.setDrawColor(C.gray300);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, pw - 2 * margin, obsH, 'S');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(C.gray900);
    doc.text(obsLines, margin + 5, y + 6);
    y += obsH + 10;
  }

  // ── Notes and Next Steps ───────────────────────────────────────────────────
  if (nextSteps.trim()) {
    if (y + 30 > ph - 20) { doc.addPage(); y = 20; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(C.navy);
    doc.text('NOTES AND NEXT STEPS', margin, y);
    y += 3;

    const nsLines = doc.splitTextToSize(nextSteps, pw - 2 * margin - 10);
    doc.setFillColor(C.gray100);
    const nsH = nsLines.length * 5 + 8;
    doc.rect(margin, y, pw - 2 * margin, nsH, 'F');
    doc.setDrawColor(C.gray300);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, pw - 2 * margin, nsH, 'S');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(C.gray900);
    doc.text(nsLines, margin + 5, y + 6);
    y += nsH + 10;
  }

  // ── Provider signature line ────────────────────────────────────────────────
  const sigY = Math.min(y + 5, ph - 35);
  doc.setDrawColor(C.gray500);
  doc.setLineWidth(0.3);
  doc.line(margin, sigY, margin + 70, sigY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(C.gray700);
  doc.text(`Dr. ${providerName}`, margin, sigY + 5);
  doc.text('Attending Healthcare Provider', margin, sigY + 10);
  doc.text(`Date: ${reportDate}`, margin, sigY + 15);

  // ── Footer on all pages ────────────────────────────────────────────────────
  const totalPages = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawPageFooter(doc, pw, ph, margin, `Dr. ${providerName}`, p);
  }

  const safe = patient.name.replace(/\s+/g, '-');
  const dateSlug = new Date().toISOString().split('T')[0];
  doc.save(`SHCP-CheckUp-${safe}-${dateSlug}.pdf`);
}

// ── Platform Stats PDF ────────────────────────────────────────────────────────

export async function downloadPlatformStatsPdf(
  stats: ApiPlatformStats,
  generatedBy = 'Administrator',
): Promise<void> {
  const { jsPDF }     = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');
  const logoDataUrl   = await loadLogoDataUrl();

  const doc    = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw     = doc.internal.pageSize.getWidth();
  const ph     = doc.internal.pageSize.getHeight();
  const margin = 20;

  // Header
  const headerH = 38;
  doc.setFillColor(C.navy); doc.rect(0, 0, pw, headerH, 'F');
  doc.setFillColor(C.primary); doc.rect(0, headerH, pw, 1.5, 'F');
  const logoW = 30, logoH = 19; const logoX = margin - 1; const logoY = (headerH - logoH) / 2;
  doc.setFillColor(C.white); doc.roundedRect(logoX - 1, logoY - 1, logoW + 2, logoH + 2, 3, 3, 'F');
  if (logoDataUrl) { try { doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH); } catch { /* skip */ } }
  const lx = logoX + logoW + 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(C.white); doc.text('SHCP', lx, 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor('#A8C8E8'); doc.text('Smart Health Consultation Platform', lx, 22);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(C.white); doc.text('PLATFORM STATISTICS', pw - margin, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor('#7AAFD4'); doc.text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }), pw - margin, 29, { align: 'right' });

  let y = headerH + 1.5 + 10;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(C.gray700); doc.text('Generated by:', margin, y);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(C.gray900); doc.text(generatedBy, margin + 32, y);
  y += 5; doc.setDrawColor(C.gray300); doc.setLineWidth(0.4); doc.line(margin, y, pw - margin, y); y += 8;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(C.navy); doc.text('PLATFORM OVERVIEW', margin, y); y += 3;

  const totalUsers = (stats.totalPatients ?? 0) + (stats.totalProviders ?? 0) + (stats.totalAdmins ?? 0);
  const rows: [string, string, string][] = [
    ['Users',         'Total Registered Users',        totalUsers.toLocaleString()],
    ['Users',         'Patients',                      (stats.totalPatients ?? 0).toLocaleString()],
    ['Users',         'Healthcare Providers',           (stats.totalProviders ?? 0).toLocaleString()],
    ['Users',         'Administrators',                 (stats.totalAdmins ?? 0).toLocaleString()],
    ['Users',         'Active Providers',               (stats.activeProviders ?? 0).toLocaleString()],
    ['Appointments',  'Total Appointments',             (stats.appointments?.total ?? 0).toLocaleString()],
    ['Appointments',  'Completed',                      (stats.appointments?.completed ?? 0).toLocaleString()],
    ['Appointments',  'Pending',                        (stats.appointments?.pending ?? 0).toLocaleString()],
    ['Appointments',  'Confirmed',                      (stats.appointments?.confirmed ?? 0).toLocaleString()],
    ['Appointments',  'Cancelled',                      (stats.appointments?.cancelled ?? 0).toLocaleString()],
    ['Appointments',  'No-Show',                        (stats.appointments?.noShow ?? 0).toLocaleString()],
    ['Consultations', 'Total Consultations',            (stats.totalConsultations ?? 0).toLocaleString()],
    ['Consultations', 'Completed Consultations',        (stats.completedConsultations ?? 0).toLocaleString()],
    ['Consultations', 'Avg Duration',                   `${(stats.avgConsultationDurationMinutes ?? 0).toFixed(1)} min`],
    ['Clinical',      'Symptom Reports Submitted',      (stats.totalSymptomReports ?? 0).toLocaleString()],
    ['Clinical',      'Total Prescriptions',            (stats.totalPrescriptions ?? 0).toLocaleString()],
    ['Clinical',      'Active Prescriptions',           (stats.activePrescriptions ?? 0).toLocaleString()],
  ];

  autoTable(doc, {
    startY: y, margin: { left: margin, right: margin },
    head: [['Category', 'Metric', 'Value']],
    body: rows,
    headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 } },
    bodyStyles: { fontSize: 8.5, textColor: C.gray900, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 } },
    alternateRowStyles: { fillColor: C.gray100 },
    columnStyles: { 0: { cellWidth: 36, fontStyle: 'bold', textColor: C.gray700 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 32, halign: 'right', fontStyle: 'bold', textColor: C.navy } },
    tableLineColor: C.gray300, tableLineWidth: 0.2, theme: 'grid',
  });

  const totalPages = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) { doc.setPage(p); drawPageFooter(doc, pw, ph, margin, generatedBy, p); }
  doc.save(`SHCP-Platform-Stats-${new Date().toISOString().split('T')[0]}.pdf`);
}

// ── Daily Appointments PDF ────────────────────────────────────────────────────

export async function downloadAppointmentsPdf(
  data: DailyCount[],
  generatedBy = 'Administrator',
): Promise<void> {
  const { jsPDF }     = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');
  const logoDataUrl   = await loadLogoDataUrl();

  const doc    = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw     = doc.internal.pageSize.getWidth();
  const ph     = doc.internal.pageSize.getHeight();
  const margin = 20;

  const headerH = 38;
  doc.setFillColor(C.navy); doc.rect(0, 0, pw, headerH, 'F');
  doc.setFillColor(C.primary); doc.rect(0, headerH, pw, 1.5, 'F');
  const logoW = 30, logoH = 19; const logoX = margin - 1; const logoY = (headerH - logoH) / 2;
  doc.setFillColor(C.white); doc.roundedRect(logoX - 1, logoY - 1, logoW + 2, logoH + 2, 3, 3, 'F');
  if (logoDataUrl) { try { doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH); } catch { /* skip */ } }
  const lx = logoX + logoW + 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(C.white); doc.text('SHCP', lx, 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor('#A8C8E8'); doc.text('Smart Health Consultation Platform', lx, 22);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(C.white); doc.text('APPOINTMENTS REPORT', pw - margin, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor('#7AAFD4'); doc.text('Last 30 days', pw - margin, 22, { align: 'right' });
  doc.text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }), pw - margin, 29, { align: 'right' });

  let y = headerH + 1.5 + 10;
  const total = data.reduce((s, d) => s + d.count, 0);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(C.gray700); doc.text('Total appointments (30 days):', margin, y);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(C.navy); doc.text(total.toLocaleString(), margin + 55, y);
  y += 5; doc.setDrawColor(C.gray300); doc.setLineWidth(0.4); doc.line(margin, y, pw - margin, y); y += 8;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(C.navy); doc.text('DAILY APPOINTMENTS BREAKDOWN', margin, y); y += 3;

  autoTable(doc, {
    startY: y, margin: { left: margin, right: margin },
    head: [['Date', 'Number of Appointments']],
    body: data.map(d => [d.date, d.count.toLocaleString()]),
    headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 } },
    bodyStyles: { fontSize: 8.5, textColor: C.gray900, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 } },
    alternateRowStyles: { fillColor: C.gray100 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold', textColor: C.navy } },
    tableLineColor: C.gray300, tableLineWidth: 0.2, theme: 'grid',
  });

  const totalPages = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) { doc.setPage(p); drawPageFooter(doc, pw, ph, margin, generatedBy, p); }
  doc.save(`SHCP-Appointments-${new Date().toISOString().split('T')[0]}.pdf`);
}

// ── Daily Registrations PDF ───────────────────────────────────────────────────

export async function downloadRegistrationsPdf(
  data: DailyCount[],
  generatedBy = 'Administrator',
): Promise<void> {
  const { jsPDF }     = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');
  const logoDataUrl   = await loadLogoDataUrl();

  const doc    = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw     = doc.internal.pageSize.getWidth();
  const ph     = doc.internal.pageSize.getHeight();
  const margin = 20;

  const headerH = 38;
  doc.setFillColor(C.navy); doc.rect(0, 0, pw, headerH, 'F');
  doc.setFillColor(C.primary); doc.rect(0, headerH, pw, 1.5, 'F');
  const logoW = 30, logoH = 19; const logoX = margin - 1; const logoY = (headerH - logoH) / 2;
  doc.setFillColor(C.white); doc.roundedRect(logoX - 1, logoY - 1, logoW + 2, logoH + 2, 3, 3, 'F');
  if (logoDataUrl) { try { doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH); } catch { /* skip */ } }
  const lx = logoX + logoW + 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(C.white); doc.text('SHCP', lx, 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor('#A8C8E8'); doc.text('Smart Health Consultation Platform', lx, 22);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(C.white); doc.text('REGISTRATIONS REPORT', pw - margin, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor('#7AAFD4'); doc.text('Last 30 days', pw - margin, 22, { align: 'right' });
  doc.text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }), pw - margin, 29, { align: 'right' });

  let y = headerH + 1.5 + 10;
  const total = data.reduce((s, d) => s + d.count, 0);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(C.gray700); doc.text('Total new registrations (30 days):', margin, y);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(C.navy); doc.text(total.toLocaleString(), margin + 60, y);
  y += 5; doc.setDrawColor(C.gray300); doc.setLineWidth(0.4); doc.line(margin, y, pw - margin, y); y += 8;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(C.navy); doc.text('DAILY REGISTRATIONS BREAKDOWN', margin, y); y += 3;

  autoTable(doc, {
    startY: y, margin: { left: margin, right: margin },
    head: [['Date', 'New Users Registered']],
    body: data.map(d => [d.date, d.count.toLocaleString()]),
    headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 } },
    bodyStyles: { fontSize: 8.5, textColor: C.gray900, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 } },
    alternateRowStyles: { fillColor: C.gray100 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold', textColor: C.navy } },
    tableLineColor: C.gray300, tableLineWidth: 0.2, theme: 'grid',
  });

  const totalPages = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) { doc.setPage(p); drawPageFooter(doc, pw, ph, margin, generatedBy, p); }
  doc.save(`SHCP-Registrations-${new Date().toISOString().split('T')[0]}.pdf`);
}

// ── Symptom Checker AI Assessment PDF ────────────────────────────────────────

function formatSymptom(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 80) return 'High';
  if (confidence >= 65) return 'Moderate';
  if (confidence >= 45) return 'Low';
  return 'Very Low';
}

function drawColoredBox(
  doc: JsPDFDoc, pw: number, margin: number, y: number,
  bgColor: string, borderColor: string, lines: string[], lineH = 5,
): number {
  const h = lines.length * lineH + 8;
  doc.setFillColor(bgColor); doc.rect(margin, y, pw - 2 * margin, h, 'F');
  doc.setDrawColor(borderColor); doc.setLineWidth(0.3); doc.rect(margin, y, pw - 2 * margin, h, 'S');
  return h;
}

export async function downloadSymptomAssessmentPdf(check: SymptomCheck): Promise<void> {
  const { jsPDF }     = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');
  const logoDataUrl   = await loadLogoDataUrl();

  const doc    = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw     = doc.internal.pageSize.getWidth();
  const ph     = doc.internal.pageSize.getHeight();
  const margin = 20;

  const rec = check.aiAssessment.recommendation;
  const urgencyColor =
    rec === 'emergency' ? C.red   :
    rec === 'urgent'    ? C.orange :
    rec === 'routine'   ? C.amber  : C.green;
  const urgencyBg =
    rec === 'emergency' ? C.redLight   :
    rec === 'urgent'    ? C.orangeLight :
    rec === 'routine'   ? C.amberLight  : C.greenLight;

  const confidence    = Math.round(check.aiAssessment.confidence);
  const confLabel     = confidenceLabel(confidence);
  const isLowConf     = confidence < 65;
  const isDegraded    = check.aiAssessment.isDegraded === true;
  const isEmergency   = rec === 'emergency';
  const topCondition  = check.aiAssessment.topPredictions?.[0]?.disease ?? check.aiAssessment.possibleConditions?.[0] ?? 'the identified condition';
  const modelVersion  = check.aiAssessment.modelVersion ?? 'RandomForest-v1';

  // ── Header ─────────────────────────────────────────────────────────────────
  const headerH = 38;
  doc.setFillColor(C.navy); doc.rect(0, 0, pw, headerH, 'F');
  doc.setFillColor(C.primary); doc.rect(0, headerH, pw, 1.5, 'F');
  const logoW = 30, logoH = 19; const logoX = margin - 1; const logoY = (headerH - logoH) / 2;
  doc.setFillColor(C.white); doc.roundedRect(logoX - 1, logoY - 1, logoW + 2, logoH + 2, 3, 3, 'F');
  if (logoDataUrl) { try { doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH); } catch { /* skip */ } }
  const lx = logoX + logoW + 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(C.white); doc.text('SHCP', lx, 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor('#A8C8E8'); doc.text('Smart Health Consultation Platform', lx, 22);
  doc.setFontSize(6.5); doc.setTextColor('#7AAFD4'); doc.text('Ministry of Health - Rwanda', lx, 28);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(C.white); doc.text('AI SYMPTOM ASSESSMENT', pw - margin, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor('#A8C8E8'); doc.text('Preliminary Screening Report', pw - margin, 22, { align: 'right' });
  doc.setFontSize(6.5); doc.setTextColor('#7AAFD4'); doc.text(check.date, pw - margin, 29, { align: 'right' });

  let y = headerH + 1.5 + 8;

  // ── 1. EMERGENCY ALERT BANNER ──────────────────────────────────────────────
  if (isEmergency) {
    const alertH = 18;
    doc.setFillColor(C.red); doc.rect(0, y, pw, alertH, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(C.white);
    doc.text('SEEK EMERGENCY CARE IMMEDIATELY', pw / 2, y + 7, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor('#FFCCCC');
    doc.text('Call Emergency Services: 912   |   Go to the nearest Emergency Room now', pw / 2, y + 13.5, { align: 'center' });
    y += alertH + 6;
  }

  // ── 2. DEGRADED ASSESSMENT BANNER ─────────────────────────────────────────
  if (isDegraded) {
    const txt = 'LIMITED ASSESSMENT: This analysis was conducted with insufficient symptom information. The results may be unreliable. Consult a healthcare provider before acting on this report.';
    const lines = doc.splitTextToSize(txt, pw - 2 * margin - 10);
    const h = drawColoredBox(doc, pw, margin, y, C.amberLight, C.amber, lines);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(C.amber);
    doc.text(lines, margin + 5, y + 6);
    y += h + 6;
  }

  // ── 3. LOW CONFIDENCE WARNING ──────────────────────────────────────────────
  if (isLowConf) {
    const txt = `LOW AI CONFIDENCE (${confidence}%): This assessment has ${confLabel.toLowerCase()} confidence. Do not rely on it without first consulting a healthcare provider.`;
    const lines = doc.splitTextToSize(txt, pw - 2 * margin - 10);
    const h = drawColoredBox(doc, pw, margin, y, '#FFFBEB', C.amber, lines);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(C.amber);
    doc.text(lines, margin + 5, y + 6);
    y += h + 6;
  }

  // ── Metadata ───────────────────────────────────────────────────────────────
  const meta = (label: string, value: string) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(C.gray700); doc.text(label, margin, y);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(C.gray900); doc.text(value || '—', margin + 38, y);
    y += 6;
  };
  meta('Assessment Date:', check.date);
  meta('Severity Reported:', check.severity.charAt(0).toUpperCase() + check.severity.slice(1));
  if (check.duration)     meta('Duration:', check.duration);
  if (check.bodyLocation) meta('Body Location:', check.bodyLocation);

  // Urgency badge row
  y += 1;
  doc.setFillColor(urgencyColor); doc.rect(margin, y, 42, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(C.white);
  doc.text(rec.toUpperCase(), margin + 21, y + 5.5, { align: 'center' });

  if (check.aiAssessment.icd10) {
    doc.setFillColor(C.gray100); doc.rect(margin + 46, y, 40, 8, 'F');
    doc.setDrawColor(C.gray300); doc.setLineWidth(0.2); doc.rect(margin + 46, y, 40, 8, 'S');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(C.gray700);
    doc.text(`ICD-10: ${check.aiAssessment.icd10}`, margin + 66, y + 5.5, { align: 'center' });
  }

  // Confidence with interpretation label
  const confColor = isLowConf ? C.amber : confidence >= 80 ? C.green : C.primary;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(confColor);
  doc.text(`${confidence}% confidence — ${confLabel}`, pw - margin, y + 5.5, { align: 'right' });

  y += 13;
  doc.setDrawColor(C.gray300); doc.setLineWidth(0.4); doc.line(margin, y, pw - margin, y); y += 8;

  // ── 4. RED-FLAG SYMPTOMS BOX (always shown) ────────────────────────────────
  const redFlags = [
    'Chest pain, tightness, or pressure',
    'Severe difficulty breathing or shortness of breath',
    'Loss of consciousness or unresponsiveness',
    'Severe allergic reaction (face/throat swelling)',
    'Coughing or vomiting blood',
    'Signs of stroke: sudden numbness, confusion, severe headache',
    'Severe uncontrolled bleeding',
  ];
  if (y + 45 > ph - 20) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(C.red);
  doc.text('SEEK EMERGENCY CARE IF YOU ALSO HAVE ANY OF THESE:', margin, y); y += 4;
  const rfBoxH = redFlags.length * 5 + 8;
  doc.setFillColor(C.redLight); doc.rect(margin, y, pw - 2 * margin, rfBoxH, 'F');
  doc.setDrawColor(C.red); doc.setLineWidth(0.25); doc.rect(margin, y, pw - 2 * margin, rfBoxH, 'S');
  redFlags.forEach((flag, i) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(C.red);
    doc.text(`• ${flag}`, margin + 5, y + 6 + i * 5);
  });
  y += rfBoxH + 8;

  // ── Reported Symptoms ──────────────────────────────────────────────────────
  if (y + 20 > ph - 20) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(C.navy); doc.text('REPORTED SYMPTOMS', margin, y); y += 3;
  const symptomText = check.symptoms.map(formatSymptom).join(', ') || '—';
  const symLines = doc.splitTextToSize(symptomText, pw - 2 * margin - 10);
  const symH = symLines.length * 5 + 8;
  doc.setFillColor(C.gray100); doc.rect(margin, y, pw - 2 * margin, symH, 'F');
  doc.setDrawColor(C.gray300); doc.setLineWidth(0.2); doc.rect(margin, y, pw - 2 * margin, symH, 'S');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(C.gray900);
  doc.text(symLines, margin + 5, y + 6);
  y += symH + 8;

  // ── AI Differential Diagnosis ──────────────────────────────────────────────
  if ((check.aiAssessment.topPredictions?.length ?? 0) > 0) {
    if (y + 30 > ph - 20) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(C.navy); doc.text('AI DIFFERENTIAL DIAGNOSIS', margin, y); y += 3;
    autoTable(doc, {
      startY: y, margin: { left: margin, right: margin },
      head: [['Rank', 'Possible Condition', 'AI Probability']],
      body: check.aiAssessment.topPredictions!.map((p, i) => [
        i === 0 ? 'Most Likely' : `#${i + 1}`,
        p.disease,
        `${Math.round(p.probability)}%`,
      ]),
      headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 } },
      bodyStyles: { fontSize: 8.5, textColor: C.gray900, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 } },
      alternateRowStyles: { fillColor: C.gray100 },
      columnStyles: { 0: { cellWidth: 35, fontStyle: 'bold', textColor: C.primary }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 35, halign: 'right', fontStyle: 'bold', textColor: C.navy } },
      tableLineColor: C.gray300, tableLineWidth: 0.2, theme: 'grid',
      didDrawCell: (hook) => {
        if (hook.row.index === 0 && hook.section === 'body') {
          doc.setFillColor(C.primaryLight);
          doc.rect(hook.cell.x + 0.1, hook.cell.y + 0.1, hook.cell.width - 0.2, hook.cell.height - 0.2, 'F');
        }
      },
    });
    y = getLastY(doc) + 8;
  }

  // ── 6. KEY CONTRIBUTING SYMPTOMS — plain language ─────────────────────────
  if ((check.aiAssessment.explainingFactors?.length ?? 0) > 0) {
    if (y + 30 > ph - 20) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(C.navy); doc.text('WHY THE AI REACHED THIS ASSESSMENT', margin, y); y += 3;
    autoTable(doc, {
      startY: y, margin: { left: margin, right: margin },
      head: [['Symptom', 'What it means for your assessment', 'You reported this']],
      body: check.aiAssessment.explainingFactors!.map(f => [
        formatSymptom(f.symptom),
        f.direction === 'positive'
          ? `Strongly suggests ${topCondition}`
          : `Makes ${topCondition} less likely`,
        f.present ? 'Yes' : 'No',
      ]),
      headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 7.5, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 } },
      bodyStyles: { fontSize: 8, textColor: C.gray900, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
      alternateRowStyles: { fillColor: C.gray100 },
      columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 28, halign: 'center' } },
      tableLineColor: C.gray300, tableLineWidth: 0.2, theme: 'grid',
    });
    y = getLastY(doc) + 8;
  }

  // ── 4. STRUCTURED ACTION STEPS ────────────────────────────────────────────
  if (y + 50 > ph - 20) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(C.navy); doc.text('WHAT YOU SHOULD DO', margin, y); y += 3;

  const actionSteps: { label: string; color: string; bg: string; items: string[] }[] = [];

  if (rec === 'emergency') {
    actionSteps.push({ label: 'NOW — IMMEDIATELY', color: C.red, bg: C.redLight, items: [
      'Call emergency services (912) or have someone drive you to the ER',
      'Do not drive yourself',
      'If chest pain: chew aspirin (if not allergic) while waiting',
      'Stay calm and keep someone with you',
    ]});
  } else if (rec === 'urgent') {
    actionSteps.push({ label: 'TODAY', color: C.orange, bg: C.orangeLight, items: [
      'Visit a doctor or urgent care clinic today — do not wait',
      check.aiAssessment.specialistType ? `Ask for a referral to: ${check.aiAssessment.specialistType}` : 'See your primary care doctor or nearest clinic',
      'Bring this report to your appointment',
    ]});
    actionSteps.push({ label: 'WHILE WAITING', color: C.amber, bg: C.amberLight, items: [
      'Rest and avoid strenuous activity',
      'Stay hydrated',
      'Monitor your symptoms closely — if they worsen, go to the emergency room',
    ]});
  } else if (rec === 'routine') {
    actionSteps.push({ label: 'THIS WEEK', color: C.primary, bg: C.primaryLight, items: [
      check.aiAssessment.followUpDays
        ? `Schedule a doctor appointment within ${check.aiAssessment.followUpDays} day${check.aiAssessment.followUpDays !== 1 ? 's' : ''}`
        : 'Schedule a doctor appointment within the next 3–5 days',
      check.aiAssessment.specialistType ? `Consider seeing a ${check.aiAssessment.specialistType}` : 'Visit your primary care doctor',
      'Share this report with your healthcare provider',
    ]});
  } else {
    actionSteps.push({ label: 'AT HOME', color: C.green, bg: C.greenLight, items: [
      'You can manage these symptoms at home for now',
      'Follow the self-care tips below',
      'If symptoms worsen or persist beyond 3 days, see a doctor',
    ]});
  }

  actionSteps.push({ label: 'ONGOING', color: C.gray700, bg: C.gray100, items: [
    'Monitor your symptoms daily',
    'Stay hydrated and get adequate rest',
    'Return for a new assessment if symptoms change significantly',
    'Keep a record of any new or worsening symptoms',
  ]});

  actionSteps.forEach(step => {
    if (y + 30 > ph - 20) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(step.color);
    doc.text(step.label, margin + 2, y); y += 4;
    const totalH = step.items.length * 5.5 + 6;
    doc.setFillColor(step.bg); doc.rect(margin, y, pw - 2 * margin, totalH, 'F');
    doc.setDrawColor(step.color); doc.setLineWidth(0.2); doc.rect(margin, y, pw - 2 * margin, totalH, 'S');
    step.items.forEach((item, i) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(C.gray900);
      doc.text(`${i + 1}.  ${item}`, margin + 5, y + 5.5 + i * 5.5);
    });
    y += totalH + 5;
  });

  // ── Care Details ────────────────────────────────────────────────────────────
  if (check.aiAssessment.details) {
    if (y + 20 > ph - 20) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(C.navy); doc.text('AI CARE RECOMMENDATION', margin, y); y += 3;
    const recLines = doc.splitTextToSize(check.aiAssessment.details, pw - 2 * margin - 10);
    const recH = recLines.length * 5 + 8;
    doc.setFillColor(C.primaryLight); doc.rect(margin, y, pw - 2 * margin, recH, 'F');
    doc.setDrawColor(C.primary); doc.setLineWidth(0.3); doc.rect(margin, y, pw - 2 * margin, recH, 'S');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(C.navy);
    doc.text(recLines, margin + 5, y + 6);
    y += recH + 8;
  }

  // ── Self-Care Tips ─────────────────────────────────────────────────────────
  if ((check.aiAssessment.selfCareTips?.length ?? 0) > 0) {
    if (y + 25 > ph - 20) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(C.navy); doc.text('SELF-CARE TIPS', margin, y); y += 3;
    const tipsH = check.aiAssessment.selfCareTips!.length * 6 + 8;
    doc.setFillColor(C.greenLight); doc.rect(margin, y, pw - 2 * margin, tipsH, 'F');
    doc.setDrawColor(C.green); doc.setLineWidth(0.2); doc.rect(margin, y, pw - 2 * margin, tipsH, 'S');
    check.aiAssessment.selfCareTips!.forEach((tip, i) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(C.gray900);
      doc.text(`${i + 1}.  ${tip}`, margin + 5, y + 6 + i * 6);
    });
    y += tipsH + 8;
  }

  // ── 9. RE-ASSESS PROMPT ────────────────────────────────────────────────────
  if (y + 14 > ph - 20) { doc.addPage(); y = 20; }
  const reassessText = 'Return for a new assessment if: your symptoms worsen, new symptoms appear, you feel better and want to confirm recovery, or your current symptoms persist beyond 3 days.';
  const raLines = doc.splitTextToSize(reassessText, pw - 2 * margin - 10);
  const raH = raLines.length * 5 + 8;
  doc.setFillColor(C.gray100); doc.rect(margin, y, pw - 2 * margin, raH, 'F');
  doc.setDrawColor(C.gray300); doc.setLineWidth(0.2); doc.rect(margin, y, pw - 2 * margin, raH, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(C.gray700);
  doc.text('WHEN TO RE-ASSESS:', margin + 5, y + 5.5);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(C.gray500);
  doc.text(raLines, margin + 5, y + 5.5 + 5);
  y += raH + 8;

  // ── Disclaimer ─────────────────────────────────────────────────────────────
  if (y + 20 > ph - 20) { doc.addPage(); y = 20; }
  const disclaimer = 'IMPORTANT DISCLAIMER: This AI-generated report is a preliminary screening only and is NOT a medical diagnosis. It is intended to help guide you on where to seek care — not to replace professional medical advice. Always consult a qualified healthcare provider for proper diagnosis and treatment.';
  const dLines = doc.splitTextToSize(disclaimer, pw - 2 * margin - 10);
  const dH = dLines.length * 5 + 8;
  doc.setFillColor(C.amberLight); doc.rect(margin, y, pw - 2 * margin, dH, 'F');
  doc.setDrawColor(C.amber); doc.setLineWidth(0.3); doc.rect(margin, y, pw - 2 * margin, dH, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(C.amber);
  doc.text(dLines, margin + 5, y + 6);

  // ── Footer with model version ───────────────────────────────────────────────
  const totalPages = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawPageFooter(doc, pw, ph, margin, `SHCP AI System · Model: ${modelVersion}`, p);
  }

  const dateSlug = new Date().toISOString().split('T')[0];
  doc.save(`SHCP-AI-Assessment-${dateSlug}.pdf`);
}
