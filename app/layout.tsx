import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Persona AI",
  description: "Chat with an AI simulating Hitesh Choudhary or Piyush Garg",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
