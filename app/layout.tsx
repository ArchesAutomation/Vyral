import type { Metadata } from "next";
import "./globals.css";
import "../vendor/nordify/liquid-glass.css";
export const metadata: Metadata = {
  title: "Vyral — Creative OS",
  description:
    "Turn inspiration into original content. Test what connects. Create what comes next.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

