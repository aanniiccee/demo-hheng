// src/app/liff-router/page.tsx
"use client";

export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

declare global {
  interface Window { liff: any; }
}

export default function LiffRouter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function initLiff() {
      try {
        // 1. ดึงข้อมูล LIFF_ID จาก API หลังบ้าน (FastAPI เดิมของคุณ)
        const configRes = await fetch("/api/config/liff-id");
        const configData = await configRes.json();
        const liffId = configData.liff_id;

        // 2. เริ่มต้นระบบ LIFF
        await window.liff.init({ liffId });

        const currentGoto = searchParams.get("goto") || "/";
        const currentToken = searchParams.get("token") || "";

        // 3. ถ้ายังไม่ได้เข้าสู่ระบบ LINE ให้ส่งไปล็อกอิน
        if (!window.liff.isLoggedIn()) {
          sessionStorage.setItem("liff_goto", currentGoto);
          sessionStorage.setItem("liff_token", currentToken);

          const baseRouterUrl = `${window.location.origin}${window.location.pathname}`;
          const loginRedirectUrl = `${baseRouterUrl}?goto=${encodeURIComponent(currentGoto)}&token=${encodeURIComponent(currentToken)}`;

          window.liff.login({ redirectUri: loginRedirectUrl });
          return;
        }

        // 4. เข้าสู่ระบบสำเร็จ -> ดึง Profile
        const profile = await window.liff.getProfile();
        sessionStorage.setItem("admin_line_id", profile.userId);
        sessionStorage.setItem("admin_name", profile.displayName);

        // 5. เตรียมย้ายไปหน้าปลายทาง
        let savedGoto = searchParams.get("goto") || sessionStorage.getItem("liff_goto") || "/";
        let savedToken = searchParams.get("token") || sessionStorage.getItem("liff_token") || "";

        if (savedGoto.includes("liff-router")) {
          savedGoto = "/";
        }

        // เคลียร์เศษขยะออก
        sessionStorage.removeItem("liff_goto");
        sessionStorage.removeItem("liff_token");

        // 6. เปลี่ยนหน้าแบบสมูทด้วย Next Router (ไม่ต้อง Refresh ล้างจอแบบ window.location)
        const targetParams = new URLSearchParams();
        if (savedToken) targetParams.set("token", savedToken);
        targetParams.set("admin_line_id", profile.userId);

        router.replace(`${savedGoto}?${targetParams.toString()}`);

      } catch (err) {
        console.error(err);
        setErrorMsg("เกิดข้อผิดพลาดในการเชื่อมต่อระบบตรวจสอบสิทธิ์");
      }
    }

    // มั่นใจว่าโหลด Script LIFF แล้วค่อยรัน
    if (typeof window !== "undefined") {
      initLiff();
    }
  }, [searchParams, router]);

  if (errorMsg) {
    return <div style={{ textAlign: "center", padding: "50px", color: "#de3e3e", fontWeight: "bold" }}>{errorMsg}</div>;
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "sans-serif", fontSize: "1.5rem", fontWeight: "bold" }}>
      กำลังตรวจสอบสิทธิ์การเข้าถึงระบบ HHeng...
    </div>
  );
}
