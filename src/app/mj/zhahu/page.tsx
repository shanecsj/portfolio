import { redirect } from "next/navigation";

/** The 诈胡 board now lives in a tab on /mj; keep old links working. */
export default function ZhaHuPage() {
  redirect("/mj?tab=zhahu");
}
