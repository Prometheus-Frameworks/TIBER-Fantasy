import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TIBER · Trade Compare",
  description: "Inspect selected players, their evidence and the questions that remain. TIBER prepares the decision; the manager makes it.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
