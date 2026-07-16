"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import "./globals.css"; // สไตล์รวมของระบบ

// 🌟 1. แยก Logic ตรวจสอบสิทธิ์ที่ใช้ useSearchParams ออกมาเป็น Component ย่อย
function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // 1. ยกเว้นหน้า liff-router ไม่ต้องตรวจสิทธิ์ซ้ำซ้อน
    if (pathname === "/liff-router") {
      setIsAuthorized(true);
      return;
    }

    // 2. ตรวจสอบ Session การล็อกอินของแอดมิน
    const adminName = sessionStorage.getItem("admin_name");
    const adminLineId = sessionStorage.getItem("admin_line_id");

    if (!adminName || !adminLineId) {
      // ดึง query params เดิมติดไปด้วย
      const params = new URLSearchParams(searchParams.toString());
      params.set("goto", pathname);
      
      // ดีดไปหน้า liff-router แบบ Smooth
      router.replace(`/liff-router?${params.toString()}`);
    } else {
      setIsAuthorized(true);
    }
  }, [pathname, searchParams, router]);

  return isAuthorized ? (
    <>{children}</>
  ) : (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh", fontFamily: "sans-serif", fontWeight: "bold" }}>
      กำลังตรวจสอบสิทธิ์การเข้าถึงระบบ...
    </div>
  );
}

// 🌟 2. RootLayout หลัก: จะสะอาดและไม่เรียกใช้ useSearchParams โดยตรง
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>HHeng System</title>
      </head>
      <body>
        {/* โหลด LINE LIFF SDK จาก CDN */}
        <Script 
          src="https://static.line-scdn.net/liff/edge/2/sdk.js" 
          strategy="beforeInteractive"
        />
        
        {/* 🌟 3. ครอบด้วย Suspense และ AuthGuard ตรงนี้ทีเดียวจบทุกหน้า */}
        <Suspense fallback={
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh", fontFamily: "sans-serif", fontWeight: "bold" }}>
            กำลังโหลดโครงสร้างระบบ...
          </div>
        }>
          <AuthGuard>{children}</AuthGuard>
        </Suspense>
      </body>
    </html>
  );
}
