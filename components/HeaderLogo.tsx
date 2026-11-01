"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Home aur login pe poora logo (tagline ke saath) page mein dikhta hai, toh header mein dobara nahi
export default function HeaderLogo() {
  const path = usePathname();
  if (path === "/" || path === "/login") return <span />;
  return (<Link href="/" aria-label="Quicky home">
    <img src="/logo.webp" alt="Quicky" width={124} height={33} decoding="async" />
  </Link>);
}
