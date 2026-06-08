import { ApiPrescriptionDto } from '@/app/types';
import { MedicationItem } from '@/app/api/prescriptions';

// Brand colours (match CSS variables used throughout the app)
const C = {
  primary:    '#1B6CA8',
  primaryDark:'#134F7D',
  green:      '#16A34A',
  greenLight: '#DCFCE7',
  red:        '#DC2626',
  redLight:   '#FEE2E2',
  amber:      '#D97706',
  amberLight: '#FEF3C7',
  gray900:    '#111827',
  gray700:    '#374151',
  gray500:    '#6B7280',
  gray300:    '#D1D5DB',
  gray100:    '#F3F4F6',
  white:      '#FFFFFF',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING:             C.amber,
  PROCESSING:          C.primary,
  READY_FOR_DELIVERY:  C.green,
  PICKED_UP:           C.green,
  ON_THE_WAY:          C.primary,
  DELIVERED:           C.green,
  CANCELLED:           C.red,
  FAILED:              C.red,
  EXPIRED:             C.gray500,
};

/** Draw the SHCP health-cross icon at (x, y) with given size. */
function drawCross(doc: InstanceType<typeof import('jspdf').jsPDF>, x: number, y: number, size: number, color: string) {
  const arm   = size * 0.28;
  const thick = size * 0.28;
  doc.setFillColor(color);
  // vertical bar
  doc.roundedRect(x + (size - thick) / 2, y + arm, thick, size - arm * 2, 1.5, 1.5, 'F');
  // horizontal bar
  doc.roundedRect(x + arm, y + (size - thick) / 2, size - arm * 2, thick, 1.5, 1.5, 'F');
}

/**
 * Generates and triggers a browser download for a prescription PDF.
 * jsPDF and jspdf-autotable are dynamically imported so they only load
 * when the patient actually requests a download — no impact on initial bundle.
 */
export async function downloadPrescriptionPdf(rx: ApiPrescriptionDto): Promise<void> {
  // Dynamic imports — only fetched on first call
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = (autoTableModule as unknown as { default: typeof autoTableModule.default }).default ?? autoTableModule.default;

  let meds: MedicationItem[] = [];
  try { meds = JSON.parse(rx.medications); } catch { meds = []; }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw = doc.internal.pageSize.getWidth();   // 210
  const ph = doc.internal.pageSize.getHeight();  // 297
  const margin = 14;
  const innerW = pw - margin * 2;

  // ── HEADER BAND ──────────────────────────────────────────────────────────────
  doc.setFillColor(C.primary);
  doc.rect(0, 0, pw, 32, 'F');

  // Cross icon
  drawCross(doc, margin, 7, 18, C.white);

  // SHCP wordmark
  doc.setTextColor(C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SHCP', margin + 22, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Smart Health Consultation Platform', margin + 22, 21);

  // "MEDICAL PRESCRIPTION" on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MEDICAL PRESCRIPTION', pw - margin, 13, { align: 'right' });

  // Status pill
  const statusColor = STATUS_COLOR[rx.status] ?? C.gray500;
  doc.setFillColor(statusColor);
  const statusText = rx.status.replace(/_/g, ' ');
  doc.roundedRect(pw - margin - 38, 17, 38, 8, 2, 2, 'F');
  doc.setTextColor(C.white);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(statusText, pw - margin - 19, 22.5, { align: 'center' });

  // ── RX IDENTIFIER BAR ────────────────────────────────────────────────────────
  doc.setFillColor(C.gray100);
  doc.rect(0, 32, pw, 12, 'F');
  doc.setTextColor(C.gray700);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);

  const rxId = rx.prescriptionId.toUpperCase().slice(-12);
  doc.text(`Rx #${rxId}`, margin, 40);

  const issuedDate = rx.issuedAt.split('T')[0];
  const validDate  = rx.validUntil?.split('T')[0] ?? '';
  doc.text(`Issued: ${issuedDate}`, pw / 2, 40, { align: 'center' });
  doc.text(`Valid until: ${validDate}`, pw - margin, 40, { align: 'right' });

  // ── PATIENT / PROVIDER INFO ──────────────────────────────────────────────────
  const cardY = 49;
  const halfW = (innerW - 6) / 2;

  // Patient card
  doc.setFillColor(C.gray100);
  doc.roundedRect(margin, cardY, halfW, 28, 2, 2, 'F');
  doc.setTextColor(C.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('PATIENT', margin + 4, cardY + 6);
  doc.setDrawColor(C.primary);
  doc.setLineWidth(0.5);
  doc.line(margin + 4, cardY + 7.5, margin + halfW - 4, cardY + 7.5);

  doc.setTextColor(C.gray900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(rx.patientName, margin + 4, cardY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(C.gray500);
  if (rx.deliveryDistrict) {
    const loc = [rx.deliveryCell, rx.deliverySector, rx.deliveryDistrict].filter(Boolean).join(', ');
    doc.text(`Location: ${loc}`, margin + 4, cardY + 20);
  }
  doc.text(`Patient ID: ${rx.patientId.slice(-8).toUpperCase()}`, margin + 4, cardY + 26);

  // Provider card
  const provX = margin + halfW + 6;
  doc.setFillColor(C.gray100);
  doc.roundedRect(provX, cardY, halfW, 28, 2, 2, 'F');
  doc.setTextColor(C.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('PRESCRIBING PHYSICIAN', provX + 4, cardY + 6);
  doc.setDrawColor(C.primary);
  doc.line(provX + 4, cardY + 7.5, provX + halfW - 4, cardY + 7.5);

  doc.setTextColor(C.gray900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Dr. ${rx.providerName}`, provX + 4, cardY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(C.gray500);
  doc.text('SHCP Licensed Provider', provX + 4, cardY + 20);
  if (rx.providerName) {
    doc.text(`Signature: ${rx.providerName}`, provX + 4, cardY + 26);
  }

  // ── MEDICATIONS TABLE ────────────────────────────────────────────────────────
  const tableY = cardY + 34;
  doc.setTextColor(C.gray700);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('PRESCRIBED MEDICATIONS', margin, tableY);

  autoTable(doc, {
    startY: tableY + 3,
    margin: { left: margin, right: margin },
    head: [['#', 'Drug / Medication', 'Dosage', 'Frequency', 'Duration']],
    body: meds.map((m, i) => [
      String(i + 1),
      m.name,
      m.dosage,
      m.frequency,
      `${m.durationDays} day${m.durationDays !== 1 ? 's' : ''}`,
    ]),
    headStyles: {
      fillColor: C.primaryDark,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: C.gray900,
    },
    alternateRowStyles: {
      fillColor: '#EFF6FF',
    },
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 38, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
    },
    tableLineColor: C.gray300,
    tableLineWidth: 0.2,
    theme: 'grid',
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursorY = ((doc as any).lastAutoTable?.finalY ?? (tableY + 30)) + 6;

  // ── INSTRUCTIONS ─────────────────────────────────────────────────────────────
  if (rx.instructions) {
    doc.setFillColor('#EFF6FF');
    doc.roundedRect(margin, cursorY, innerW, 5, 1, 1, 'F');
    doc.setTextColor(C.primary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('INSTRUCTIONS', margin + 3, cursorY + 3.5);
    cursorY += 7;

    const lines = doc.splitTextToSize(rx.instructions, innerW - 6);
    doc.setTextColor(C.gray700);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(lines, margin + 3, cursorY);
    cursorY += lines.length * 4.5 + 4;
  }

  // ── PHARMACY ─────────────────────────────────────────────────────────────────
  if (rx.pharmacyName) {
    doc.setFillColor(C.greenLight);
    doc.roundedRect(margin, cursorY, innerW, 16, 2, 2, 'F');
    doc.setTextColor(C.green);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('ASSIGNED PHARMACY', margin + 4, cursorY + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(C.gray900);
    doc.text(rx.pharmacyName, margin + 4, cursorY + 11.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(C.gray500);
    const pharmacyLoc = [rx.deliveryCell, rx.deliverySector, rx.deliveryDistrict].filter(Boolean).join(', ');
    if (pharmacyLoc) doc.text(pharmacyLoc, margin + 4, cursorY + 16);
    cursorY += 22;
  } else {
    doc.setFillColor(C.amberLight);
    doc.roundedRect(margin, cursorY, innerW, 10, 2, 2, 'F');
    doc.setTextColor(C.amber);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Present this prescription at any SHCP partner pharmacy in Rwanda.', margin + 4, cursorY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Show the pharmacy staff this document and your national ID.', margin + 4, cursorY + 9);
    cursorY += 16;
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────────
  const footY = ph - 20;
  doc.setFillColor(C.primary);
  doc.rect(0, footY, pw, 20, 'F');

  // Cross icon in footer
  drawCross(doc, margin, footY + 3, 14, C.white);

  doc.setTextColor(C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Smart Health Consultation Platform', margin + 18, footY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(200, 220, 240);
  doc.text('Endorsed by Ministry of Health Rwanda · Rwanda DPA Compliant', margin + 18, footY + 12);

  doc.setTextColor(C.white);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(`Prescription ID: ${rx.prescriptionId}`, pw - margin, footY + 7, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleString('en-RW')}`, pw - margin, footY + 12, { align: 'right' });

  // Disclaimer line just above footer
  doc.setTextColor(C.gray500);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.text(
    'This prescription is valid only when presented with valid patient identification. For healthcare provider and patient use only.',
    margin,
    footY - 4,
    { maxWidth: innerW }
  );

  // Trigger download
  const filename = `SHCP-Prescription-${rx.prescriptionId.slice(-8).toUpperCase()}-${issuedDate}.pdf`;
  doc.save(filename);
}
