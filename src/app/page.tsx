// src/app/page.tsx
"use client";

export const dynamic = "force-dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Repeat, CreditCard, PiggyBank, Wrench, PackageCheck } from "lucide-react";

export default function HomePage() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [adminLineId, setAdminLineId] = useState("");

  useEffect(() => {
    // 1. ดึงค่าจาก URL Query Params ก่อน
    const urlToken = searchParams.get("token") || "";
    const urlAdminLineId = searchParams.get("admin_line_id") || "";

    // 2. ถ้าใน URL มี admin_line_id ให้บันทึกลง sessionStorage ไว้ด้วยเพื่อความเสถียร
    if (urlAdminLineId) {
      sessionStorage.setItem("admin_line_id", urlAdminLineId);
    }

    // 3. เซ็ต State โดยเช็กทั้งจาก URL หรือดึงจาก Session เผื่อกรณี URL ไม่มี
    setToken(urlToken);
    setAdminLineId(urlAdminLineId || sessionStorage.getItem("admin_line_id") || "");
  }, [searchParams]);

  // สร้าง Helper ฟังก์ชันต่อสายพารามิเตอร์แบบฉลาด
  const getQueryString = () => {
    const params = new URLSearchParams();
    if (token) params.set("token", token);
    if (adminLineId) params.set("admin_line_id", adminLineId);
    const str = params.toString();
    return str ? `?${str}` : "";
  };

  return (
    <div style={{ marginTop: "100px", fontFamily: "sans-serif" }}>
      <h2 style={{ textAlign: "center", padding: "10px" }}>HHeng</h2>

      <div className="nav-container" style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "200px", margin: "0 auto" }}>
        
        {/* ปุ่มระบบต่อดอก */}
        <Link href={`/pawn${getQueryString()}`} className="nav-button">
          <Repeat size={20} />
          <span>ระบบต่อดอก</span>
        </Link>

        {/* ปุ่มระบบผ่อนสินค้า */}
        <Link href={`/installment${getQueryString()}`} className="nav-button">
          <CreditCard size={20} />
          <span>ระบบผ่อนสินค้า</span>
        </Link>

        {/* ปุ่มระบบมัดจำ */}
        <Link href={`/deposit${getQueryString()}`} className="nav-button">
          <PiggyBank size={20} />
          <span>ระบบมัดจำ</span>
        </Link>

        <Link href={`/repair${getQueryString()}`} className="nav-button">
          <Wrench size={20} />
          <span>ระบบงานซ่อม</span>
        </Link>

        <Link href={`/tracking${getQueryString()}`} className="nav-button">
          <PackageCheck size={20} />
          <span>ระบบติดตามพัสดุ</span>
        </Link>
      </div>
    </div>
  );
}
