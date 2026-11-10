import { useCallback, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  DepartmentPrintModal,
  type PassKind,
} from "./DepartmentPrintModal";

const VALID: PassKind[] = ["kitchen", "fb", "hk", "fo"];

/** Full-page Print Studio — pass synced to `/print/:pass` · `?stay=` for FO reg. */
export function PrintStudioPage() {
  const navigate = useNavigate();
  const { pass } = useParams<{ pass?: string }>();
  const [search] = useSearchParams();
  const stayId = search.get("stay");

  const initial: PassKind = useMemo(() => {
    if (stayId) return "fo";
    if (pass && VALID.includes(pass as PassKind)) return pass as PassKind;
    return "kitchen";
  }, [pass, stayId]);

  useEffect(() => {
    if (stayId) {
      if (pass !== "fo") {
        navigate(`/print/fo?stay=${encodeURIComponent(stayId)}`, {
          replace: true,
        });
      }
      return;
    }
    if (!pass || !VALID.includes(pass as PassKind)) {
      navigate(`/print/${initial}`, { replace: true });
    }
  }, [pass, initial, navigate, stayId]);

  const onPassChange = useCallback(
    (next: PassKind) => {
      // Drop stay query when leaving FO so format defaults re-apply cleanly
      if (next === "fo" && stayId) {
        navigate(`/print/fo?stay=${encodeURIComponent(stayId)}`, {
          replace: true,
        });
        return;
      }
      navigate(`/print/${next}`, { replace: true });
    },
    [navigate, stayId],
  );

  return (
    <DepartmentPrintModal
      open
      variant="page"
      initialPass={initial}
      initialStayId={stayId}
      onPassChange={onPassChange}
      onClose={() => navigate(-1)}
    />
  );
}
