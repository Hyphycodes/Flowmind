import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import "@xyflow/react/dist/style.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flowmind — Visual AI Agent Pipeline Builder",
  description:
    "Build AI systems you can see, test, and export. Describe an agent pipeline, run it with real Claude, watch data fill output tables, preview a UI, and export runnable files.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrument.variable} h-full`}
    >
      <body className="h-full">{children}</body>
    </html>
  );
}
