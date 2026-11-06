import { redirect } from "next/navigation";

// Old link. The fixed permalink for this dashboard is /admin
export default function Page() {
  redirect("/admin");
}
