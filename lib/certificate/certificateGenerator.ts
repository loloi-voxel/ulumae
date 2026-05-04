export interface CertificateData {
  fullName: string;
  birthDate: string;
  deathDate: string | null;
  preservationDate: string;
  transactionId: string;
  gatewayUrls: string[];
  gatewayUrl?: string | null;
  memorialId: string;
  planType: string;
  password: string;
  warning: string;
  nodeCount?: number;
  endowmentYears?: number;
}

function formatLongDate(value: string | null | undefined) {
  if (!value) {
    return 'Unknown date';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildDateRange(data: CertificateData) {
  if (data.birthDate && data.deathDate) {
    return `${data.birthDate} - ${data.deathDate}`;
  }

  if (data.birthDate) {
    return `Born ${data.birthDate}`;
  }

  return 'Dates unavailable';
}

function buildCertificateFilename(data: CertificateData) {
  const slug = (data.fullName || data.memorialId || 'memorial')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return `ulumae-seal-certificate-${slug || 'memorial'}.pdf`;
}

function splitParagraph(
  text: string,
  maxWidth: number,
  font: {
    widthOfTextAtSize: (value: string, size: number) => number;
  },
  size: number
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(nextLine, size) <= maxWidth || !currentLine) {
      currentLine = nextLine;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function drawParagraph(args: {
  page: {
    drawText: (value: string, options: Record<string, unknown>) => void;
  };
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  lineHeight: number;
  size: number;
  font: {
    widthOfTextAtSize: (value: string, size: number) => number;
  };
  color: unknown;
}) {
  const lines = splitParagraph(args.text, args.maxWidth, args.font, args.size);
  let cursorY = args.y;

  for (const line of lines) {
    args.page.drawText(line, {
      x: args.x,
      y: cursorY,
      size: args.size,
      font: args.font,
      color: args.color,
    });
    cursorY -= args.lineHeight;
  }

  return cursorY;
}

export async function createCertificatePdf(
  data: CertificateData
): Promise<Uint8Array> {
  const pdfLib = (await import('pdf-lib')) as any;
  const pdfDoc = await pdfLib.PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const { rgb } = pdfLib;

  const titleFont = await pdfDoc.embedFont(pdfLib.StandardFonts.TimesRomanBold);
  const headingFont = await pdfDoc.embedFont(pdfLib.StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(pdfLib.StandardFonts.Helvetica);
  const monoFont = await pdfDoc.embedFont(pdfLib.StandardFonts.Courier);

  const gold = rgb(0.77, 0.64, 0.29);
  const cream = rgb(0.96, 0.94, 0.89);
  const warm = rgb(0.75, 0.73, 0.69);
  const ink = rgb(0.12, 0.12, 0.14);
  const slate = rgb(0.19, 0.2, 0.24);
  const warningBg = rgb(0.98, 0.92, 0.88);
  const warningBorder = rgb(0.72, 0.44, 0.35);

  page.drawRectangle({
    x: 0,
    y: 0,
    width: 612,
    height: 792,
    color: ink,
  });

  page.drawRectangle({
    x: 24,
    y: 24,
    width: 564,
    height: 744,
    borderColor: gold,
    borderWidth: 2,
  });

  page.drawText('ULUMAE', {
    x: 269,
    y: 735,
    size: 12,
    font: headingFont,
    color: gold,
  });

  page.drawText('CERTIFICATE OF PERMANENT SEALING', {
    x: 110,
    y: 686,
    size: 24,
    font: titleFont,
    color: cream,
  });

  page.drawLine({
    start: { x: 150, y: 674 },
    end: { x: 462, y: 674 },
    color: gold,
    thickness: 1.25,
  });

  page.drawText('This certifies that the memorial of', {
    x: 184,
    y: 630,
    size: 12,
    font: bodyFont,
    color: warm,
  });

  const nameWidth = titleFont.widthOfTextAtSize(data.fullName, 28);
  page.drawText(data.fullName, {
    x: Math.max(60, (612 - nameWidth) / 2),
    y: 592,
    size: 28,
    font: titleFont,
    color: cream,
  });

  const range = buildDateRange(data);
  const rangeWidth = bodyFont.widthOfTextAtSize(range, 12);
  page.drawText(range, {
    x: Math.max(60, (612 - rangeWidth) / 2),
    y: 566,
    size: 12,
    font: bodyFont,
    color: warm,
  });

  const preservationLine = `was permanently sealed on ${formatLongDate(
    data.preservationDate
  )}.`;
  const preservationWidth = bodyFont.widthOfTextAtSize(preservationLine, 12);
  page.drawText(preservationLine, {
    x: Math.max(60, (612 - preservationWidth) / 2),
    y: 526,
    size: 12,
    font: bodyFont,
    color: cream,
  });

  page.drawText('Arweave Transaction ID', {
    x: 72,
    y: 470,
    size: 11,
    font: headingFont,
    color: gold,
  });

  drawParagraph({
    page,
    text: data.transactionId,
    x: 72,
    y: 448,
    maxWidth: 468,
    lineHeight: 16,
    size: 10,
    font: monoFont,
    color: cream,
  });

  const primaryGateway = data.gatewayUrl || data.gatewayUrls[0] || '';
  page.drawText('Verification Link', {
    x: 72,
    y: 394,
    size: 11,
    font: headingFont,
    color: gold,
  });

  drawParagraph({
    page,
    text: primaryGateway,
    x: 72,
    y: 372,
    maxWidth: 468,
    lineHeight: 15,
    size: 10,
    font: monoFont,
    color: cream,
  });

  page.drawText('Decryption Password', {
    x: 72,
    y: 317,
    size: 11,
    font: headingFont,
    color: gold,
  });

  drawParagraph({
    page,
    text: data.password,
    x: 72,
    y: 295,
    maxWidth: 468,
    lineHeight: 15,
    size: 10,
    font: monoFont,
    color: cream,
  });

  page.drawRectangle({
    x: 60,
    y: 170,
    width: 492,
    height: 90,
    color: warningBg,
    borderColor: warningBorder,
    borderWidth: 1,
  });

  page.drawText('Important', {
    x: 76,
    y: 234,
    size: 11,
    font: headingFont,
    color: warningBorder,
  });

  drawParagraph({
    page,
    text: data.warning,
    x: 76,
    y: 212,
    maxWidth: 460,
    lineHeight: 15,
    size: 10,
    font: bodyFont,
    color: slate,
  });

  page.drawText(`Memorial ID: ${data.memorialId}`, {
    x: 72,
    y: 122,
    size: 9,
    font: bodyFont,
    color: warm,
  });

  page.drawText(`Plan: ${data.planType}`, {
    x: 72,
    y: 106,
    size: 9,
    font: bodyFont,
    color: warm,
  });

  const footer = 'The seal password is not stored by ULUMAE and cannot be recovered.';
  const footerWidth = bodyFont.widthOfTextAtSize(footer, 9);
  page.drawText(footer, {
    x: Math.max(60, (612 - footerWidth) / 2),
    y: 60,
    size: 9,
    font: bodyFont,
    color: warm,
  });

  return pdfDoc.save();
}

export async function downloadCertificate(
  data: CertificateData,
  fileName?: string
) {
  if (typeof window === 'undefined') {
    throw new Error('Certificate downloads can only be triggered in the browser.');
  }

  const bytes = await createCertificatePdf(data);
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || buildCertificateFilename(data);
  link.click();
  window.URL.revokeObjectURL(url);
}
