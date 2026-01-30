import { jsPDF } from 'jspdf';

const COLORS = {
  gold: [184, 157, 102],
  darkGold: [139, 119, 77],
  navy: [26, 54, 93],
  darkNavy: [15, 32, 56],
  teal: [20, 184, 166],
  darkTeal: [13, 148, 136],
  black: [30, 30, 30],
  gray: [100, 100, 100],
  lightGray: [180, 180, 180],
};

function drawOrnamentalBorder(doc, pageWidth, pageHeight) {
  const margin = 15;
  const innerMargin = 20;

  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(3);
  doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

  doc.setLineWidth(1);
  doc.rect(innerMargin, innerMargin, pageWidth - 2 * innerMargin, pageHeight - 2 * innerMargin);

  const cornerSize = 12;
  const corners = [
    [margin + 5, margin + 5],
    [pageWidth - margin - 5, margin + 5],
    [margin + 5, pageHeight - margin - 5],
    [pageWidth - margin - 5, pageHeight - margin - 5],
  ];

  doc.setFillColor(...COLORS.gold);
  corners.forEach(([x, y]) => {
    doc.circle(x, y, 3, 'F');
  });

  doc.setDrawColor(...COLORS.darkGold);
  doc.setLineWidth(0.5);

  const decorY = 45;
  doc.line(50, decorY, pageWidth / 2 - 40, decorY);
  doc.line(pageWidth / 2 + 40, decorY, pageWidth - 50, decorY);

  doc.setFillColor(...COLORS.darkGold);
  doc.circle(pageWidth / 2 - 35, decorY, 2, 'F');
  doc.circle(pageWidth / 2 + 35, decorY, 2, 'F');
  doc.circle(pageWidth / 2, decorY - 5, 3, 'F');

  const bottomDecorY = pageHeight - 55;
  doc.line(50, bottomDecorY, pageWidth / 2 - 40, bottomDecorY);
  doc.line(pageWidth / 2 + 40, bottomDecorY, pageWidth - 50, bottomDecorY);
  doc.circle(pageWidth / 2 - 35, bottomDecorY, 2, 'F');
  doc.circle(pageWidth / 2 + 35, bottomDecorY, 2, 'F');
}

function drawSeal(doc, x, y) {
  doc.setFillColor(...COLORS.navy);
  doc.circle(x, y, 18, 'F');

  doc.setFillColor(...COLORS.darkNavy);
  doc.circle(x, y, 15, 'F');

  doc.setFillColor(...COLORS.gold);
  doc.circle(x, y, 12, 'F');

  doc.setFillColor(...COLORS.darkNavy);
  doc.circle(x, y, 9, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('PROXIMITY', x, y - 2, { align: 'center' });
  doc.setFontSize(5);
  doc.text('CERTIFIED', x, y + 3, { align: 'center' });
}

export const certificateService = {
  generateCertificate(person, facility, instruments = []) {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'letter',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFillColor(255, 253, 250);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    drawOrnamentalBorder(doc, pageWidth, pageHeight);

    doc.setTextColor(...COLORS.navy);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('PROXIMITY DIAGNOSTICS', pageWidth / 2, 35, { align: 'center' });

    doc.setTextColor(...COLORS.gold);
    doc.setFontSize(36);
    doc.setFont('times', 'bolditalic');
    doc.text('Certificate of Completion', pageWidth / 2, 58, { align: 'center' });

    doc.setTextColor(...COLORS.gray);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('This is to certify that', pageWidth / 2, 75, { align: 'center' });

    doc.setTextColor(...COLORS.navy);
    doc.setFontSize(28);
    doc.setFont('times', 'bolditalic');
    doc.text(person.name || 'Certificate Recipient', pageWidth / 2, 92, { align: 'center' });

    doc.setDrawColor(...COLORS.gold);
    doc.setLineWidth(0.5);
    const nameWidth = doc.getTextWidth(person.name || 'Certificate Recipient');
    const underlineStart = (pageWidth - nameWidth) / 2 - 10;
    const underlineEnd = (pageWidth + nameWidth) / 2 + 10;
    doc.line(underlineStart, 95, underlineEnd, 95);

    if (person.title) {
      doc.setTextColor(...COLORS.gray);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'italic');
      doc.text(person.title, pageWidth / 2, 103, { align: 'center' });
    }

    doc.setTextColor(...COLORS.black);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('has successfully completed the required training program for', pageWidth / 2, 115, { align: 'center' });

    const instrumentNames = instruments.length > 0
      ? instruments.map(i => i.charAt(0).toUpperCase() + i.slice(1)).join(', ')
      : 'Point-of-Care Testing Equipment';

    doc.setTextColor(...COLORS.teal);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(instrumentNames, pageWidth / 2, 127, { align: 'center' });

    doc.setTextColor(...COLORS.black);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('at', pageWidth / 2, 138, { align: 'center' });

    doc.setTextColor(...COLORS.navy);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(facility.name || 'Healthcare Facility', pageWidth / 2, 148, { align: 'center' });

    if (facility.city && facility.state) {
      doc.setTextColor(...COLORS.gray);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${facility.city}, ${facility.state}`, pageWidth / 2, 155, { align: 'center' });
    }

    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const signatureY = 175;
    const signatureWidth = 60;

    const leftSignatureX = pageWidth / 4;
    doc.setDrawColor(...COLORS.lightGray);
    doc.setLineWidth(0.3);
    doc.line(leftSignatureX - signatureWidth / 2, signatureY, leftSignatureX + signatureWidth / 2, signatureY);

    doc.setTextColor(...COLORS.black);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Training Director', leftSignatureX, signatureY + 6, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray);
    doc.text('Proximity Diagnostics', leftSignatureX, signatureY + 11, { align: 'center' });

    const centerX = pageWidth / 2;
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(10);
    doc.text('Date of Completion', centerX, signatureY - 8, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(formattedDate, centerX, signatureY, { align: 'center' });

    const rightSignatureX = (pageWidth * 3) / 4;
    doc.setDrawColor(...COLORS.lightGray);
    doc.line(rightSignatureX - signatureWidth / 2, signatureY, rightSignatureX + signatureWidth / 2, signatureY);

    doc.setTextColor(...COLORS.black);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Facility Administrator', rightSignatureX, signatureY + 6, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray);
    doc.text(facility.name || '', rightSignatureX, signatureY + 11, { align: 'center' });

    drawSeal(doc, pageWidth - 45, pageHeight - 45);

    const certId = `CERT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    doc.setTextColor(...COLORS.lightGray);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Certificate ID: ${certId}`, pageWidth / 2, pageHeight - 20, { align: 'center' });

    const fileName = `Certificate_${person.name?.replace(/\s+/g, '_') || 'Recipient'}_${today.toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    return { success: true, fileName, certId };
  },

  generateBulkCertificates(trainedPersonnel, facility) {
    const results = [];
    trainedPersonnel.forEach(person => {
      if (person.instruments_certified?.length > 0) {
        const result = this.generateCertificate(person, facility, person.instruments_certified);
        results.push({ person: person.name, ...result });
      }
    });
    return results;
  },
};
