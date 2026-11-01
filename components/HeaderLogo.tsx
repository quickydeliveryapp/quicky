import Link from "next/link";

// Logo image mein tagline pehle se hai, isliye sirf image. Ratio 335:112 locked, stretch nahi hoga.
export default function HeaderLogo() {
  return (<Link href="/" className="brand" aria-label="Quicky: Groceries & More. Delivered Fast.">
    <img src="/logo-nav.webp" alt="Quicky" width={168} height={56} decoding="async" />
  </Link>);
}
