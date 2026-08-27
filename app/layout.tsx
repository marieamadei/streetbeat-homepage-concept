import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://marieamadei.github.io/streetbeat-homepage-concept/"),
  title: {
    default: "Streetbeat — Applied AI for what you're building",
    template: "%s",
  },
  description:
    "Independent working concept for Streetbeat's next website direction.",
  icons: {
    icon: "/brand/streetbeat-mark.svg",
    shortcut: "/brand/streetbeat-mark.svg",
  },
  openGraph: {
    title: "Streetbeat — Applied AI for what you're building",
    description: "Move faster. Use money and time better. Reduce risk.",
    type: "website",
    images: [{ url: "/og.png", width: 1678, height: 941, alt: "Streetbeat applied AI working concept" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Streetbeat — Applied AI for what you're building",
    description: "Move faster. Use money and time better. Reduce risk.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
