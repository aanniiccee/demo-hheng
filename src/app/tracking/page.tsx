"use client";

export const dynamic = "force-dynamic";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  RefreshCw, 
  Plus, 
  Search, 
  PlusCircle, 
  Save,
  Loader2,
  SquarePen
} from "lucide-react";

// 🌟 โครงสร้างรายละเอียดการแทร็คกิ้งพัสดุ
interface TrackingDetail {
  direction: "INBOUND" | "OUTBOUND"; // รับเข้า หรือ ส่งออก
  shipping_date?: string;          // วันที่จัดส่ง
  expected_date?: string;          // วันที่คาดว่าจะได้รับ
  tracking_number?: string;
  thailand_post?: {
    last_status: string;
    status_detail?: string;
    status_update_at?: string;
  } | null;
}

interface TrackingTransaction {
  transaction_id: string;
  product: string; 
  customer_name: string;
  phone_number?: string;
  channel: string;
  chat_link?: string;
  tracking_number: string;
  is_delivered: "NO" | "YES";       // ยืนยันรับแล้ว (YES/NO)
  note?: string;
  updated_by_name?: string;
  created_by_name?: string;
  transaction_tracking?: TrackingDetail[] | TrackingDetail; 
}

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token") || "";
  const txIdFromUrl = searchParams.get("tx_id")?.trim() || "";

  // --- States ข้อมูลรวม ---
  const [allTransactions, setAllTransactions] = useState<TrackingTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- States Filters ---
  const [searchTerm, setSearchTerm] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"ALL" | "INBOUND" | "OUTBOUND">("ALL");
  const [deliveredFilter, setDeliveredFilter] = useState("ALL"); 

  // --- States ควบคุมโหมดฟอร์ม ---
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editTxId, setEditTxId] = useState("");

  // --- States สำหรับผูก Input ฟอร์ม ---
  const [direction, setDirection] = useState<"INBOUND" | "OUTBOUND">("INBOUND");
  const [product, setProduct] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [chatLink, setChatLink] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [channel, setChannel] = useState("LINE");
  const [trackingNumber, setTrackingNumber] = useState("");
  
  // ฟิลด์ข้อมูลวันที่ของระบบขนส่ง
  const [shippingDate, setShippingDate] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [thailandPostStatus, setThailandPostStatus] = useState("รอดำเนินการเข้ารับ"); // Read-only ดึงอัตโนมัติ
  const [isDelivered, setIsDelivered] = useState("NO");
  const [note, setNote] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const adminName = sessionStorage.getItem("admin_name");
    const adminLineId = sessionStorage.getItem("admin_line_id");

    if (!adminName || !adminLineId) {
      const currentParams = new URLSearchParams(window.location.search);
      currentParams.set("goto", window.location.pathname);
      window.location.href = "https://hheng-system.vercel.app/liff-router?" + currentParams.toString();
      return;
    }

    loadData();
  }, [token]);

  useEffect(() => {
    if (txIdFromUrl && allTransactions.length > 0) {
      const found = allTransactions.find(x => x.transaction_id === txIdFromUrl);
      if (found) {
        triggerEditMode(found);
      }
    }
  }, [txIdFromUrl, allTransactions]);

  const loadData = async () => {
    try {
      setLoading(true);
      const adminLineId = sessionStorage.getItem("admin_line_id") || "";
      const apiUrl = `/api/tracking-transactions?token=${token}&admin_line_id=${adminLineId}`;
      const r = await fetch(apiUrl);
      if (r.ok) {
        const data = await r.json();
        setAllTransactions(data);
      }
    } catch (err) {
      console.error("Error loading tracking data:", err);
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setFormMode("add");
    setEditTxId("");
    
    setDirection("INBOUND");
    setProduct("");
    setCustomerName("");
    setChatLink("");
    setPhoneNumber("");
    setChannel("LINE");
    setTrackingNumber("");
    
    setShippingDate(todayStr);
    setExpectedDate("");
    setThailandPostStatus("รอดำเนินการเข้ารับ");
    setIsDelivered("NO");
    setNote("");
  };

  const triggerEditMode = (tx: TrackingTransaction) => {
    const trackingList = tx.transaction_tracking;
    const tData: TrackingDetail = Array.isArray(trackingList) 
    ? trackingList[0] 
    : (trackingList || {
        direction: 'INBOUND',
        tracking_number: "",
        shipping_date: "",
        expected_date: "",
        thailand_post: null
      });

    setFormMode("edit");
    setEditTxId(tx.transaction_id);

    setDirection(tData.direction || "INBOUND");
    setProduct(tx.product || "");
    setCustomerName(tx.customer_name || "");
    setChatLink(tx.chat_link || "");
    setPhoneNumber(tx.phone_number || "");
    setChannel(tx.channel || "LINE");
    setTrackingNumber(tData.tracking_number || "");
    
    setShippingDate(tData.shipping_date || "");
    setExpectedDate(tData.expected_date || "");
    setThailandPostStatus(tData.thailand_post?.last_status || "รอดำเนินการเข้ารับ");
    setIsDelivered(tx.is_delivered || "NO");
    setNote(tx.note || "");
  };

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const adminLineId = sessionStorage.getItem("admin_line_id") || "Unknown";
    const adminName = sessionStorage.getItem("admin_name") || "Unknown";
    const trimmedTracking = trackingNumber.trim();

    // 1. Payload สำหรับบันทึกข้อมูล Tracking หลัก
    let payload: any = {
      product: product,
      customer_name: customerName,
      phone_number: phoneNumber,
      channel: channel,
      chat_link: chatLink,
      tracking_number: trimmedTracking,
      is_delivered: isDelivered,
      note: note,
      created_by_line_id: adminLineId,
      created_by_name: adminName,
      direction: direction,
      shipping_date: shippingDate || null,
      expected_date: expectedDate || null
    };

    let url = "/api/tracking-transactions";
    let method = "POST";

    if (formMode === "edit") {
      url = `/api/tracking-transactions/${encodeURIComponent(editTxId)}`;
      method = "PUT";
    }

    try {
      // Step A: บันทึกข้อมูลที่ Table แทร็คกิ้งหลัก
      const response = await fetch(`${url}?token=${token}&admin_line_id=${adminLineId}`, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json();
        alert("เกิดข้อผิดพลาด: " + (err.detail || "ไม่สามารถบันทึกได้"));
        setIsSubmitting(false);
        return;
      }

      // Step B: ส่งเลขพัสดุไปลงทะเบียนที่ thailand_post เสมอ (สร้างใหม่/Upsert โดยไม่ลบอันเก่าเพื่อความปลอดภัยของข้อมูล)
      if (trimmedTracking) {
        try {
          await fetch(`/api/thailand-post?token=${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tracking_number: trimmedTracking,
              status_code: "POST_REGISTERED"
            })
          });
        } catch (tpErr) {
          console.error("Failed to sync with thailand_post table:", tpErr);
          // ทำการแจ้งเตือนแต่ปล่อยผ่านเพื่อให้ Transaction หลักบันทึกเสร็จสิ้น
        }
      }

      alert("บันทึกข้อมูลการติดตามพัสดุสำเร็จ!");
      clearForm();
      await loadData();
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเน็ตเวิร์ก");
    } finally {
      setIsSubmitting(false);
    }
  };

// --- ระบบกรองข้อมูล (Filter Data Client-side) ที่ถูกต้อง ---
  const filteredTransactions = allTransactions.filter(x => {
    const trackingList = x.transaction_tracking;
    const tData = Array.isArray(trackingList) ? trackingList[0] : trackingList;
    const currentDirection = tData?.direction || "INBOUND";

    // กรองขารับเข้า/ส่งออก
    if (directionFilter !== "ALL" && currentDirection !== directionFilter) return false;

    // กรองการยืนยันการรับ
    if (deliveredFilter !== "ALL" && x.is_delivered !== deliveredFilter) return false;

    const q = searchTerm.toLowerCase().trim();
    const name = (x.customer_name || "").toLowerCase();
    const txId = (x.transaction_id || "").toLowerCase();
    const pDetail = (x.product || "").toLowerCase();
    const trackNumFromTracking = (tData && 'tracking_number' in tData ? tData.tracking_number : "")?.toLowerCase() || "";

    return q === "" || 
      name.includes(q) || 
      txId.includes(q) || 
      pDetail.includes(q) || 
      trackNumFromTracking.includes(q);
  });

  const getHomeUrl = () => {
    const adminLineId = sessionStorage.getItem("admin_line_id") || "";
    const params = new URLSearchParams();
    if (token) params.set("token", token);
    if (adminLineId) params.set("admin_line_id", adminLineId);
    return params.toString() ? `/?${params.toString()}` : "/";
  };

  return (
    <div>
      <div className="header-container">
        <h2>ระบบติดตามพัสดุ (Parcel Tracking)</h2>
        <div className="action-buttons">
          <Link href={getHomeUrl()} className="btn btn-default">
            <ArrowLeft size={24} /> กลับหน้าหลัก
          </Link>
          <button type="button" onClick={loadData} className="btn btn-default" disabled={loading}>
            <RefreshCw size={24} className={loading ? "animate-spin" : ""} /> รีเฟรช
          </button>
          <button type="button" onClick={clearForm} className="btn btn-primary">
            <Plus size={24} /> สร้างรายการใหม่
          </button>
        </div>
      </div>

      <div className="main-layout">
        <div className="table-container">
          <div className="table-header-bar">
            <div className="search-wrapper">
              <Search className="search-icon" size={16} />
              <input
                type="text"
                className="search-input"
                placeholder="ชื่อลูกค้า สินค้า เลขพัสดุ หรือ Transaction ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* ฟิลเตอร์ขาเข้า / ขาออก */}
            <div>
              <span className="filter-label">ประเภทรายการ:</span>
              <div className="filter-group">
                <button type="button" className={`filter-btn ${directionFilter === "ALL" ? "active" : ""}`} onClick={() => setDirectionFilter("ALL")}>ทั้งหมด</button>
                <button type="button" className={`filter-btn ${directionFilter === "INBOUND" ? "active" : ""}`} onClick={() => setDirectionFilter("INBOUND")}>รับเข้า (INBOUND)</button>
                <button type="button" className={`filter-btn ${directionFilter === "OUTBOUND" ? "active" : ""}`} onClick={() => setDirectionFilter("OUTBOUND")}>ส่งออก (OUTBOUND)</button>
              </div>
            </div>

            {/* ฟิลเตอร์สถานะการรับของ */}
            <div>
              <span className="filter-label">ยืนยันรับแล้ว:</span>
              <div className="filter-group">
                <button type="button" className={`filter-btn ${deliveredFilter === "ALL" ? "active" : ""}`} onClick={() => setDeliveredFilter("ALL")}>ทั้งหมด</button>
                <button type="button" className={`filter-btn ${deliveredFilter === "NO" ? "active" : ""}`} onClick={() => setDeliveredFilter("NO")}>ยังไม่รับ (NO)</button>
                <button type="button" className={`filter-btn ${deliveredFilter === "YES" ? "active" : ""}`} onClick={() => setDeliveredFilter("YES")}>รับแล้ว (YES)</button>
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="product-table">
              <thead>
                <tr>
                  <th className="col-id">Transaction ID</th>
                  <th className="col-type">ประเภท</th>
                  <th className="col-product">รหัสสินค้า</th>
                  <th className="col-customer">ชื่อลูกค้า</th>
                  <th className="col-phone">เบอร์โทร</th>
                  <th className="col-channel">ช่องทาง</th>
                  <th className="col-tracknum">หมายเลขติดตามพัสดุ</th>
                  <th className="col-date">วันที่จัดส่ง</th>
                  <th className="col-date">คาดว่าจะได้รับ</th>
                  <th className="col-admin-status">สถานะพัสดุ</th>
                  <th className="col-closed">ยืนยันรับสินค้าแล้ว</th>
                  <th className="col-note">หมายเหตุ</th>
                  <th className="col-admin-name">ผู้ทำรายการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={13} className="table-empty-row">กำลังดึงข้อมูลติดตามพัสดุ...</td></tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr><td colSpan={13} className="table-empty-row no-match">ไม่พบข้อมูลติดตามพัสดุที่ตรงเงื่อนไข</td></tr>
                ) : (
                  filteredTransactions.map((x) => {
                    const trackingList = x.transaction_tracking;
                    const tData = Array.isArray(trackingList) ? trackingList[0] : trackingList;
                    
                    const directionText = tData?.direction === "INBOUND" ? "📥 รับเข้า" : "📤 ส่งออก";
                    const badgeClass = tData?.direction === "INBOUND" ? "st-today" : "st-overdue";

                    const adminUserText = x.updated_by_name && x.updated_by_name !== "Unknown" 
                      ? x.updated_by_name 
                      : (x.created_by_name || "-");

                    return (
                      <tr key={x.transaction_id} onClick={() => triggerEditMode(x)}>
                        <td><strong>{x.transaction_id}</strong></td>
                        <td><span className={`status-badge ${badgeClass}`}>{directionText}</span></td>
                        <td><small>{x.product || "-"}</small></td>
                        <td>
                          {x.chat_link ? (
                            <a 
                              href={x.chat_link} 
                              target="_blank" 
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()} 
                              className="table-link-customer"
                            >
                              {x.customer_name}
                            </a>
                          ) : (
                            x.customer_name
                          )}
                        </td>
                        <td>{x.phone_number || "-"}</td>
                        <td><small>{x.channel}</small></td>
                        <td><strong className="text-blue-600">{x.tracking_number || "-"}</strong></td>
                        <td>{tData?.shipping_date || "-"}</td>
                        <td>{tData?.expected_date || "-"}</td>
                        <td>
                          <span className="status-badge st-normal">
                            {tData?.thailand_post?.last_status || "รอดำเนินการเข้ารับ"}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${x.is_delivered === "YES" ? "closed-yes" : ""}`}>
                            {x.is_delivered}
                          </span>
                        </td>
                        <td><span className="table-txt-muted">{x.note || "-"}</span></td>
                        <td><span className="table-txt-admin">{adminUserText}</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ฝั่งขวา: ฟอร์มจัดการสร้าง/แก้ไขพัสดุ */}
        <div className="form-card">
          <h3>
            {formMode === "add" ? <PlusCircle size={24} /> : <SquarePen size={24} />}
            <span className="form-title-text">{formMode === "add" ? "สร้างรายการติดตามพัสดุ" : "แก้ไขรายการติดตามพัสดุ"}</span>
          </h3>
          
          <form onSubmit={handleFormSubmit}>
            <div className="form-sub-header">
              <span className="form-sub-title">ข้อมูลปลายทางและสินค้า</span>
            </div>

            <div className="form-group">
              <label htmlFor="product">รหัสสินค้า</label>
              <input
                type="text"
                id="product"
                required
                placeholder="กรอกรายละเอียด/รหัสสินค้า"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="customer_name">ชื่อลูกค้า</label>
              <input
                type="text"
                id="customer_name"
                required
                placeholder="ชื่อ-นามสกุลลูกค้า"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="chat_link">ลิงก์แชทลูกค้า</label>
              <input
                type="url"
                id="chat_link"
                placeholder="https://line.me/..."
                value={chatLink}
                onChange={(e) => setChatLink(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone_number">เบอร์โทรศัพท์</label>
              <input
                type="text"
                id="phone_number"
                placeholder="0xxxxxxxxx"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="channel">ช่องทางติดต่อ</label>
              <select
                id="channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                <option value="LINE">LINE</option>
                <option value="FB">FB</option>
                <option value="IG">IG</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <hr className="divider-dashed" />
            <div className="form-sub-header">
              <span className="form-sub-title text-blue">ข้อมูลการจัดส่งสินค้า (Tracking)</span>
            </div>

            <div className="form-group">
              <label htmlFor="direction">ประเภทการจัดส่ง</label>
              <select
                id="direction"
                value={direction}
                onChange={(e) => setDirection(e.target.value as "INBOUND" | "OUTBOUND")}
              >
                <option value="INBOUND">📥 รับเข้า (Inbound)</option>
                <option value="OUTBOUND">📤 ส่งออก (Outbound)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="tracking_number">หมายเลขติดตามพัสดุ</label>
              <input
                type="text"
                id="tracking_number"
                required
                placeholder="ระบุเลขพัสดุไปรษณีย์ไทย"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>วันที่จัดส่ง</label>
              <input
                type="date"
                required
                value={shippingDate}
                onChange={(e) => setShippingDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>วันที่คาดว่าจะได้รับ</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="thailand_post_status">สถานะพัสดุ</label>
              <input
                type="text"
                id="thailand_post_status"
                disabled
                className="bg-gray-100 cursor-not-allowed opacity-75 font-semibold"
                value={thailandPostStatus}
              />
            </div>

            <div className="form-group">
              <label htmlFor="is_delivered">ยืนยันรับสินค้า?</label>
              <select
                id="is_delivered"
                value={isDelivered}
                onChange={(e) => setIsDelivered(e.target.value)}
              >
                <option value="NO">NO (อยู่ระหว่างการจัดส่ง)</option>
                <option value="YES">YES (ได้รับพัสดุเรียบร้อยแล้ว)</option>
              </select>
            </div>

            <hr className="divider-dashed" />

            <div className="form-group">
              <label htmlFor="note">หมายเหตุ</label>
              <textarea
                id="note"
                placeholder="ระบุหมายเหตุ..."
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              ></textarea>
            </div>

            <button 
              type="submit" 
              className={`btn btn-block ${isSubmitting ? "btn-default" : "btn-success"}`} 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 size={16} className="animate-spin" /> กำลังบันทึกข้อมูลติดตามพัสดุ...</>
              ) : (
                <><Save size={16} /> บันทึกข้อมูลติดตามพัสดุ</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
