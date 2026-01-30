import { jsPDF } from 'jspdf';

const COLORS = {
  navy: [26, 54, 93],
  teal: [56, 178, 172],
  lightTeal: [180, 225, 222],
  gray: [100, 116, 139],
  white: [255, 255, 255],
};

function drawWaveCorners(doc, pageWidth, pageHeight) {
  doc.setFillColor(...COLORS.teal);
  doc.triangle(pageWidth - 90, 0, pageWidth, 0, pageWidth, 55, 'F');
  doc.setFillColor(...COLORS.navy);
  doc.triangle(pageWidth - 55, 0, pageWidth, 0, pageWidth, 65, 'F');

  doc.setFillColor(...COLORS.teal);
  doc.triangle(0, pageHeight - 55, 90, pageHeight, 0, pageHeight, 'F');
  doc.setFillColor(...COLORS.navy);
  doc.triangle(0, pageHeight - 65, 55, pageHeight, 0, pageHeight, 'F');
}

function drawBorder(doc, pageWidth, pageHeight) {
  const margin = 18;
  doc.setDrawColor(...COLORS.lightTeal);
  doc.setLineWidth(1);
  doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(0.5);
  doc.rect(margin + 3, margin + 3, pageWidth - 2 * margin - 6, pageHeight - 2 * margin - 6);
}

function drawRibbonBadge(doc, x, y) {
  doc.setFillColor(...COLORS.teal);
  doc.circle(x, y, 14, 'F');

  doc.setFillColor(...COLORS.white);
  doc.circle(x, y, 10, 'F');

  doc.setFillColor(...COLORS.teal);
  doc.circle(x, y, 7, 'F');

  doc.setDrawColor(...COLORS.white);
  doc.setLineWidth(2);
  doc.line(x - 3, y, x - 0.5, y + 3.5);
  doc.line(x - 0.5, y + 3.5, x + 4, y - 3);

  doc.setFillColor(...COLORS.teal);
  doc.triangle(x - 4, y + 12, x - 10, y + 28, x - 1, y + 16, 'F');
  doc.triangle(x + 4, y + 12, x + 10, y + 28, x + 1, y + 16, 'F');
}

function formatDate(dateString) {
  if (!dateString) {
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export const certificateService = {
  generateCertificate(person, facility, instruments = [], technicalConsultantName = '') {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'letter',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFillColor(...COLORS.white);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    drawWaveCorners(doc, pageWidth, pageHeight);
    drawBorder(doc, pageWidth, pageHeight);

    doc.setTextColor(...COLORS.navy);
    doc.setFontSize(32);
    doc.setFont('times', 'bold');
    doc.text('CERTIFICATE OF COMPLETION', pageWidth / 2, 45, { align: 'center' });

    doc.setDrawColor(...COLORS.teal);
    doc.setLineWidth(1.5);
    const dashLength = 5;
    const gapLength = 4;
    const lineY = 53;
    const lineStartX = pageWidth / 2 - 55;
    const lineEndX = pageWidth / 2 + 55;
    for (let xPos = lineStartX; xPos < lineEndX; xPos += dashLength + gapLength) {
      doc.line(xPos, lineY, Math.min(xPos + dashLength, lineEndX), lineY);
    }

    doc.setTextColor(...COLORS.gray);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('This is presented to :', pageWidth / 2, 72, { align: 'center' });

    doc.setTextColor(...COLORS.teal);
    doc.setFontSize(36);
    doc.setFont('times', 'bolditalic');
    doc.text(person.name || 'Certificate Recipient', pageWidth / 2, 95, { align: 'center' });

    doc.setDrawColor(...COLORS.teal);
    doc.setLineWidth(0.8);
    const nameWidth = doc.getTextWidth(person.name || 'Certificate Recipient');
    const underlineStart = (pageWidth - nameWidth) / 2 - 15;
    const underlineEnd = (pageWidth + nameWidth) / 2 + 15;
    doc.line(underlineStart, 100, underlineEnd, 100);

    const instrumentNames = instruments.length > 0
      ? instruments.map(i => i.charAt(0).toUpperCase() + i.slice(1)).join(', ')
      : 'Point-of-Care Testing Equipment';

    doc.setTextColor(...COLORS.gray);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const certText = `completed the required training program for ${instrumentNames}`;
    doc.text(certText, pageWidth / 2, 115, { align: 'center', maxWidth: pageWidth - 80 });

    const facilityLocation = facility.city && facility.state ? `, ${facility.city}, ${facility.state}` : '';
    doc.text(`at ${facility.name || 'Healthcare Facility'}${facilityLocation}.`, pageWidth / 2, 125, { align: 'center' });

    const trainingDate = formatDate(person.training_date);
    doc.setTextColor(...COLORS.navy);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Date of Completion: ${trainingDate}`, pageWidth / 2, 140, { align: 'center' });

    drawRibbonBadge(doc, pageWidth / 2, 160);

    const signatureY = 188;

    const leftSignatureX = pageWidth / 4 + 10;
    doc.setTextColor(...COLORS.navy);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    const consultantDisplay = technicalConsultantName || 'Technical Consultant';
    doc.text(consultantDisplay, leftSignatureX, signatureY, { align: 'center' });
    doc.setTextColor(...COLORS.teal);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Technical Consultant', leftSignatureX, signatureY + 6, { align: 'center' });

    const rightSignatureX = (pageWidth * 3) / 4 - 10;
    doc.setTextColor(...COLORS.navy);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Facility Administrator', rightSignatureX, signatureY, { align: 'center' });
    doc.setTextColor(...COLORS.teal);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Facility Administrator', rightSignatureX, signatureY + 6, { align: 'center' });

    const certId = `CERT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Certificate ID: ${certId}`, pageWidth / 2, pageHeight - 12, { align: 'center' });

    const fileName = `Certificate_${person.name?.replace(/\s+/g, '_') || 'Recipient'}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    return { success: true, fileName, certId };
  },

  generateBulkCertificates(trainedPersonnel, facility, technicalConsultantName = '') {
    const results = [];
    trainedPersonnel.forEach(person => {
      if (person.instruments_certified?.length > 0) {
        const result = this.generateCertificate(person, facility, person.instruments_certified, technicalConsultantName);
        results.push({ person: person.name, ...result });
      }
    });
    return results;
  },
};
