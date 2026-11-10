import { CATALOG_PACKAGES, type PackageCode } from "@/lib/pricing-catalog";

/** Whether an ERP module is allowed for a package code. */
export function packageAllows(
  packageCode: string | null | undefined,
  feature: keyof (typeof CATALOG_PACKAGES)[0]["featureFlags"],
): boolean {
  const code = (packageCode ?? "classic") as PackageCode;
  const pkg = CATALOG_PACKAGES.find((p) => p.code === code);
  if (!pkg) return true;
  return Boolean(pkg.featureFlags[feature]);
}
