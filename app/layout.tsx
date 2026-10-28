import "./globals.css";
export const metadata = { title: "Quicky", description: "Groceries in minutes", manifest: "/manifest.json", themeColor: "#0F766E" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>
    <header><b><a href="/" style={{ color: "#fff", textDecoration: "none" }}>⚡ Quicky</a></b>
      <span><a href="/shop" style={{ color: "#fff" }}>Orders</a> · <a href="/shop/inventory" style={{ color: "#fff" }}>Inventory</a></span></header>
    <main>{children}</main></body></html>);
}
