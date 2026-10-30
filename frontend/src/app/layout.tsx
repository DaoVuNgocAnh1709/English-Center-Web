import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { SiteFrame } from "@/components/site-frame";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-be-vietnam-pro",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://example.com"),
  title: { default: "Bright Path English | Trung tâm tiếng Anh", template: "%s | Bright Path English" },
  description: "Môi trường tiếng Anh thân thiện cho học sinh tại Hà Nội và Hưng Yên. Nội dung hiện là dữ liệu demo chờ trung tâm xác nhận.",
  openGraph: { title: "Bright Path English", description: "Học chắc nền tảng, tự tin giao tiếp.", type: "website", locale: "vi_VN" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={beVietnamPro.variable}>
        <SiteFrame>{children}</SiteFrame>
      </body>
    </html>
  );
}

