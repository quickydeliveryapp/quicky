import { redirect } from "next/navigation";

// Old link. The fixed permalink for this dashboard is /shop
export default function Page() {
  redirect("/shop");
}
