import { redirect } from "next/navigation";

// Orders now live in the Orders tab of the area manager dashboard.
export default function AreaManagerOrdersRedirect() {
  redirect("/areamanager");
}
