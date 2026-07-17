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

// 🌟 โครงสร้างข้อมูลมัดจำ (Deposit Detail)
interface DepositDetail {
  deposit_amount: number;       // ยอดเงินมัดจำครั้งแรก
  deposit_date?: string;        // วันที่ชำระเงินมัดจำ
  remaining_balance: number;    // ยอดเงินสำหรับชำระครั้งถัดไป
  due_date?: string;            // วันครบกำหนดชำระครั้งถัดไป
  payment_date?: string;        // วันที่บันทึกชำระเงินงวดล่าสุด
  total_paid_amount?: number;   // ยอดรวมที่ชำระเข้ามาล่าสุด
  input_status?: string;
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
  transaction_deposit?: DepositDetail[] | DepositDetail; 
}

export default function DepositPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token") || "";
  const txIdFromUrl = searchParams.get("tx_id")?.trim() || "";

  // --- States ข้อมูลรวม ---
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- States Filters ---
  const [searchTerm, setSearchTerm] = useState("");
  const [closedFilter, setClosedFilter] = useState("NO"); 
  const [excludePaidFilter, setExcludePaidFilter] = useState("YES"); 
  const [statusFilter, setStatusFilter] = useState("ALL"); 

  // --- States ควบคุมโหมดฟอร์ม ---
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editTxId, setEditTxId] = useState("");
  const [isDepositUnlocked, setIsDepositUnlocked] = useState(false); 

  // --- States สำหรับผูก Input ฟอร์ม ---
  const [product, setProduct] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [chatLink, setChatLink] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [channel, setChannel] = useState("LINE");
  
  // 4 ฟิลด์ข้อมูลหลักของมัดจำ
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDate, setDepositDate] = useState("");
  const [remainingBalance, setRemainingBalance] = useState("");
  const [dueDate, setDueDate] = useState("");

  // ฟิลด์สำหรับบันทึกการชำระเงินงวดถัดไป
  const [paymentDate, setPaymentDate] = useState("");
  const [totalPaidAmount, setTotalPaidAmount] = useState("");
  
  const [closed, setClosed] = useState("NO");
  const [inputStatus, setInputStatus] = useState("");
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
      const apiUrl = `/api/deposit-transactions?token=${token}&admin_line_id=${adminLineId}`;
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

  const calculateOverdueAndDuration = (tx: Transaction) => {
    const depositList = tx.transaction_deposit;
    const dData = Array.isArray(depositList) ? depositList[0] : depositList;

    let statusText = "ยังไม่ถึงกำหนดชำระ";
    let badgeClass = "st-normal";
    let durationText = "";

    if (tx.closed === "YES") {
      statusText = "ปิดออเดอร์แล้ว";
      badgeClass = "closed-yes";
      durationText = "รับสินค้า/เสร็จสิ้น";
    } else if (dData && dData.due_date) {
      const targetDate = new Date(dData.due_date);
      const todayObj = new Date(todayStr);

      targetDate.setHours(0,0,0,0);
      todayObj.setHours(0,0,0,0);

      if (targetDate.getTime() === todayObj.getTime()) {
        statusText = "ครบกำหนดวันนี้";
        badgeClass = "st-today";
        durationText = "ต้องจ่ายงวดถัดแต่วันนี้";
      } else if (targetDate < todayObj) {
        statusText = "เกินกำหนดชำระ";
        badgeClass = "st-overdue";
        const timeDiff = todayObj.getTime() - targetDate.getTime();
        const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        durationText = `เลิกนัดมาแล้ว ${daysDiff} วัน`;
      } else {
        const diffDays = Math.ceil((targetDate.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
        durationText = `เหลืออีก ${diffDays} วัน`;
      }
    }

    return { statusText, badgeClass, durationText };
  };

  const clearForm = () => {
    setFormMode("add");
    setEditTxId("");
    setIsDepositUnlocked(false);
    
    setProduct("");
    setCustomerName("");
    setChatLink("");
    setPhoneNumber("");
    setChannel("LINE");
    
    setDepositAmount("");
    setDepositDate(todayStr);
    setRemainingBalance("");
    setDueDate("");
    
    setPaymentDate("");
    setTotalPaidAmount("");
    setClosed("NO");
    setInputStatus("");
    setNote("");
  };

  const triggerEditMode = (tx: Transaction) => {
    const depositList = tx.transaction_deposit;
    const dData: DepositDetail = Array.isArray(depositList) 
      ? depositList[0] 
      : (depositList || { deposit_amount: 0, remaining_balance: 0 });

    setFormMode("edit");
    setEditTxId(tx.transaction_id);
    setIsDepositUnlocked(false); 

    setProduct(tx.product || "");
    setCustomerName(tx.customer_name || "");
    setChatLink(tx.chat_link || "");
    setPhoneNumber(tx.phone_number || "");
    setChannel(tx.channel || "LINE");
    
    setDepositAmount(String(dData.deposit_amount || 0));
    setDepositDate(dData.deposit_date || "");
    setRemainingBalance(String(dData.remaining_balance || 0));
    setDueDate(dData.due_date || "");

    setPaymentDate(todayStr);
    setTotalPaidAmount("");
    
    setClosed(tx.closed || "NO");
    setInputStatus(dData.input_status || "");
    setNote(tx.note || "");
  };

  const handleDepositUnlockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsDepositUnlocked(e.target.checked);
  };

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const adminLineId = sessionStorage.getItem("admin_line_id") || "Unknown";
    const adminName = sessionStorage.getItem("admin_name") || "Unknown";

    let payload: any = {
      product: product,
      customer_name: customerName,
      phone_number: phoneNumber,
      channel: channel,
      closed: closed,
      input_status: inputStatus,
      note: note,
      created_by_line_id: adminLineId,
      created_by_name: adminName,
      chat_link: chatLink,
      is_edit_deposit_master: isDepositUnlocked
    };

    if (formMode === "add") {
      payload.deposit_amount = parseFloat(depositAmount || "0");
      payload.deposit_date = depositDate || null;
      payload.remaining_balance = parseFloat(remainingBalance || "0");
      payload.due_date = dueDate || null;
      payload.payment_date = null;
      payload.total_paid_amount = 0;
    } else {
      if (isDepositUnlocked) {
        payload.deposit_amount = parseFloat(depositAmount || "0");
        payload.deposit_date = depositDate || null;
        payload.remaining_balance = parseFloat(remainingBalance || "0");
        payload.due_date = dueDate || null;
        payload.payment_date = null;
        payload.total_paid_amount = 0;
      } else {
        payload.payment_date = paymentDate || null;
        payload.total_paid_amount = parseFloat(totalPaidAmount || "0");
      }
    }

    let url = "/api/deposit-transactions";
    let method = "POST";

    if (formMode === "edit") {
      url = `/api/deposit-transactions/${encodeURIComponent(editTxId)}`;
      method = "PUT";
    }

    try {
      const response = await fetch(`${url}?token=${token}&admin_line_id=${adminLineId}`, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert("บันทึกข้อมูลมัดจำสำเร็จ!");
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
      <div className="header-container">
        <h2>ระบบมัดจำ (Deposit Transactions)</h2>
        <div className="action-buttons">
          <Link href={getHomeUrl()} className="btn btn-default">
            <ArrowLeft size={24} /> กลับหน้าหลัก
          </Link>
          <button type="button" onClick={loadData} className="btn btn-default" disabled={loading}>
            <RefreshCw size={24} className={loading ? "animate-spin" : ""} /> รีเฟรช
          </button>
          <button type="button" onClick={clearForm} className="btn btn-primary">
            <Plus size={24} /> สร้างรายการมัดจำ
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
                placeholder="ค้นหาชื่อลูกค้า, สินค้า หรือ ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <span className="filter-label">ปิดยอดแล้ว:</span>
              <div className="filter-group">
                <button type="button" className={`filter-btn ${closedFilter === "ALL" ? "active" : ""}`} onClick={() => changeClosedFilter("ALL")}>ทั้งหมด</button>
                <button type="button" className={`filter-btn ${closedFilter === "NO" ? "active" : ""}`} onClick={() => changeClosedFilter("NO")}>เปิดอยู่ (NO)</button>
                <button type="button" className={`filter-btn ${closedFilter === "YES" ? "active" : ""}`} onClick={() => changeClosedFilter("YES")}>ปิดแล้ว (YES)</button>
              </div>
            </div>

            <div>
              <span className="filter-label">ซ่อนรายการที่ชำระแล้ว:</span>
              <div className="filter-group">
                <button type="button" className={`filter-btn ${excludePaidFilter === "YES" ? "active" : ""}`} onClick={() => setExcludePaidFilter("YES")}>YES</button>
                <button type="button" className={`filter-btn ${excludePaidFilter === "NO" ? "active" : ""}`} onClick={() => setExcludePaidFilter("NO")}>NO</button>
              </div>
            </div>

            <div>
              <span className="filter-label">สถานะจากระบบ:</span>
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
                  <th className="col-id">Transaction ID</th>
                  <th className="col-product">รหัสสินค้า</th>
                  <th className="col-customer">ชื่อลูกค้า</th>
                  <th className="col-phone">เบอร์โทร</th>
                  <th className="col-channel">ช่องทาง</th>
                  <th className="col-sys-status">สถานะจากระบบ</th>
                  <th className="col-amount">ยอดเงินมัดจำที่ชำระ</th>
                  <th className="col-date">วันที่ชำระเงินมัดจำ</th>
                  <th className="col-balance">ยอดคงเหลือ</th>
                  <th className="col-due-date">กำหนดชำระ</th>
                  <th className="col-paid">ยอดเงินที่ชำระ</th>
                  <th className="col-pay-date">วันที่ชำระ</th>
                  <th className="col-admin-status">สถานะจากแอดมิน</th>
                  <th className="col-closed">ปิดยอดแล้ว</th>
                  <th className="col-note">หมายเหตุ</th>
                  <th className="col-admin-name">แอดมินที่ทำรายการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={13} className="table-empty-row">กำลังดึงข้อมูลการมัดจำ...</td></tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr><td colSpan={13} className="table-empty-row no-match">ไม่พบข้อมูลการมัดจำที่ตรงเงื่อนไข</td></tr>
                ) : (
                  filteredTransactions.map((x) => {
                    const depositList = x.transaction_deposit;
                    const dData = Array.isArray(depositList) ? depositList[0] : depositList;
                    const { statusText, badgeClass, durationText } = calculateOverdueAndDuration(x);

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
                        <td><span className={`status-badge ${badgeClass}`}>{statusText}</span></td>
                        <td>{dData?.deposit_amount ? Number(dData.deposit_amount).toLocaleString() : "0"} บ.</td>
                        <td>{dData?.deposit_date || "-"}</td>
                        <td>
                          <div className={(dData?.remaining_balance && Number(dData.remaining_balance) > 0) ? "table-overdue-red" : "table-overdue-green"}>
                            {dData?.remaining_balance ? Number(dData.remaining_balance).toLocaleString() : "0"} บ.
                          </div>
                          <div className="table-txt-small-italic">
                            ({durationText})
                          </div>
                        </td>
                        <td>{dData?.due_date || "-"}</td>
                        <td>{dData?.total_paid_amount ? Number(dData.total_paid_amount).toLocaleString() : "-"}</td>
                        <td>{dData?.payment_date || "-"}</td>
                        <td>{dData?.input_status || "-"}</td>
                        <td><span className={`status-badge ${x.closed === "YES" ? "closed-yes" : ""}`}>{x.closed}</span></td>
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

        {/* ฝั่งขวา: ฟอร์มจัดการมัดจำ */}
        <div className="form-card">
          <h3>
            {formMode === "add" ? <PlusCircle size={24} /> : <SquarePen size={24} />}
            <span className="form-title-text">{formMode === "add" ? "สร้างรายการมัดจำ" : "จัดการรายการมัดจำ"}</span>
          </h3>
          
          <form onSubmit={handleFormSubmit}>
            <div className="form-sub-header">
              <span className="form-sub-title">รายละเอียดการมัดจำ</span>
              {formMode === "edit" && (
                <label className="form-edit-checkbox-label">
                  <input type="checkbox" checked={isDepositUnlocked} onChange={handleDepositUnlockChange} />
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
                disabled={formMode === "edit" && !isDepositUnlocked}
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
                disabled={formMode === "edit" && !isDepositUnlocked}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            {/* 🆕 เพิ่ม Input: chat_link */}
            <div className="form-group">
              <label htmlFor="chat_link">ลิงก์แชทลูกค้า</label>
              <input
                type="url"
                id="chat_link"
                placeholder="วางลิงก์แชท เช่น https://line.me/..."
                disabled={formMode === "edit" && !isDepositUnlocked}
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
                disabled={formMode === "edit" && !isDepositUnlocked}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            {/* 🆕 เพิ่ม Input: channel */}
            <div className="form-group">
              <label htmlFor="channel">ช่องทางติดต่อ</label>
              <select
                id="channel"
                disabled={formMode === "edit" && !isDepositUnlocked}
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
            {/* <div className="form-sub-title text-blue">รายละเอียดการมัดจำ</div> */}

            <div className="form-group">
              <label>ยอดเงินมัดจำที่ชำระ</label>
              <input
                type="number"
                step="0.01"
                required
                disabled={formMode === "edit" && !isDepositUnlocked}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>วันที่ชำระเงินมัดจำ</label>
              <input
                type="date"
                required
                disabled={formMode === "edit" && !isDepositUnlocked}
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>ยอดชำระครั้งถัดไป</label>
              <input
                type="number"
                step="0.01"
                required
                disabled={formMode === "edit" && !isDepositUnlocked}
                value={remainingBalance}
                onChange={(e) => setRemainingBalance(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>วันครบกำหนดชำระครั้งถัดไป</label>
              <input
                type="date"
                required
                disabled={formMode === "edit" && !isDepositUnlocked}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* โซนบันทึกการรับชำระเงิน */}
            {formMode === "edit" && (
              <>
                <hr className="divider-dashed" />
                <div className={`inner-payment-card ${isDepositUnlocked ? "disabled-zone" : "active-zone"}`}>
                  <div className="form-sub-title text-green">บันทึกการชำระเงิน</div>
                  {isDepositUnlocked && <small className="text-red d-block mb-2">*(โหมดแก้ไขข้อมูลหลัก: ห้ามบันทึกส่วนชำระเงิน)</small>}
                  
                  <div className="form-group">
                    <label htmlFor="payment_date">วันที่ชำระ</label>
                    <input
                      type="date"
                      id="payment_date"
                      disabled={isDepositUnlocked} 
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="total_paid_amount">ยอดเงินที่ชำระ</label>
                    <input
                      type="number"
                      step="0.01"
                      id="total_paid_amount"
                      placeholder="0.00"
                      disabled={isDepositUnlocked} 
                      value={totalPaidAmount}
                      onChange={(e) => setTotalPaidAmount(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="closed">ต้องการปิดยอด/รับสินค้าเลยหรือไม่?</label>
                    <select
                      id="closed"
                      disabled={isDepositUnlocked}
                      value={closed}
                      onChange={(e) => setClosed(e.target.value)}
                    >
                      <option value="NO">NO (ยังค้างชำระอยู่)</option>
                      <option value="YES">YES (ชำระครบ)</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <hr className="divider-dashed" />

            {/* 🆕 เพิ่ม Input: input_status */}
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
                <><Loader2 size={16} className="animate-spin" /> กำลังบันทึก...</>
              ) : (
                <><Save size={16} /> บันทึกข้อมูลมัดจำ</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
