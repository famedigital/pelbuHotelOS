import { MenuPrintAutoPrint } from "@/components/erp/menu/print/MenuPrintAutoPrint";
import { MenuPrintBrochure } from "@/components/erp/menu/print/MenuPrintBrochure";
import { MenuPrintClassic } from "@/components/erp/menu/print/MenuPrintClassic";
import { MenuPrintEditorial } from "@/components/erp/menu/print/MenuPrintEditorial";
import { MenuPrintMagazine } from "@/components/erp/menu/print/MenuPrintMagazine";
import { MenuPrintMosaic } from "@/components/erp/menu/print/MenuPrintMosaic";
import { MenuPrintToolbar } from "@/components/erp/menu/print/MenuPrintToolbar";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { thimphuToday } from "@/lib/erp-lists";
import { loadAllMenuItems } from "@/lib/menu-admin";
import {
  getMenuPrintTemplate,
  groupPrintMenu,
  isMenuPrintTemplateId,
  type PrintMenuItem,
} from "@/lib/menu-print-templates";
import { loadPropertyOutlets } from "@/lib/outlets";
import {
  loadProperty,
  resolveActivePropertyId,
} from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Print menu · sheet | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MenuPrintTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ template: string }>;
  searchParams: Promise<{ outlet?: string; print?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { template: templateRaw } = await params;
  const sp = await searchParams;
  if (!isMenuPrintTemplateId(templateRaw)) notFound();

  const template = getMenuPrintTemplate(templateRaw);
  const outletParam = sp.outlet?.trim() || "all";
  const autoPrint = sp.print === "1";

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const [property, outlets, items] = await Promise.all([
    loadProperty(admin, propertyId),
    loadPropertyOutlets(admin, propertyId),
    loadAllMenuItems(admin),
  ]);

  const { data: extras } = await admin
    .from("menu_items")
    .select("id, name_dz")
    .eq("property_id", propertyId);
  const dzMap = new Map(
    (extras ?? []).map((r) => [r.id as string, (r.name_dz as string | null) ?? null]),
  );

  const printItems: PrintMenuItem[] = items
    .filter((i) => i.is_available !== false && !i.sold_out)
    .map((i) => ({
      id: i.id,
      outlet: i.outlet,
      category: i.category,
      name: i.name,
      name_dz: dzMap.get(i.id) ?? null,
      description: i.description,
      price_btn: i.price_btn,
      gst_applicable: i.gst_applicable,
      is_popular: i.is_popular,
      image_src: i.image_src,
    }));

  const sections = groupPrintMenu(printItems, outletParam);
  const outletLabel =
    outletParam === "all"
      ? "Full menu"
      : (outlets.find((o) => o.code === outletParam)?.name ?? outletParam);
  const propertyName = property?.name ?? "Pelbu Suites";
  const asOf = thimphuToday();

  const backQs =
    outletParam !== "all" ? `?outlet=${encodeURIComponent(outletParam)}` : "";

  const common = {
    propertyName,
    outletLabel,
    sections,
    asOf,
  };

  return (
    <div className="menu-print-root min-h-screen bg-[#1a1410] print:bg-white">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,400;1,500;1,600&family=Outfit:wght@400;500;600;700&display=swap"
      />
      <MenuPrintToolbar
        title={`${template.name} · ${outletLabel}`}
        meta={`${template.paper} · ${sections.reduce((n, s) => n + s.items.length, 0)} items · Chrome: Print → PDF · background graphics ON`}
        backHref={`/erp/menu/print${backQs}`}
        autoPrint={autoPrint}
      />
      <MenuPrintAutoPrint enabled={autoPrint} />

      <div className="menu-print-stage px-3 pb-16 pt-24 print:p-0 print:pt-0">
        {sections.length === 0 ? (
          <p className="mx-auto max-w-md rounded-lg border border-amber-500/40 bg-amber-950/40 p-6 text-center text-sm text-amber-100 print:text-black">
            No available items for this outlet. Add dishes under Menu catalog.
          </p>
        ) : templateRaw === "classic" ? (
          <MenuPrintClassic {...common} />
        ) : templateRaw === "magazine" ? (
          <MenuPrintMagazine {...common} />
        ) : templateRaw === "editorial" ? (
          <MenuPrintEditorial {...common} />
        ) : templateRaw === "mosaic" ? (
          <MenuPrintMosaic {...common} />
        ) : (
          <MenuPrintBrochure {...common} />
        )}
      </div>

      <style>{`
        @media print {
          @page {
            size: ${template.paper === "A5" ? "A5" : "A4"} portrait;
            margin: ${template.paper === "A5" ? "8mm" : "10mm"};
          }
          body { background: white !important; }
          .menu-print-toolbar { display: none !important; }
          .menu-print-stage { padding: 0 !important; }
          .menu-print-sheet {
            width: 100% !important;
            max-width: none !important;
            min-height: auto !important;
            box-shadow: none !important;
          }
          .erp, [data-slot="sidebar"], .sidebar { display: none !important; }
        }
        .menu-print-sheet.classic,
        .menu-print-sheet.magazine,
        .menu-print-sheet.editorial,
        .menu-print-sheet.mosaic {
          width: min(210mm, 100%);
          min-height: 297mm;
        }
        .menu-print-sheet.brochure {
          width: min(148mm, 100%);
          min-height: 210mm;
        }
      `}</style>
    </div>
  );
}
