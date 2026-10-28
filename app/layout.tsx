import "./globals.css";
export const metadata = { title: "Quicky", description: "Groceries in minutes", manifest: "/manifest.json", themeColor: "#0F766E" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>
    <header><b>⚡ Quicky</b><small>Groceries in minutes</small></header>
    <main>{children}</main></body></html>);
}
