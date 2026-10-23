"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

export type ErpCrumb = {
  label: string;
  href?: string;
};

/** Compact premium trail for desk hubs (Bills / Folio / Rates). */
export function ErpBreadcrumb({
  items,
  className,
}: {
  items: ErpCrumb[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <Breadcrumb className={cn("max-md:hidden", className)}>
      <BreadcrumbList className="text-xs">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              {i > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {last || !item.href ? (
                  <BreadcrumbPage className="max-w-[14rem] truncate font-medium">
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      href={item.href}
                      className="max-w-[10rem] truncate"
                    >
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
