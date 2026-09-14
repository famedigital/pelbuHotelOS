import "server-only";
import ExcelJS from "exceljs";
import { toCsv, csvEscape } from "@/lib/accounting/csv";

export { toCsv, csvEscape };

export async function buildWorkbook(opts: {
  title: string;
  propertyName: string;
  from: string;
  to: string;
  sheets: Array<{
    name: string;
    header: string[];
    rows: (string | number | null | undefined)[][];
  }>;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pelbu Suites";
  workbook.created = new Date();

  for (const sheet of opts.sheets) {
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31));
    ws.addRow([opts.title]);
    ws.addRow([opts.propertyName]);
    ws.addRow([`Period: ${opts.from} to ${opts.to}`]);
    ws.addRow([]);
    ws.addRow(sheet.header);
    const headerRow = ws.lastRow;
    if (headerRow) {
      headerRow.font = { bold: true };
      ws.autoFilter = {
        from: { row: headerRow.number, column: 1 },
        to: { row: headerRow.number, column: sheet.header.length },
      };
      ws.views = [{ state: "frozen", ySplit: headerRow.number }];
    }
    for (const row of sheet.rows) {
      ws.addRow(row.map((cell) => (cell == null ? "" : cell)));
    }
    ws.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        const len = String(cell.value ?? "").length;
        if (len > max) max = Math.min(len, 40);
      });
      col.width = max + 2;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
