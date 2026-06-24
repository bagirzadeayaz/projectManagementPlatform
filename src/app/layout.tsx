import type { ReactNode } from "react";

import { AuthProvider } from "../hooks/useAuth";
import "./globals.css";

export const metadata = {
  title: "Project Auth",
  description: "Client authentication",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
