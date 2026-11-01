import "./globals.css";
import HeaderLogo from "@/components/HeaderLogo";
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
      <HeaderLogo />
      <HeaderNav />
    </header>
    <EnablePush />
    <main>{children}</main>
  </body></html>);
}
