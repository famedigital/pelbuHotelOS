/**
 * Generate Pelbu Suites letterhead Word document.
 * Usage: node scripts/create-pelbu-letterhead.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
  VerticalAlign,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const logoPath = path.join(
  root,
  "design",
  "brand",
  "pelbu-logo-icon-3d-light.png",
);
const outPath = path.join(root, "docs", "Pelbu-Suites-Letterhead.docx");

// Brand-aligned colours (espresso + gold accent from Pelbu system)
const INK = "1C1410";
const MUTED = "5C4E42";
const ACCENT = "8B6914";
const RULE = "C4A35A";

const logoBuffer = fs.readFileSync(logoPath);

const brandLine = new Paragraph({
  spacing: { after: 40 },
  children: [
    new TextRun({
      text: "PELBU SUITES",
      bold: true,
      font: "Georgia",
      size: 28, // 14pt
      color: INK,
      characterSpacing: 80,
    }),
  ],
});

const tagline = new Paragraph({
  spacing: { after: 120 },
  children: [
    new TextRun({
      text: "Olakha · Thimphu, Bhutan",
      font: "Calibri",
      size: 18, // 9pt
      color: MUTED,
      italics: true,
    }),
  ],
});

const contactLine = new Paragraph({
  spacing: { after: 60 },
  children: [
    new TextRun({
      text: "www.pelbusuites.bt",
      font: "Calibri",
      size: 18,
      color: ACCENT,
    }),
    new TextRun({
      text: "  ·  ",
      font: "Calibri",
      size: 18,
      color: MUTED,
    }),
    new TextRun({
      text: "+975-17613410",
      font: "Calibri",
      size: 18,
      color: INK,
    }),
    new TextRun({
      text: "  (WhatsApp & phone)",
      font: "Calibri",
      size: 16,
      color: MUTED,
    }),
  ],
});

const emailLine = new Paragraph({
  spacing: { after: 80 },
  children: [
    new TextRun({
      text: "pelbusuites@gmail.com",
      font: "Calibri",
      size: 18,
      color: INK,
    }),
  ],
});

const goldRule = new Paragraph({
  border: {
    bottom: {
      color: RULE,
      space: 1,
      style: BorderStyle.SINGLE,
      size: 12,
    },
  },
  spacing: { after: 200 },
  children: [],
});

const doc = new Document({
  creator: "Pelbu Suites",
  title: "Pelbu Suites",
  description: "Pelbu Suites letterhead — Olakha, Thimphu",
  styles: {
    default: {
      document: {
        styles: [
          {
            id: "Normal",
            name: "Normal",
            run: {
              font: "Calibri",
              size: 22, // 11pt
              color: INK,
            },
            paragraph: {
              spacing: { after: 160, line: 276 },
            },
          },
        ],
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: 720, // 0.5"
            right: 720,
            bottom: 720,
            left: 720,
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              spacing: { after: 0 },
              verticalAlign: VerticalAlign.CENTER,
              tabStops: [
                {
                  type: TabStopType.LEFT,
                  position: 1400,
                },
              ],
              children: [
                new ImageRun({
                  type: "png",
                  data: logoBuffer,
                  transformation: {
                    width: 72,
                    height: 72,
                  },
                  altText: {
                    title: "Pelbu Suites",
                    description: "Pelbu Suites logo — endless knot mark",
                    name: "pelbu-logo",
                  },
                }),
                new TextRun({ text: "\t" }),
                new TextRun({
                  text: "PELBU SUITES",
                  bold: true,
                  font: "Georgia",
                  size: 32,
                  color: INK,
                  characterSpacing: 100,
                }),
              ],
            }),
            new Paragraph({
              spacing: { before: 60, after: 40 },
              indent: { left: 1400 },
              children: [
                new TextRun({
                  text: "www.pelbusuites.bt",
                  font: "Calibri",
                  size: 18,
                  color: ACCENT,
                }),
                new TextRun({
                  text: "   ·   ",
                  font: "Calibri",
                  size: 18,
                  color: MUTED,
                }),
                new TextRun({
                  text: "+975-17613410",
                  font: "Calibri",
                  size: 18,
                  color: INK,
                }),
                new TextRun({
                  text: " (WhatsApp & phone)",
                  font: "Calibri",
                  size: 16,
                  color: MUTED,
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 80 },
              indent: { left: 1400 },
              children: [
                new TextRun({
                  text: "pelbusuites@gmail.com",
                  font: "Calibri",
                  size: 18,
                  color: INK,
                }),
                new TextRun({
                  text: "   ·   Olakha, Thimphu",
                  font: "Calibri",
                  size: 18,
                  color: MUTED,
                }),
              ],
            }),
            goldRule,
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              border: {
                top: {
                  color: RULE,
                  space: 8,
                  style: BorderStyle.SINGLE,
                  size: 6,
                },
              },
              alignment: AlignmentType.CENTER,
              spacing: { before: 80 },
              children: [
                new TextRun({
                  text: "Pelbu Suites  ·  www.pelbusuites.bt  ·  +975-17613410  ·  pelbusuites@gmail.com",
                  font: "Calibri",
                  size: 14,
                  color: MUTED,
                }),
              ],
            }),
          ],
        }),
      },
      children: [
        brandLine,
        tagline,
        contactLine,
        emailLine,
        goldRule,
        new Paragraph({
          spacing: { before: 200, after: 200 },
          children: [
            new TextRun({
              text: "Dear ",
              font: "Calibri",
              size: 22,
              color: INK,
            }),
            new TextRun({
              text: "[Name]",
              font: "Calibri",
              size: 22,
              color: MUTED,
              italics: true,
            }),
            new TextRun({
              text: ",",
              font: "Calibri",
              size: 22,
              color: INK,
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "[Start your letter here.]",
              font: "Calibri",
              size: 22,
              color: MUTED,
              italics: true,
            }),
          ],
        }),
        new Paragraph({
          spacing: { before: 280, after: 80 },
          children: [
            new TextRun({
              text: "Yours sincerely,",
              font: "Calibri",
              size: 22,
              color: INK,
            }),
          ],
        }),
        new Paragraph({
          spacing: { before: 400, after: 40 },
          children: [
            new TextRun({
              text: "[Your name]",
              font: "Calibri",
              size: 22,
              color: MUTED,
              italics: true,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Pelbu Suites",
              font: "Calibri",
              size: 20,
              color: MUTED,
            }),
          ],
        }),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buffer);
console.log(`Wrote ${outPath}`);
