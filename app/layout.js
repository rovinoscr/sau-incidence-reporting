import "./globals.css";

export const metadata = {
  title: "Santa Ana Urbano Incidence Reporting",
  description: "Public reporting form and admin dashboard for Santa Ana Urbano incidences.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
