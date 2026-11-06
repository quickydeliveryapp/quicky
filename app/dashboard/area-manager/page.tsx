import { redirect } from "next/navigation";

// Old link. The fixed permalink for this dashboard is /areamanager
export default function Page() {
  redirect("/areamanager");
}
