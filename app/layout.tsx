import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin-ext"] });

export const metadata: Metadata = {
  title: "FixIT Helpdesk",
  description: "Helpdesk IT dla sklepów i biura Bagietki"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body className={inter.className}>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem("fixit-theme");const d=window.matchMedia("(prefers-color-scheme: dark)").matches;if(t==="dark"||(!t&&d))document.documentElement.classList.add("dark")}catch{}`
          }}
        />
        {children}
      </body>
    </html>
  );
}
