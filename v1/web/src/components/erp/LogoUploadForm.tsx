"use client";

import { setPropertyLogo } from "@/app/actions/erp-settings";
import { CloudinaryPicker } from "@/components/erp/CloudinaryPicker";
import { Button } from "@/components/ui/button";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { ImagePlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function LogoUploadForm({
  propertyId,
  currentLogoPublicId,
}: {
  propertyId: string;
  currentLogoPublicId: string | null;
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const previewUrl = currentLogoPublicId
    ? cloudinaryUrl(currentLogoPublicId, { width: 240, crop: "fit" })
    : null;

  function save(publicId: string | null) {
    startTransition(async () => {
      const result = await setPropertyLogo(propertyId, publicId);
      if (result.ok) {
        toast.success(result.message ?? "Logo updated");
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not update logo.");
      }
    });
  }

  return (
    <div className="erp space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-20 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Property logo"
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="px-2 text-center text-[11px] text-muted-foreground">
              No logo
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={pending}
              className="h-10"
            >
              <ImagePlusIcon />
              {currentLogoPublicId ? "Change logo" : "Choose logo"}
            </Button>
            {currentLogoPublicId ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 text-destructive hover:bg-destructive/10"
                onClick={() => save(null)}
                disabled={pending}
              >
                Remove
              </Button>
            ) : null}
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {currentLogoPublicId ?? "Not set"}
          </p>
          <p className="text-xs text-muted-foreground">
            Opens the Cloudinary media gallery — browse existing brand assets or
            upload a new file. Used on the desk header and printed documents.
          </p>
        </div>
      </div>

      <CloudinaryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={save}
        uploadFolder="pelbu/brand"
        title="Hotel logo"
        description="Pick a logo from Cloudinary or upload a new one. Square or wide marks both work — documents scale it to fit."
      />
    </div>
  );
}
