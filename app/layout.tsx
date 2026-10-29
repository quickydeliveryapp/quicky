import "./globals.css";
import EnablePush from "@/components/EnablePush";
import HeaderNav from "@/components/HeaderNav";
export const metadata = { title: "Quicky", description: "Groceries in minutes", manifest: "/manifest.json", themeColor: "#0F766E" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>
    <header><b><a href="/" style={{ color: "#fff", textDecoration: "none" }}>⚡ Quicky</a></b><HeaderNav /></header>
    <EnablePush />
    <main>{children}</main></body></html>);
}
