// src/app/page.tsx
"use client";

export const dynamic = "force-dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Repeat, CreditCard } from "lucide-react"; // ใช้ lucide-react สำหรับ Next.js

export default function HomePage() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [adminLineId, setAdminLineId] = useState("");

  useEffect(() => {
    setToken(searchParams.get("token") || "");
    setAdminLineId(sessionStorage.getItem("admin_line_id") || "");
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
      </div>

      <style jsx>{`
        .nav-button {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          background-color: #f3f4f6;
          color: #1f2937;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        .nav-button:hover {
          background-color: #e5e7eb;
          color: #000000;
        }
      `}</style>
    </div>
  );
}
