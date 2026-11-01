import Link from "next/link";

// Compact logo (5 KB image) + neeche live-text tagline: chhota, saaf aur extra image load nahi
export default function HeaderLogo() {
  return (<Link href="/" className="brand" aria-label="Quicky: Groceries & More. Delivered Fast.">
    <img src="/logo.webp" alt="" width={128} height={34} decoding="async" />
    <span className="tag">Groceries &amp; More. <b>Delivered Fast.</b></span>
  </Link>);
}
