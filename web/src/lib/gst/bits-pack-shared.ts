export type BitsGstPack = {
  periodMonth: string;
  fieldA: number;
  fieldB: number;
  fieldC: number;
  fieldD: number;
  fieldE: number;
  incomeSchedule: {
    date: string;
    description: string;
    taxableBase: number;
    gst: number;
    total: number;
  }[];
  expenseSchedule: {
    date: string;
    vendor: string;
    tpn: string;
    description: string;
    taxableBase: number;
    gst: number;
    total: number;
  }[];
};

export function bitsCopyLines(pack: BitsGstPack): string[] {
  return [
    `BITS GST · ${pack.periodMonth.slice(0, 7)}`,
    `A · Taxable sales: ${pack.fieldA}`,
    `B · GST output: ${pack.fieldB}`,
    `C · Taxable purchases: ${pack.fieldC}`,
    `D · GST input: ${pack.fieldD}`,
    `E · Net payable: ${pack.fieldE}`,
  ];
}
