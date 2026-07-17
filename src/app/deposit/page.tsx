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

// 🌟 กำหนด Type โครงสร้างข้อมูลที่ส่งมาจาก FastAPI หลังบ้านสำหรับ Deposit
interface DepositDetail {
  interest_per_month: number;
  payment_date?: string; // วันที่ทำรายการฝาก/ถอน/จ่ายดอกเบี้ยล่าสุด
  next_due_date?: string; // วันที่ครบกำหนดรอบถัดไป
  input_status?: string;
  total_paid_amount: number; // ยอดรวมที่ชำระหรือทำรายการ
}

interface Transaction {
  transaction_id: string;
  product: string; // ในบริบทนี้อาจเป็นประเภทบัญชีหรือรหัสออม
  customer_name: string;
  phone_number?: string;
  channel: string;
  current_status: string;
  closed: string;
  note?: string;
  chat_link?: string;
  updated_by_name?: string;
  created_by_name?: string;
  transaction_deposit?: DepositDetail[] | DepositDetail; // เปลี่ยนจาก transaction_pawn
}

export default function DepositPage() {
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
  const [isDepositUnlocked, setIsDepositUnlocked] = useState(false); // เปลี่ยนจาก isPawnUnlocked
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
  // 2. ฟังก์ชันโหลดข้อมูลหลักจาก API (FastAPI backend ของ Deposit)
  // ==========================================
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

  // ==========================================
  // 3. ฟังก์ชันคำนวณวันคงเหลือ / ยอดค้างชำระ (Business Logic ฝากเงิน/ปันผลดอกเบี้ย)
  // ==========================================
  const calculateOverdueAndDuration = (tx: Transaction) => {
    const depositList = tx.transaction_deposit;
    const dData = Array.isArray(depositList) ? depositList[0] : depositList;

    let statusText = "ยังไม่ถึงกำหนด";
    let badgeClass = "st-normal";
    let overdueAmount = 0;
    let durationText = "";

    if (tx.current_status === "ชำระแล้ว") {
      statusText = "ชำระแล้ว";
      badgeClass = "closed-yes";
      durationText = "จัดการดอกเบี้ยแล้ว";
    } else if (dData && dData.next_due_date) {
      const dueDate = new Date(dData.next_due_date);
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
        overdueAmount = chargeableMonths * (dData.interest_per_month || 0);
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
    setIsDepositUnlocked(false);
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
    const depositList = tx.transaction_deposit;
    const dData: DepositDetail = Array.isArray(depositList) ? depositList[0] : (depositList || { interest_per_month: 0, total_paid_amount: 0 });
    const { overdueAmount } = calculateOverdueAndDuration(tx);

    setFormMode("edit");
    setEditTxId(tx.transaction_id);
    setIsDepositUnlocked(false);

    setProduct(tx.product || "");
    setCustomerName(tx.customer_name || "");
    setChatLink(tx.chat_link || "");
    setPhoneNumber(tx.phone_number || "");
    setChannel(tx.channel || "LINE");
    setInterestPerMonth(String(dData.interest_per_month || 0));
    
    setCurrentDueDate(dData.next_due_date || "");
    setCurrentOverdueBalance(overdueAmount);
    
    const initialPayDate = dData.payment_date && dData.payment_date !== "-" ? dData.payment_date : todayStr;
    setPaymentDate(initialPayDate);
    setOriginalPaymentDate(initialPayDate);
    
    setTotalPaidAmount(String(dData.total_paid_amount || 0));
    setClosed(tx.closed || "NO");
    setNextDueDateEdit("");
    
    setInputStatus(dData.input_status || "");
    setNote(tx.note || "");
  };

  const handleDepositUnlockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setIsDepositUnlocked(isChecked);

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
      if (isDepositUnlocked) {
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
      is_edit_deposit_master: isDepositUnlocked, // เปลี่ยนให้ตรงกับหลังบ้านของ Deposit
      created_by_line_id: adminLineId,
      created_by_name: adminName,
      chat_link: chatLink
    };

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
        <h2>ระบบฝากเงินออมทรัพย์ (Deposit Transactions)</h2>
        <div className="action-buttons">
          <Link href={getHomeUrl()} className="btn btn-default">
            <ArrowLeft size={24} /> กลับหน้าหลัก
          </Link>
          <button type="button" onClick={loadData} className="btn btn-default" disabled={loading}>
            <RefreshCw size={24} className={loading ? "animate-spin" : ""} /> รีเฟรช
          </button>
          <button type="button" onClick={clearForm} className="btn btn-primary">
            <Plus size={24} /> สร้างรายการฝากออม
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
                placeholder="ชื่อลูกค้า ประเภทบัญชี หรือ Transaction ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <span className="filter-label">ปิดบัญชีแล้ว:</span>
              <div className="filter-group">
                <button type="button" className={`filter-btn ${closedFilter === "ALL" ? "active" : ""}`} onClick={() => changeClosedFilter("ALL")}>ทั้งหมด</button>
                <button type="button" className={`filter-btn ${closedFilter === "NO" ? "active" : ""}`} onClick={() => changeClosedFilter("NO")}>เปิดอยู่ (NO)</button>
                <button type="button" className={`filter-btn ${closedFilter === "YES" ? "active" : ""}`} onClick={() => changeClosedFilter("YES")}>ปิดแล้ว (YES)</button>
              </div>
            </div>

            <div>
              <span className="filter-label">ซ่อนรายการที่จ่ายแล้ว:</span>
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
                  <th className="col-product">ประเภท/รหัสออม</th>
                  <th className="col-customer">ชื่อลูกค้า</th>
                  <th className="col-phone">เบอร์โทร</th>
                  <th className="col-channel">ช่องทาง</th>
                  <th className="col-sys-status">สถานะจากระบบ</th>
                  <th className="col-interest">ดอกเบี้ยปันผล/เดือน</th>
                  <th className="col-pay-date">วันที่ทำรายการล่าสุด</th>
                  <th className="col-pay-amount">ยอดเงินที่ทำรายการ</th>
                  <th className="col-due-date">กำหนดรอบถัดไป</th>
                  <th className="col-overdue">ยอดค้างจ่าย/สะสม</th>
                  <th className="col-admin-status">สถานะจากแอดมิน</th>
                  <th className="col-closed">ปิดบัญชี</th>
                  <th className="col-note">หมายเหตุ</th>
                  <th className="col-admin-name">แอดมินที่ทำรายการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={15} className="table-empty-row">
                      กำลังดึงข้อมูลการฝากออมทรัพย์...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="table-empty-row no-match">
                      ไม่พบข้อมูลการฝากออมทรัพย์ที่ตรงเงื่อนไข
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((x) => {
                    const depositList = x.transaction_deposit;
                    const dData = Array.isArray(depositList) ? depositList[0] : depositList;
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
                        <td>{dData?.interest_per_month ? Number(dData.interest_per_month).toLocaleString() : "0"} บ.</td>
                        <td>{dData?.payment_date || "-"}</td>
                        <td className="table-txt-blue-bold">
                          {dData?.total_paid_amount ? Number(dData.total_paid_amount).toLocaleString() : "0"} บ.
                        </td>
                        <td>{dData?.next_due_date || "-"}</td>
                        <td>
                          <div className={overdueAmount > 0 ? "table-overdue-red" : "table-overdue-green"}>
                            {overdueAmount.toLocaleString()} บ.
                          </div>
                          <div className="table-txt-small-italic">
                            ({durationText})
                          </div>
                        </td>
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

        {/* ฝั่งขวา: ฟอร์มสร้าง/แก้ไขข้อมูลแบบ Sticky */}
        <div className="form-card">
          <h3>
            {formMode === "add" ? <PlusCircle size={24} /> : <SquarePen size={24} />}
            <span className="form-title-text">{formMode === "add" ? "สร้างรายการฝากออม" : "บันทึกรายการฝากออม"}</span>
          </h3>
          
          <form onSubmit={handleFormSubmit}>
            <div className="form-sub-header">
              <span className="form-sub-title">รายละเอียดการฝากออมทรัพย์</span>
              
              {formMode === "edit" && (
                <label className="form-edit-checkbox-label">
                  <input type="checkbox" checked={isDepositUnlocked} onChange={handleDepositUnlockChange} />
                  แก้ไขข้อมูลหลัก
                </label>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="product">ประเภท/รหัสออม</label>
              <input
                type="text"
                id="product"
                required
                placeholder="เช่น บัญชีออมทรัพย์พิเศษ, รหัสทองคำ"
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

            <div className="form-group">
              <label htmlFor="chat_link">ลิงก์แชทลูกค้า</label>
              <input
                type="text"
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

            <div className="form-group">
              <label htmlFor="interest_per_month">ดอกเบี้ยปันผลต่อเดือน (บาท)</label>
              <input
                type="number"
                step="0.01"
                id="interest_per_month"
                required
                placeholder="0.00"
                disabled={formMode === "edit" && !isDepositUnlocked}
                value={interestPerMonth}
                onChange={(e) => setInterestPerMonth(e.target.value)}
              />
            </div>

            {formMode === "add" && (
              <div className="form-group">
                <label htmlFor="next_due_date_add" className="label-blue">วันครบกำหนดรอบถัดไป</label>
                <input
                  type="date"
                  id="next_due_date_add"
                  required
                  value={nextDueDateAdd}
                  onChange={(e) => setNextDueDateAdd(e.target.value)}
                />
              </div>
            )}

            <hr className="divider-dashed" />

            {formMode === "edit" && (
              <div>
                <div className="form-group">
                  <label className="label-blue">วันครบกำหนดรอบ (ปัจจุบัน)</label>
                  <input
                    type="date"
                    disabled={!isDepositUnlocked}
                    value={currentDueDate}
                    onChange={(e) => setCurrentDueDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="label-muted-bold">ยอดปันผลสะสม (รอบปัจจุบัน)</label>
                  <input
                    type="text"
                    className={`input-overdue-balance ${currentOverdueBalance > 0 ? "red" : "green"}`}
                    readOnly
                    value={currentOverdueBalance.toLocaleString() + " บ."}
                  />
                </div>

                {isDepositUnlocked && (
                  <div className="alert-warning-box">
                    <span>
                      ⚠️ หมายเหตุ: กรณีแก้ไขข้อมูลหลักบัญชีฝากเงินเดิม จะไม่สามารถอัปเดตข้อมูลธุรกรรมล่าสุดพร้อมกันได้ 
                    </span>
                  </div>
                )}

                <div className={`inner-payment-card ${isDepositUnlocked ? "unlocked" : ""}`}>
                  <div className="form-group">
                    <label htmlFor="payment_date">วันที่ทำธุรกรรม</label>
                    <input
                      type="date"
                      id="payment_date"
                      disabled={isDepositUnlocked}
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="total_paid_amount">จำนวนเงิน (บาท)</label>
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
                    <label htmlFor="closed">ต้องการปิดบัญชีเงินฝากนี้เลยหรือไม่?</label>
                    <select
                      id="closed"
                      disabled={isDepositUnlocked}
                      value={closed}
                      onChange={(e) => setClosed(e.target.value)}
                    >
                      <option value="NO">NO (เปิดบัญชีอยู่ดำเนินรายการตามรอบถัดไป)</option>
                      <option value="YES">YES (ปิดบัญชี/ถอนเงินคืนทั้งหมด)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="next_due_date_edit" className="label-blue">วันครบกำหนดรอบถัดไป</label>
                  <input
                    type="date"
                    id="next_due_date_edit"
                    required={!isDepositUnlocked && closed !== "YES"}
                    disabled={isDepositUnlocked || closed === "YES"}
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
                placeholder="ระบุหมายเหตุเพิ่มเติม..."
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
                <>
                  <Loader2 size={16} className="animate-spin" /> กำลังบันทึกข้อมูล...
                </>
              ) : (
                <>
                  <Save size={16} /> บันทึกข้อมูลการฝากออมทรัพย์
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
