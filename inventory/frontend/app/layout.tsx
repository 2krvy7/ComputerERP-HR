import type { Metadata } from "next";
import AuthTokenHandler from "@/components/auth-token-handler";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inventory Management System",
  description: "ComputerERP Inventory System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col">
        <AuthTokenHandler>
          {children}
        </AuthTokenHandler>
      </body>
    </html>
  );
}