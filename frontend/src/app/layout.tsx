import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/lib/toast-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ShortcutsProvider } from "@/lib/shortcuts-context";
import { ShortcutsHelpDialog } from "@/components/layout/ShortcutsHelpDialog";

export const metadata: Metadata = {
  title: "Route53 Clone",
  description: "A UI/UX clone of the AWS Route53 console",
};

// Applies the persisted theme before React hydrates, to avoid a light/dark flash.
const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('r53_theme');
    var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <ShortcutsProvider>
                {children}
                <ShortcutsHelpDialog />
              </ShortcutsProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
