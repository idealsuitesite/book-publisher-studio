import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

/* Geist and Geist_Mono were imported here and bound to --font-geist-sans/--font-geist-mono,
 * but nothing ever rendered in them: globals.css sets `body { font-family: Arial, … }`, and
 * no component used the font-sans/font-mono classes that would have applied the variables.
 * Two font families were downloaded on every page load and never displayed a character.
 *
 * Removed rather than adopted (Sprint 9 Commit 1, UI_FOUNDATION.md §5): adopting Geist would
 * change every glyph on every screen, which Decision 3 forbids before Commit 8. Choosing this
 * product's real typeface is a design decision and belongs in the restyle commit. Removing
 * the waste is appearance-neutral and correct now. */

export const metadata: Metadata = {
  title: "Book Publisher Studio",
  description: "Import, review, and export manuscripts to PDF, DOCX, and EPUB.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
