import { redirect } from "next/navigation";

export default function ReserveRedirect() {
  redirect("/erp/reservations?new=1");
}
