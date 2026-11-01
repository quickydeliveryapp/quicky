import "./globals.css";
import { Montserrat } from "next/font/google";
import EnablePush from "@/components/EnablePush";
import Header from "@/components/Header";
import LocationModal from "@/components/LocationModal";
import CartDrawer from "@/components/CartDrawer";
import BottomNav from "@/components/BottomNav";
import LoginModal from "@/components/LoginModal";

// Montserrat: build time pe self-host hota hai (runtime pe Google call nahi).
const font = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font" });

export const metadata = {
  title: "Quicky",
  description: "Groceries & More. Delivered Fast.",
  manifest: "/manifest.json",
  themeColor: "#045F2A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className={font.variable}>
    <Header />
    <EnablePush />
    <LoginModal />
    <LocationModal />
    <CartDrawer />
    <main>{children}</main>
    <BottomNav />
  </body></html>);
}
