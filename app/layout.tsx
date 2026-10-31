import "./globals.css";
import Link from "next/link";
import EnablePush from "@/components/EnablePush";
import HeaderNav from "@/components/HeaderNav";

export const metadata = {
  title: "Quicky",
  description: "Groceries & More. Delivered Fast.",
  manifest: "/manifest.json",
  themeColor: "#045F2A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>
    <header>
      <Link href="/" aria-label="Quicky home"><img src="/logo.webp" alt="Quicky" width={124} height={33} decoding="async" /></Link>
      <HeaderNav />
    </header>
    <EnablePush />
    <main>{children}</main>
  </body></html>);
}
