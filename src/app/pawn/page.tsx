"use client";

export const dynamic = "force-dynamic";
import React, { useState, useEffect} from "react";
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

// 🌟 กำหนด Type โครงสร้างข้อมูลที่ส่งมาจาก FastAPI หลังบ้าน
interface PawnDetail {
  interest_per_month: number;
  payment_date?: string;
  next_due_date?: string;
  input_status?: string;
  total_paid_amount: number;
}

interface Transaction {
  transaction_id: string;
  product: string;
  customer_name: string;
  phone_number?: string;
  channel: string;
  current_status: string;
  closed: string;
  note?: string;
  chat_link?: string;
  updated_by_name?: string;
  created_by_name?: string;
  transaction_pawn?: PawnDetail[] | PawnDetail;
}

export default function PawnPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token") || "";
  const txIdFromUrl = searchParams.get("tx_id")?.trim() || "";

  // --- States สำคัญสำหรับระบบข้อมูล ---
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- States สำหรับการค้นหาและตัวกรอง (Filters) ---
  const [searchTerm, setSearchTerm] = useState("");
  const [closedFilter, setClosedFilter] = useState("NO"); 
  const [excludePaidFilter, setExcludePaidFilter] = useState("YES"); 
  const [statusFilter, setStatusFilter] = useState("ALL"); 

  // --- States สำหรับการควบคุมฟอร์ม ---
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editTxId, setEditTxId] = useState("");
  const [isPawnUnlocked, setIsPawnUnlocked] = useState(false);
  const [originalPaymentDate, setOriginalPaymentDate] = useState("");

  // --- States สำหรับผูกข้อมูล Input ในฟอร์ม (Form Bindings) ---
  const [product, setProduct] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [chatLink, setChatLink] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [channel, setChannel] = useState("LINE");
  const [interestPerMonth, setInterestPerMonth] = useState("");
  const [nextDueDateAdd, setNextDueDateAdd] = useState("");
  const [currentDueDate, setCurrentDueDate] = useState("");
  const [currentOverdueBalance, setCurrentOverdueBalance] = useState(0);
  const [paymentDate, setPaymentDate] = useState("");
  const [totalPaidAmount, setTotalPaidAmount] = useState("");
  const [closed, setClosed] = useState("NO");
  const [nextDueDateEdit, setNextDueDateEdit] = useState("");
  const [inputStatus, setInputStatus] = useState("");
  const [note, setNote] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];

  // ==========================================
  // 1. ระบบตรวจสอบ Session Admin & โหลดข้อมูลเริ่มต้น
  // ==========================================
  useEffect(() => {
    // ตรวจเช็คความปลอดภัยของ Admin Session
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

  // จัดการ Trigger คลิกเปิดฟอร์มแก้ข้อมูลออโต้หากมี tx_id พ่วงมาใน URL
  useEffect(() => {
    if (txIdFromUrl && allTransactions.length > 0) {
      const found = allTransactions.find(x => x.transaction_id === txIdFromUrl);
      if (found) {
        triggerEditMode(found);
      }
    }
  }, [txIdFromUrl, allTransactions]);

  // ==========================================
  // 2. ฟังก์ชันโหลดข้อมูลหลักจาก API (FastAPI backend)
  // ==========================================
  const loadData = async () => {
    try {
      setLoading(true);
      const adminLineId = sessionStorage.getItem("admin_line_id") || "";
      const apiUrl = `/api/pawn-transactions?token=${token}&admin_line_id=${adminLineId}`;
      const r = await fetch(apiUrl);
      if (r.ok) {
        const data = await r.json();
        setAllTransactions(data);
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 3. ฟังก์ชันคำนวณวันคงเหลือ / ยอดค้างชำระ (Business Logic เดิม)
  // ==========================================
  const calculateOverdueAndDuration = (tx: Transaction) => {
    const pawnList = tx.transaction_pawn;
    const pData = Array.isArray(pawnList) ? pawnList[0] : pawnList;

    let statusText = "ยังไม่ถึงกำหนด";
    let badgeClass = "st-normal";
    let overdueAmount = 0;
    let durationText = "";

    if (tx.current_status === "ชำระแล้ว") {
      statusText = "ชำระแล้ว";
      badgeClass = "closed-yes";
      durationText = "ชำระดอกเบี้ยแล้ว";
    } else if (pData && pData.next_due_date) {
      const dueDate = new Date(pData.next_due_date);
      const todayObj = new Date(todayStr);

      dueDate.setHours(0,0,0,0);
      todayObj.setHours(0,0,0,0);

      if (dueDate.getTime() === todayObj.getTime()) {
        statusText = "ครบกำหนด";
        badgeClass = "st-today";
        durationText = "ครบกำหนดวันนี้";
      } else if (dueDate < todayObj) {
        statusText = "เกินกำหนด";
        badgeClass = "st-overdue";

        let monthsDiff = (todayObj.getFullYear() - dueDate.getFullYear()) * 12 + (todayObj.getMonth() - dueDate.getMonth());
        let checkDate = new Date(dueDate);
        checkDate.setMonth(checkDate.getMonth() + monthsDiff);
        
        if (checkDate > todayObj) { 
          monthsDiff--; 
          checkDate = new Date(dueDate); 
          checkDate.setMonth(checkDate.getMonth() + monthsDiff); 
        }

        const timeDiff = todayObj.getTime() - checkDate.getTime();
        const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        durationText = `ค้าง ${monthsDiff} ด. ${daysDiff} วัน`;

        const chargeableMonths = daysDiff > 0 ? monthsDiff + 1 : Math.max(1, monthsDiff);
        overdueAmount = chargeableMonths * (pData.interest_per_month || 0);
      } else {
        const diffDays = Math.ceil((dueDate.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
        durationText = `เหลืออีก ${diffDays} วัน`;
      }
    }

    return { statusText, badgeClass, overdueAmount, durationText };
  };

  // ==========================================
  // 4. ระบบการเคลียร์และสลับเปิดฟอร์ม (Form Actions)
  // ==========================================
  const clearForm = () => {
    setFormMode("add");
    setEditTxId("");
    setIsPawnUnlocked(false);
    setOriginalPaymentDate("");
    
    setProduct("");
    setCustomerName("");
    setChatLink("");
    setPhoneNumber("");
    setChannel("LINE");
    setInterestPerMonth("");
    setNextDueDateAdd("");
    setInputStatus("");
    setNote("");
  };

  const triggerEditMode = (tx: Transaction) => {
    const pawnList = tx.transaction_pawn;
    const pData: PawnDetail = Array.isArray(pawnList) ? pawnList[0] : (pawnList || { interest_per_month: 0, total_paid_amount: 0 });
    const { overdueAmount } = calculateOverdueAndDuration(tx);

    setFormMode("edit");
    setEditTxId(tx.transaction_id);
    setIsPawnUnlocked(false);

    setProduct(tx.product || "");
    setCustomerName(tx.customer_name || "");
    setChatLink(tx.chat_link || "");
    setPhoneNumber(tx.phone_number || "");
    setChannel(tx.channel || "LINE");
    setInterestPerMonth(String(pData.interest_per_month || 0));
    
    setCurrentDueDate(pData.next_due_date || "");
    setCurrentOverdueBalance(overdueAmount);
    
    const initialPayDate = pData.payment_date && pData.payment_date !== "-" ? pData.payment_date : todayStr;
    setPaymentDate(initialPayDate);
    setOriginalPaymentDate(initialPayDate);
    
    setTotalPaidAmount(String(pData.total_paid_amount || 0));
    setClosed(tx.closed || "NO");
    setNextDueDateEdit("");
    
    setInputStatus(pData.input_status || "");
    setNote(tx.note || "");
  };

  const handlePawnUnlockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setIsPawnUnlocked(isChecked);

    if (isChecked) {
      setTotalPaidAmount("0");
      setNextDueDateEdit("");
      setClosed("NO");
    } else {
      setTotalPaidAmount("0");
      setPaymentDate(originalPaymentDate);
    }
  };

  // ==========================================
  // 5. ระบบบันทึกและแก้ไขข้อมูลรายการ (Submit Handlers)
  // ==========================================
  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const adminLineId = sessionStorage.getItem("admin_line_id") || "Unknown";
    const adminName = sessionStorage.getItem("admin_name") || "Unknown";

    let targetDueDate = "";
    let paymentDateValue = null;
    let paidAmountValue = 0;
    let closedValue = "NO";

    if (formMode === "add") {
      targetDueDate = nextDueDateAdd;
    } else {
      if (isPawnUnlocked) {
        paymentDateValue = null;
        paidAmountValue = 0;
        closedValue = "NO";
        targetDueDate = currentDueDate;
      } else {
        targetDueDate = nextDueDateEdit;
        paymentDateValue = paymentDate ? paymentDate : null;
        paidAmountValue = parseFloat(totalPaidAmount || "0");
        closedValue = closed;
      }
    }

    const payload = {
      product: product,
      customer_name: customerName,
      phone_number: phoneNumber,
      channel: channel,
      interest_per_month: parseFloat(interestPerMonth || "0"),
      payment_date: paymentDateValue,
      next_due_date: targetDueDate,
      input_status: inputStatus,
      closed: closedValue,
      total_paid_amount: paidAmountValue,
      note: note,
      is_edit_pawn_master: isPawnUnlocked,
      created_by_line_id: adminLineId,
      created_by_name: adminName,
      chat_link: chatLink
    };

    let url = "/api/pawn-transactions";
    let method = "POST";

    if (formMode === "edit") {
      url = `/api/pawn-transactions/${encodeURIComponent(editTxId)}`;
      method = "PUT";
    }

    try {
      const response = await fetch(`${url}?token=${token}&admin_line_id=${adminLineId}`, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert("บันทึกข้อมูลสำเร็จ!");
        clearForm();
        await loadData();
      } else {
        const err = await response.json();
        alert("เกิดข้อผิดพลาด: " + (err.detail || "ไม่สามารถบันทึกได้"));
      }
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเน็ตเวิร์ก");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // 6. ระบบกรองข้อมูล (Filter Data Client-side)
  // ==========================================
  const filteredTransactions = allTransactions.filter(x => {
    if (closedFilter !== "ALL" && x.closed !== closedFilter) return false;

    const { statusText } = calculateOverdueAndDuration(x);

    if (statusFilter !== "ALL" && statusFilter !== statusText) return false;
    if (excludePaidFilter === "YES" && statusText === "ชำระแล้ว") return false;

    const q = searchTerm.toLowerCase().trim();
    const name = (x.customer_name || "").toLowerCase();
    const txId = (x.transaction_id || "").toLowerCase();
    const pDetail = (x.product || "").toLowerCase();

    return q === "" || name.includes(q) || txId.includes(q) || pDetail.includes(q);
  });

  // ฟังก์ชันสลับเงื่อนไขตัวกรองอัจฉริยะแบบโค้ดเก่า
  const changeClosedFilter = (val: string) => {
    setClosedFilter(val);
    if (val === "YES") {
      setExcludePaidFilter("NO");
      setStatusFilter("ALL");
    }
  };

  const changeStatusFilter = (val: string) => {
    setStatusFilter(val);
    if (val !== "ALL" && val !== "ชำระแล้ว" && closedFilter === "YES") {
      setClosedFilter("NO");
    }
  };

  const getHomeUrl = () => {
    const adminLineId = sessionStorage.getItem("admin_line_id") || "";
    const params = new URLSearchParams();
    if (token) params.set("token", token);
    if (adminLineId) params.set("admin_line_id", adminLineId);
    return params.toString() ? `/?${params.toString()}` : "/";
  };

  return (
    <div>
      {/* ส่วนหัวระบบ */}
      <div className="header-container">
        <h2>ระบบต่อดอก (Pawn Transactions)</h2>
        <div className="action-buttons">
          <Link href={getHomeUrl()} className="btn btn-default">
            <ArrowLeft size={14} /> กลับหน้าหลัก
          </Link>
          <button type="button" onClick={loadData} className="btn btn-default" disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> รีเฟรช
          </button>
          <button type="button" onClick={clearForm} className="btn btn-primary">
            <Plus size={14} /> สร้างรายการต่อดอก
          </button>
        </div>
      </div>

      <div className="main-layout">
        {/* ฝั่งซ้าย: ตารางรายการข้อมูล */}
        <div className="table-container">
          <div className="table-header-bar">
            <div className="search-wrapper">
              <Search className="search-icon" size={16} />
              <input
                type="text"
                className="search-input"
                placeholder="ชื่อลูกค้า สินค้า หรือ Transaction ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#4b5563", marginRight: "6px" }}>ปิดยอดแล้ว:</span>
              <div className="filter-group">
                <button type="button" className={`filter-btn ${closedFilter === "ALL" ? "active" : ""}`} onClick={() => changeClosedFilter("ALL")}>ทั้งหมด</button>
                <button type="button" className={`filter-btn ${closedFilter === "NO" ? "active" : ""}`} onClick={() => changeClosedFilter("NO")}>เปิดอยู่ (NO)</button>
                <button type="button" className={`filter-btn ${closedFilter === "YES" ? "active" : ""}`} onClick={() => changeClosedFilter("YES")}>ปิดแล้ว (YES)</button>
              </div>
            </div>

            <div>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#4b5563", marginRight: "6px" }}>ซ่อนรายการที่ชำระแล้ว:</span>
              <div className="filter-group">
                <button type="button" className={`filter-btn ${excludePaidFilter === "YES" ? "active" : ""}`} onClick={() => setExcludePaidFilter("YES")}>YES</button>
                <button type="button" className={`filter-btn ${excludePaidFilter === "NO" ? "active" : ""}`} onClick={() => setExcludePaidFilter("NO")}>NO</button>
              </div>
            </div>

            <div>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#4b5563", marginRight: "6px" }}>สถานะจากระบบ:</span>
              <div className="filter-group">
                <button type="button" className={`filter-btn ${statusFilter === "ALL" ? "active" : ""}`} onClick={() => changeStatusFilter("ALL")}>ทั้งหมด</button>
                <button type="button" className={`filter-btn ${statusFilter === "ยังไม่ถึงกำหนด" ? "active" : ""}`} onClick={() => changeStatusFilter("ยังไม่ถึงกำหนด")}>ยังไม่ถึงกำหนด</button>
                <button type="button" className={`filter-btn ${statusFilter === "ครบกำหนด" ? "active" : ""}`} onClick={() => changeStatusFilter("ครบกำหนด")}>ครบกำหนด</button>
                <button type="button" className={`filter-btn ${statusFilter === "เกินกำหนด" ? "active" : ""}`} onClick={() => changeStatusFilter("เกินกำหนด")}>เกินกำหนด</button>
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="product-table">
              <thead>
                <tr>
                  <th style={{ minWidth: "110px" }}>Transaction ID</th>
                  <th style={{ minWidth: "180px" }}>รหัสสินค้า</th>
                  <th style={{ minWidth: "120px" }}>ชื่อลูกค้า</th>
                  <th style={{ minWidth: "100px" }}>เบอร์โทร</th>
                  <th style={{ minWidth: "80px" }}>ช่องทาง</th>
                  <th style={{ minWidth: "110px" }}>สถานะจากระบบ</th>
                  <th style={{ minWidth: "100px" }}>ดอกเบี้ยต่อเดือน</th>
                  <th style={{ minWidth: "100px" }}>วันที่ชำระ</th>
                  <th style={{ minWidth: "140px" }}>ยอดเงินที่ชำระ</th>
                  <th style={{ minWidth: "100px" }}>กำหนดชำระ</th>
                  <th style={{ minWidth: "100px" }}>ยอดค้างชำระ</th>
                  <th style={{ minWidth: "120px" }}>สถานะจากแอดมิน</th>
                  <th style={{ minWidth: "80px" }}>ปิดยอดแล้ว</th>
                  <th style={{ minWidth: "150px" }}>หมายเหตุ</th>
                  <th style={{ minWidth: "120px" }}>แอดมินที่ทำรายการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={15} style={{ textAlign: "left", color: "#6b7280", padding: "30px" }}>
                      กำลังดึงข้อมูลธุรกรรม...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={15} style={{ textAlign: "left", color: "#9ca3af", padding: "30px" }}>
                      ไม่พบข้อมูลการต่อดอกที่ตรงเงื่อนไข
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((x) => {
                    const pawnList = x.transaction_pawn;
                    const pData = Array.isArray(pawnList) ? pawnList[0] : pawnList;
                    const { statusText, badgeClass, overdueAmount, durationText } = calculateOverdueAndDuration(x);

                    const adminUserText = x.updated_by_name && x.updated_by_name !== "Unknown" 
                      ? x.updated_by_name 
                      : (x.created_by_name || "-");

                    return (
                      <tr key={x.transaction_id} onClick={() => triggerEditMode(x)}>
                        <td><strong>{x.transaction_id}</strong></td>
                        <td><small>{x.product || "-"}</small></td>
                        <td>
                          {x.chat_link ? (
                            <a 
                              href={x.chat_link} 
                              target="_blank" 
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()} 
                              style={{ color: "#2563eb", textDecoration: "underline", fontWeight: 500 }}
                            >
                              {x.customer_name}
                            </a>
                          ) : (
                            x.customer_name
                          )}
                        </td>
                        <td>{x.phone_number || "-"}</td>
                        <td><small>{x.channel}</small></td>
                        <td><span className={`status-badge ${badgeClass}`}>{statusText}</span></td>
                        <td>{pData?.interest_per_month ? Number(pData.interest_per_month).toLocaleString() : "0"} บ.</td>
                        <td>{pData?.payment_date || "-"}</td>
                        <td style={{ color: "#2563eb", fontWeight: "bold" }}>
                          {pData?.total_paid_amount ? Number(pData.total_paid_amount).toLocaleString() : "0"} บ.
                        </td>
                        <td>{pData?.next_due_date || "-"}</td>
                        <td>
                          <div style={{ color: overdueAmount > 0 ? "#b91c1c" : "#10b981", fontWeight: "bold" }}>
                            {overdueAmount.toLocaleString()} บ.
                          </div>
                          <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "2px", fontStyle: "italic" }}>
                            ({durationText})
                          </div>
                        </td>
                        <td>{pData?.input_status || "-"}</td>
                        <td><span className={`status-badge ${x.closed === "YES" ? "closed-yes" : ""}`}>{x.closed}</span></td>
                        <td><span style={{ color: "#6b7280", fontSize: "12px" }}>{x.note || "-"}</span></td>
                        <td><span style={{ color: "#4b5563", fontWeight: 500 }}>{adminUserText}</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ฝั่งขวา: ฟอร์มสร้าง/แก้ไขข้อมูลแบบ Sticky */}
        <div className="form-card">
          <h3>
            {formMode === "add" ? <PlusCircle size={18} /> : <SquarePen size={18} />}
            <span style={{ marginLeft: "6px" }}>{formMode === "add" ? "สร้างรายการต่อดอก" : "บันทึกรายการต่อดอก"}</span>
          </h3>
          
          <form onSubmit={handleFormSubmit}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#4b5563" }}>รายละเอียดการต่อดอก</span>
              
              {formMode === "edit" && (
                <label style={{ fontSize: "12px", color: "#2563eb", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                  <input type="checkbox" checked={isPawnUnlocked} onChange={handlePawnUnlockChange} />
                  แก้ไขข้อมูล
                </label>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="product">รหัสสินค้า</label>
              <input
                type="text"
                id="product"
                required
                placeholder="กรอกรายละเอียดสินค้า"
                disabled={formMode === "edit" && !isPawnUnlocked}
                style={{ backgroundColor: formMode === "edit" && !isPawnUnlocked ? "#f3f4f6" : "#ffffff", cursor: formMode === "edit" && !isPawnUnlocked ? "not-allowed" : "text" }}
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
                placeholder="ชื่อ-นามสกุล"
                disabled={formMode === "edit" && !isPawnUnlocked}
                style={{ backgroundColor: formMode === "edit" && !isPawnUnlocked ? "#f3f4f6" : "#ffffff", cursor: formMode === "edit" && !isPawnUnlocked ? "not-allowed" : "text" }}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="chat_link">ลิงก์แชทลูกค้า</label>
              <input
                type="text"
                id="chat_link"
                placeholder="วางลิงก์แชท เช่น https://line.me/..."
                disabled={formMode === "edit" && !isPawnUnlocked}
                style={{ backgroundColor: formMode === "edit" && !isPawnUnlocked ? "#f3f4f6" : "#ffffff", cursor: formMode === "edit" && !isPawnUnlocked ? "not-allowed" : "text" }}
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
                disabled={formMode === "edit" && !isPawnUnlocked}
                style={{ backgroundColor: formMode === "edit" && !isPawnUnlocked ? "#f3f4f6" : "#ffffff", cursor: formMode === "edit" && !isPawnUnlocked ? "not-allowed" : "text" }}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="channel">ช่องทางติดต่อ</label>
              <select
                id="channel"
                disabled={formMode === "edit" && !isPawnUnlocked}
                style={{ backgroundColor: formMode === "edit" && !isPawnUnlocked ? "#f3f4f6" : "#ffffff", cursor: formMode === "edit" && !isPawnUnlocked ? "not-allowed" : "default" }}
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                <option value="LINE">LINE</option>
                <option value="FB">FB</option>
                <option value="IG">IG</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="interest_per_month">ดอกเบี้ยต่อเดือน (บาท)</label>
              <input
                type="number"
                step="0.01"
                id="interest_per_month"
                required
                placeholder="0.00"
                disabled={formMode === "edit" && !isPawnUnlocked}
                style={{ backgroundColor: formMode === "edit" && !isPawnUnlocked ? "#f3f4f6" : "#ffffff", cursor: formMode === "edit" && !isPawnUnlocked ? "not-allowed" : "text" }}
                value={interestPerMonth}
                onChange={(e) => setInterestPerMonth(e.target.value)}
              />
            </div>

            {formMode === "add" && (
              <div className="form-group">
                <label htmlFor="next_due_date_add" style={{ color: "#2563eb" }}>วันครบกำหนดชำระ</label>
                <input
                  type="date"
                  id="next_due_date_add"
                  required
                  value={nextDueDateAdd}
                  onChange={(e) => setNextDueDateAdd(e.target.value)}
                />
              </div>
            )}

            <hr style={{ border: 0, borderTop: "1px dashed #d1d5db", margin: "15px 0" }} />

            {formMode === "edit" && (
              <div>
                <div className="form-group">
                  <label style={{ color: "#2563eb" }}>วันครบกำหนดชำระ (รอบปัจจุบัน)</label>
                  <input
                    type="date"
                    disabled={!isPawnUnlocked}
                    style={{ backgroundColor: !isPawnUnlocked ? "#f3f4f6" : "#ffffff", color: "#374151", cursor: !isPawnUnlocked ? "not-allowed" : "text" }}
                    value={currentDueDate}
                    onChange={(e) => setCurrentDueDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label style={{ color: "#6b7280", fontWeight: 500 }}>ยอดค้างชำระ (รอบปัจจุบัน)</label>
                  <input
                    type="text"
                    readOnly
                    style={{ 
                      backgroundColor: "#f3f4f6", 
                      fontWeight: 600, 
                      cursor: "not-allowed",
                      color: currentOverdueBalance > 0 ? "#b91c1c" : "#10b981"
                    }}
                    value={currentOverdueBalance.toLocaleString() + " บ."}
                  />
                </div>

                {isPawnUnlocked && (
                  <div style={{ backgroundColor: "#fef2f2", borderLeft: "4px solid #ef4444", padding: "10px", marginBottom: "15px", borderRadius: "4px" }}>
                    <span style={{ color: "#991b1b", fontSize: "13px", fontWeight: "bold" }}>
                      ⚠️ หมายเหตุ: กรณีแก้ไขข้อมูลรายการต่อดอกเดิม จะไม่สามารถอัปเดตข้อมูลการรับชำระพร้อมกันได้ 
                    </span>
                  </div>
                )}

                <div style={{ background: isPawnUnlocked ? "#e5e7eb" : "#fafafa", padding: "12px", border: "1px solid #e5e7eb", borderRadius: "8px", marginBottom: "12px" }}>
                  <div className="form-group">
                    <label htmlFor="payment_date">วันที่ชำระ</label>
                    <input
                      type="date"
                      id="payment_date"
                      disabled={isPawnUnlocked}
                      style={{ cursor: isPawnUnlocked ? "not-allowed" : "default" }}
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="total_paid_amount">ยอดเงินที่ชำระ (บาท)</label>
                    <input
                      type="number"
                      step="0.01"
                      id="total_paid_amount"
                      placeholder="0.00"
                      disabled={isPawnUnlocked}
                      style={{ cursor: isPawnUnlocked ? "not-allowed" : "text" }}
                      value={totalPaidAmount}
                      onChange={(e) => setTotalPaidAmount(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="closed">ปิดยอดตั๋วใบนี้เลยหรือไม่?</label>
                    <select
                      id="closed"
                      disabled={isPawnUnlocked}
                      style={{ cursor: isPawnUnlocked ? "not-allowed" : "default" }}
                      value={closed}
                      onChange={(e) => setClosed(e.target.value)}
                    >
                      <option value="NO">NO (จ่ายเพื่อต่อดอก สร้างรายการต่อดอกครั้งถัดไป)</option>
                      <option value="YES">YES (จ่ายเพื่อปิดยอด)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="next_due_date_edit" style={{ fontWeight: 600, color: "#2563eb" }}>วันครบกำหนดชำระครั้งถัดไป</label>
                  <input
                    type="date"
                    id="next_due_date_edit"
                    required={!isPawnUnlocked && closed !== "YES"}
                    disabled={isPawnUnlocked || closed === "YES"}
                    style={{ 
                      backgroundColor: isPawnUnlocked || closed === "YES" ? "#e5e7eb" : "#ffffff", 
                      cursor: isPawnUnlocked || closed === "YES" ? "not-allowed" : "default" 
                    }}
                    value={closed === "YES" ? "" : nextDueDateEdit}
                    onChange={(e) => setNextDueDateEdit(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="input_status">สถานะจากแอดมิน</label>
              <input
                type="text"
                id="input_status"
                placeholder="ระบุสถานะ..."
                value={inputStatus}
                onChange={(e) => setInputStatus(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="note">หมายเหตุ</label>
              <textarea
                id="note"
                rows={2}
                placeholder="ระบุหมายเหตุ..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              ></textarea>
            </div>

            <button 
              type="submit" 
              className={`btn ${isSubmitting ? "btn-default" : "btn-success"}`} 
              style={{ width: "100%", justifyContent: "center" }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> กำลังบันทึกข้อมูล...
                </>
              ) : (
                <>
                  <Save size={16} /> บันทึกข้อมูลการต่อดอก
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
