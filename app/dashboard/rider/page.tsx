import { redirect } from "next/navigation";

// Old link. The fixed permalink for this dashboard is /rider
export default function Page() {
  redirect("/rider");
}
