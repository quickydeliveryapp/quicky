import "./globals.css";
import { Lato } from "next/font/google";
import EnablePush from "@/components/EnablePush";
import HeaderNav from "@/components/HeaderNav";
import HeaderLogo from "@/components/HeaderLogo";

// Lato: Blinkit ke Okra font ka free, open-license alternative. Build time pe self-host hota hai (runtime pe Google call nahi).
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--font" });

export const metadata = {
  title: "Quicky",
  description: "Groceries & More. Delivered Fast.",
  manifest: "/manifest.json",
  themeColor: "#045F2A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className={lato.variable}>
    <header>
      <HeaderLogo />
      <HeaderNav />
    </header>
    <EnablePush />
    <main>{children}</main>
  </body></html>);
}
