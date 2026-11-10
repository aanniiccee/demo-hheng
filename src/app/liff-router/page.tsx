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
  const [unauthorized, setUnauthorized] = useState(false);

  // ฟังก์ชันช่วยดึง Invite Code จาก URL หรือ liff.state
  const extractInviteCode = (): string => {
    let code = searchParams.get('code') || searchParams.get('invite_code');
    if (!code) {
      const liffState = searchParams.get('liff.state');
      if (liffState) {
        try {
          const decodedState = decodeURIComponent(liffState);
          const match = decodedState.match(/code=([^&]+)/i) || decodedState.match(/invite_code=([^&]+)/i);
          if (match && match[1]) {
            code = match[1];
          }
        } catch (e) {
          console.error("Error decoding liff.state:", e);
        }
      }
    }
    return code ? code.trim().toUpperCase() : '';
  };

  useEffect(() => {
    async function initLiff() {
      try {
        // 🚀 0. เช็กก่อนว่าเคยยืนยันตัวตนใน Session แล้วหรือยัง (ถ้ามีแล้ว ปล่อยผ่านยาวๆ)
        const verified = sessionStorage.getItem('admin_verified');
        const savedLineId = sessionStorage.getItem('admin_line_id');
        const currentGoto = searchParams.get("goto") || "/";
        const currentToken = searchParams.get("token") || "";

        if (verified === 'true' && savedLineId) {
          const targetParams = new URLSearchParams();
          if (currentToken) targetParams.set("token", currentToken);
          targetParams.set("admin_line_id", savedLineId);
          router.replace(`${currentGoto}?${targetParams.toString()}`);
          return;
        }

        // 1. ดึงข้อมูล LIFF_ID จาก API หลังบ้าน
        const configRes = await fetch("/api/config/liff-id");
        const configData = await configRes.json();
        const liffId = configData.liff_id;

        // 2. เริ่มต้นระบบ LIFF
        await window.liff.init({ liffId });

        // 3. ถ้ายังไม่ได้เข้าสู่ระบบ LINE ให้ส่งไปล็อกอิน
        if (!window.liff.isLoggedIn()) {
          sessionStorage.setItem("liff_goto", currentGoto);
          sessionStorage.setItem("liff_token", currentToken);

          const baseRouterUrl = `${window.location.origin}${window.location.pathname}`;
          const loginRedirectUrl = `${baseRouterUrl}?goto=${encodeURIComponent(currentGoto)}&token=${encodeURIComponent(currentToken)}`;

          window.liff.login({ redirectUri: loginRedirectUrl });
          return;
        }

        // 4. เข้าสู่ระบบสำเร็จ -> ดึง Profile ของ LINE
        const profile = await window.liff.getProfile();
        const inviteCode = extractInviteCode();

        // 5. 🌟 เรียก API ไปเช็คสิทธิ์ (ผ่าน FastAPI -> Google Apps Script -> Google Sheet)
        const verifyRes = await fetch('/api/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invite_code: inviteCode,
            line_user_id: profile.userId,
            admin_name: profile.displayName,
          }),
        });

        const result = await verifyRes.json();

        if (result.success && result.is_admin) {
          // บันทึก Session ยืนยันตัวตนสำเร็จ
          sessionStorage.setItem('admin_verified', 'true');
          sessionStorage.setItem("admin_line_id", profile.userId);
          sessionStorage.setItem("admin_name", profile.displayName);

          let savedGoto = searchParams.get("goto") || sessionStorage.getItem("liff_goto") || "/";
          let savedToken = searchParams.get("token") || sessionStorage.getItem("liff_token") || "";

          if (savedGoto.includes("liff-router")) {
            savedGoto = "/";
          }

          // เคลียร์เศษข้อมูลใน Session
          sessionStorage.removeItem("liff_goto");
          sessionStorage.removeItem("liff_token");

          // 6. เปลี่ยนหน้าไปยังเป้าหมาย
          const targetParams = new URLSearchParams();
          if (savedToken) targetParams.set("token", savedToken);
          targetParams.set("admin_line_id", profile.userId);

          router.replace(`${savedGoto}?${targetParams.toString()}`);
        } else {
          // ถ้าไม่มีสิทธิ์ หรือโค้ดไม่ถูกต้อง
          setUnauthorized(true);
        }

      } catch (err) {
        console.error(err);
        setErrorMsg("เกิดข้อผิดพลาดในการเชื่อมต่อระบบตรวจสอบสิทธิ์");
      }
    }

    if (typeof window !== "undefined") {
      initLiff();
    }
  }, [searchParams, router]);

  if (errorMsg) {
    return <div style={{ textAlign: "center", padding: "50px", color: "#de3e3e", fontWeight: "bold" }}>{errorMsg}</div>;
  }

  if (unauthorized) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "sans-serif", padding: "20px", textAlign: "center" }}>
        <h2 style={{ color: "#dc2626", marginBottom: "10px" }}>ไม่มีสิทธิ์เข้าถึงระบบ</h2>
        <p style={{ color: "#4b5563", fontSize: "14px", marginBottom: "20px" }}>
          บัญชี LINE ของคุณยังไม่ได้รับสิทธิ์ Admin หรือ Invite Code ไม่ถูกต้อง / ถูกใช้งานไปแล้ว
        </p>
        <button
          onClick={() => {
            if (window.liff) window.liff.closeWindow();
          }}
          style={{ padding: "10px 20px", backgroundColor: "#1f2937", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
        >
          ปิดหน้านี้
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh", fontFamily: "sans-serif", fontWeight: "bold" }}>
      กำลังตรวจสอบสิทธิ์การเข้าถึงระบบ...
    </div>
  );
}
