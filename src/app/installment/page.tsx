"use client";

export const dynamic = "force-dynamic";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { 
  ArrowLeft,
  RefreshCw, 
  Plus, 
  PlusCircle, 
  CalendarRange, 
  BadgeDollarSign, 
  Save, 
  ShieldCheck, 
  Search,
  Loader2
} from "lucide-react";

export default function InstallmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- States ---
  const [token, setToken] = useState("");
  const [adminLineId, setAdminLineId] = useState("");
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPayoffSubmitting, setIsPayoffSubmitting] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClosed, setFilterClosed] = useState("NO");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterExcludePaid, setFilterExcludePaid] = useState("YES");

  // Form State
  const [formMode, setFormMode] = useState<"add" | "edit_payment">("add");
  const [editTxId, setEditTxId] = useState("");
  const [product, setProduct] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [chatLink, setChatLink] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [channel, setChannel] = useState("LINE");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [totalPeriods, setTotalPeriods] = useState("6");
  const [monthlyDueDay, setMonthlyDueDay] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [startYear, setStartYear] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [totalPaidAmount, setTotalPaidAmount] = useState("");
  const [inputStatus, setInputStatus] = useState("");
  const [note, setNote] = useState("");

  // Labels & UI Info States (สำหรับโหมดชำrateเงิน)
  const [lblPeriod, setLblPeriod] = useState("-");
  const [lblAmount, setLblAmount] = useState("0.00");
  const [overdueNoticeList, setOverdueNoticeList] = useState<string[]>([]);
  const [overdueSumAmount, setOverdueSumAmount] = useState(0);

  const today = useRef(new Date());
  const todayStr = today.current.toISOString().split("T")[0];

  // --- 1. Initial Load & Session Check ---
  useEffect(() => {
    const currentToken = searchParams.get("token") || "";
    const name = sessionStorage.getItem("admin_name");
    const lineId = sessionStorage.getItem("admin_line_id") || "";
    
    setToken(currentToken);
    setAdminLineId(lineId);

    if (!name || !lineId) {
      const currentParams = new URLSearchParams(window.location.search);
      currentParams.set("goto", window.location.pathname);
      window.location.href = "https://hheng-system.vercel.app/liff-router?" + currentParams.toString();
      return;
    }

    // เจนค่าเริ่มต้นของ Dropdown วันเวลา
    setStartMonth((today.current.getMonth() + 1).toString());
    setMonthlyDueDay(today.current.getDate().toString());
    setStartYear(today.current.getFullYear().toString());
    setPaymentDate(todayStr);

    loadData(currentToken, lineId);
  }, [searchParams]);

  // --- 2. Load Data ---
  const loadData = async (currentToken = token, currentLineId = adminLineId) => {
    try {
      const txIdFromUrl = searchParams.get("tx_id")?.trim();
      const r = await fetch(`/api/installment-transactions?token=${currentToken}&admin_line_id=${currentLineId}&_=${new Date().getTime()}`);
      const data = await r.json();
      
      if (Array.isArray(data)) {
        setAllTransactions(data);

        // ดักเอาไว้ตรวจถ้าเจอ tx_id ใน URL ให้เปิดโหมดชำระเงินทันที
        if (txIdFromUrl) {
          const found = data.find((x: any) => {
            const insList = x.transaction_installment;
            const pData = Array.isArray(insList) && insList.length > 0 ? insList[0] : (insList || {});
            return pData.transaction_id === txIdFromUrl;
          });

          if (found) {
            const insList = found.transaction_installment;
            const pData = Array.isArray(insList) && insList.length > 0 ? insList[0] : (insList || {});
            
            openPaymentMode(found, pData, data);
          }
        }
      }
    } catch (err) {
      console.error("เกิดข้อผิดพลาดในการโหลดข้อมูลสัญญา:", err);
    }
  };

  // --- 3. ฟังก์ชันพรีวิวตารางกำหนดงวดผ่อนชำระ ---
  const renderDuePreviews = () => {
    const day = parseInt(monthlyDueDay);
    const month = parseInt(startMonth);
    const year = parseInt(startYear);
    const periods = parseInt(totalPeriods) || 0;
    const amount = parseFloat(installmentAmount) || 0;

    if (!day || day < 1 || day > 31 || !periods) {
      return <span style={{ color: "#9ca3af", fontSize: "11px" }}>ระบุวันที่ชำระเพื่อพรีวิวตรวจสอบตารางกำหนดงวด...</span>;
    }

    const items = [];
    for (let i = 0; i < periods; i++) {
      let totalMonths = (month - 1) + i;
      let tYear = year + Math.floor(totalMonths / 12);
      let tMonth = (totalMonths % 12) + 1;
      let lastDay = new Date(tYear, tMonth, 0).getDate();
      let actualDay = Math.min(day, lastDay);
      let dateStr = `${actualDay.toString().padStart(2, "0")}/${tMonth.toString().padStart(2, "0")}/${tYear}`;
      
      items.push(
        <div className="preview-item" key={i}>
          <span>งวดที่ {i + 1}</span>
          <span><strong>{dateStr}</strong></span>
          <span style={{ color: "#2563eb" }}>{amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} บ.</span>
        </div>
      );
    }
    return items;
  };

  // --- 4. ฟังก์ชันจัดการ Clear Form ---
  const clearForm = () => {
    setFormMode("add");
    setEditTxId("");
    setProduct("");
    setCustomerName("");
    setChatLink("");
    setPhoneNumber("");
    setChannel("LINE");
    setInstallmentAmount("");
    setTotalPeriods("6");
    setMonthlyDueDay(today.current.getDate().toString());
    setStartMonth((today.current.getMonth() + 1).toString());
    setStartYear(today.current.getFullYear().toString());
    setPaymentDate(todayStr);
    setTotalPaidAmount("");
    setInputStatus("");
    setNote("");
    setOverdueNoticeList([]);
    setOverdueSumAmount(0);
  };

  // --- 5. ฟังก์ชันเปลี่ยนเข้าสู่โหมดชำระเงิน ---
  const openPaymentMode = (x: any, pData: any, currentTransactionsList = allTransactions) => {
    setFormMode("edit_payment");
    setEditTxId(pData.transaction_id || "");
    
    setProduct(x.product || "");
    setCustomerName(x.customer_name || "");
    setPhoneNumber(x.phone_number || "");
    setChannel(x.channel || "LINE");
    setChatLink(x.chat_link || "");
    
    setLblPeriod(`งวดที่ ${pData.current_period || 1} จากทั้งหมด ${pData.total_periods || 1} งวด`);
    setLblAmount(Number(pData.installment_amount || 0).toLocaleString());

    setPaymentDate(pData.payment_date || todayStr);
    setTotalPaidAmount(pData.installment_amount || "");
    setInputStatus(pData.input_status === "-" ? "" : (pData.input_status || ""));
    setNote(x.note === "-" ? "" : (x.note || ""));

    // [ระบบตรวจสอบงวดค้างชำระ]
    if (currentTransactionsList && Array.isArray(currentTransactionsList)) {
      const currentPeriodNum = parseInt(pData.current_period) || 0;
      
      const unPaidPreviousPeriods = currentTransactionsList.filter(item => {
        const itemInsList = item.transaction_installment;
        const itemPData = Array.isArray(itemInsList) && itemInsList.length > 0 ? itemInsList[0] : (itemInsList || {});
        const itemPeriodNum = parseInt(itemPData.current_period) || 0;
        
        return item.customer_name === x.customer_name && 
               item.current_status !== "ชำระแล้ว" && 
               itemPeriodNum < currentPeriodNum;
      });

      if (unPaidPreviousPeriods.length > 0) {
        unPaidPreviousPeriods.sort((a, b) => {
          const pA = parseInt(a.transaction_installment?.[0]?.current_period || 0);
          const pB = parseInt(b.transaction_installment?.[0]?.current_period || 0);
          return pA - pB;
        });

        let sumAmount = 0;
        const labels = unPaidPreviousPeriods.map(item => {
          const itemPData = item.transaction_installment?.[0] || {};
          const instAmt = parseFloat(itemPData.installment_amount) || 0;
          sumAmount += instAmt;
          return `งวดที่ ${itemPData.current_period} (${instAmt.toLocaleString()} บ.)`;
        });

        setOverdueNoticeList(labels);
        setOverdueSumAmount(sumAmount);
      } else {
        setOverdueNoticeList([]);
        setOverdueSumAmount(0);
      }
    }
  };

  // --- 6. บันทึก Transaction (Submit Form) ---
  const saveTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const adminName = sessionStorage.getItem("admin_name") || "Unknown";
    const lineId = adminLineId || "Unknown";

    let url = "/api/installment-transactions";
    let method = "POST";
    let payload: any = {};

    if (formMode === "edit_payment") {
      url = `/api/installment-transactions/${encodeURIComponent(editTxId)}`;
      method = "PUT";
      payload = {
        payment_date: paymentDate || null,
        total_paid_amount: parseFloat(totalPaidAmount || "0"),
        input_status: inputStatus,
        note: note,
        product: product
      };
    } else {
      payload = {
        product: product,
        customer_name: customerName,
        phone_number: phoneNumber,
        channel: channel,
        installment_amount: parseFloat(installmentAmount || "0"),
        total_periods: parseInt(totalPeriods || "1"),
        current_period: 1,
        monthly_due_day: parseInt(monthlyDueDay || "1"),
        start_month: parseInt(startMonth || "1"),
        start_year: parseInt(startYear || "2026"),
        payment_date: null,
        total_paid_amount: 0.0,
        input_status: inputStatus,
        note: note,
        created_by_line_id: lineId,
        created_by_name: adminName,
        chat_link: chatLink
      };
    }

    try {
      const response = await fetch(`${url}?token=${token}&admin_line_id=${lineId}`, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert("บันทึกข้อมูลเรียบร้อยแล้ว");
        clearForm();
        await loadData();
      } else {
        const err = await response.json();
        alert("เกิดข้อผิดพลาด: " + (err.detail || "ไม่สามารถบันทึกได้"));
      }
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 7. ฟังก์ชันปิดยอดสัญญาก่อนกำหนด ---
  const payoffEntireContract = async () => {
    if (!editTxId) return alert("กรุณาเลือกรายการผ่อนก่อนกดปิดยอด");

    if (confirm("ยืนยันปิดยอดผ่อนชำระก่อนกำหนดใช่หรือไม่? ระบบจะบันทึกยอดเงินงวดนี้ และแก้ไขสถานะงวดที่เหลือทั้งหมดให้เป็นชำระแล้วทันที")) {
      setIsPayoffSubmitting(true);
      const adminName = sessionStorage.getItem("admin_name") || "Unknown";
      const lineId = adminLineId || "Unknown";

      const payloadData = {
        payment_date: paymentDate || todayStr,
        total_paid_amount: parseFloat(totalPaidAmount || "0"),
        input_status: inputStatus,
        created_by_line_id: lineId,
        created_by_name: adminName
      };

      try {
        const r = await fetch(`/api/installment-transactions/${encodeURIComponent(editTxId)}/payoff?token=${token}&admin_line_id=${lineId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadData)
        });

        if (r.ok) {
          alert("เสร็จสิ้นการปิดยอดผ่อนชำระทั้งหมด");
          clearForm();
          await loadData();
        } else {
          alert("ไม่สามารถดำเนินการปิดยอดผ่อนชำระทั้งหมดได้");
        }
      } catch (e) {
        console.error(e);
        alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
      } finally {
        setIsPayoffSubmitting(false);
      }
    }
  };

  // --- 8. ฟังก์ชัน Void สัญญา ---
  const voidEntireContract = async (tx_id: string) => {
    if (!tx_id) return;

    if (confirm(`ยกเลิกรายการผ่อนชำระกลุ่มนี้ทั้งหมดใช่หรือไม่?\nการดำเนินการนี้จะทำการยกเลิกรายการผ่อนชำระนี้ทั้งหมด และไม่สามารถย้อนกลับได้`)) {
      try {
        const r = await fetch(`/api/installment-transactions/${encodeURIComponent(tx_id)}/void?token=${token}&admin_line_id=${adminLineId}`, {
          method: "POST"
        });
        if (r.ok) {
          alert("ยกเลิกรายการผ่อนชำระเรียบร้อยแล้ว");
          clearForm();
          loadData();
        } else {
          alert("ไม่สามารถยกเลิกรายการผ่อนชำระได้");
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  // --- 9. ฟังก์ชันเปลี่ยน Closed Filter แบบล็อกปุ่มสวิตช์ซ่อนอัตโนมัติ ---
  const handleClosedFilterChange = (val: string) => {
    setFilterClosed(val);
    if (val === "YES") {
      setFilterExcludePaid("NO");
      setFilterStatus("ALL");
    }
  };

  // --- 10. ฟังก์ชันเปลี่ยน Status Filter ---
  const handleStatusFilterChange = (val: string) => {
    if (val !== "ALL" && val !== "ชำระแล้ว" && filterClosed === "YES") {
      setFilterClosed("NO");
    }
    setFilterStatus(val);
  };

  // --- 11. กรองข้อมูล (3 เลเยอร์ คล้ายเดิม) ---
  const getFilteredTransactions = () => {
    const q = searchQuery.toLowerCase().trim();
    const todayObj = new Date(todayStr);

    return allTransactions.filter(x => {
      // ดึงงวดแรกหรือข้อมูลผ่อนเบื้องต้น
      const insList = x.transaction_installment;
      const pData = Array.isArray(insList) && insList.length > 0 ? insList[0] : (insList || {});

      // ป้องกันเรื่องสลับตัวแปร closed / status หลุดฟิลเตอร์
      const itemClosedStatus = x.closed || x.status || "NO";
      if (filterClosed !== "ALL" && itemClosedStatus !== filterClosed) return false;

      let cStatus = "ยังไม่ถึงกำหนด";
      if (x.current_status === "ชำrateแล้ว" || x.current_status === "ชำระแล้ว") {
        cStatus = "ชำระแล้ว";
      } else if (pData && (pData.due_date || pData.next_due_date)) {
        const rawDate = pData.due_date || pData.next_due_date;
        const dueDate = new Date(rawDate);
        if (dueDate.toDateString() === todayObj.toDateString()) cStatus = "ครบกำหนด";
        else if (dueDate < todayObj) cStatus = "เกินกำหนด";
      }

      if (filterStatus !== "ALL" && filterStatus !== cStatus) return false;
      if (filterExcludePaid === "YES" && cStatus === "ชำระแล้ว") return false;

      const name = (x.customer_name || "").toLowerCase();
      const txId = (pData.transaction_id || x.transaction_id || "").toLowerCase();
      const pId = (x.product || "").toLowerCase();
      const noteText = (x.note || "").toLowerCase();

      return q === "" || name.includes(q) || txId.includes(q) || pId.includes(q) || noteText.includes(q);
    });
  };

  // ตัวเลือกปีสำหรับเซเลคเตอร์
  const currentYearCE = today.current.getFullYear();
  const yearOptions = [];
  for (let y = currentYearCE - 1; y <= currentYearCE + 3; y++) {
    yearOptions.push(y);
  }

  const filteredData = getFilteredTransactions();
  const todayObj = new Date(todayStr);

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
        <h2>ระบบผ่อนชำระ (Installment Transactions)</h2>
        <div className="action-buttons">
          <Link href={getHomeUrl()} className="btn btn-default">
            <ArrowLeft size={14} /> กลับหน้าหลัก
          </Link>
          <button type="button" onClick={() => loadData(token, adminLineId)} className="btn btn-default" disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> รีเฟรช
          </button>
          <button type="button" onClick={clearForm} className="btn btn-primary">
            <Plus size={14} /> สร้างสัญญาสมาชิกผ่อน
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div>
              <span className="filter-label">ปิดสัญญาแล้ว:</span>
              <div className="filter-group">
                <button type="button" className={`filter-btn ${filterClosed === "ALL" ? "active" : ""}`} onClick={() => handleClosedFilterChange("ALL")}>ทั้งหมด</button>
                <button type="button" className={`filter-btn ${filterClosed === "NO" ? "active" : ""}`} onClick={() => handleClosedFilterChange("NO")}>เปิดอยู่ (NO)</button>
                <button type="button" className={`filter-btn ${filterClosed === "YES" ? "active" : ""}`} onClick={() => handleClosedFilterChange("YES")}>ปิดแล้ว (YES)</button>
              </div>
            </div>

            <div>
              <span className="filter-label">ซ่อนรายการชำระแล้ว:</span>
              <div className="filter-group">
                <button type="button" className={`filter-btn ${filterExcludePaid === "YES" ? "active" : ""}`} onClick={() => setFilterExcludePaid("YES")}>YES</button>
                <button type="button" className={`filter-btn ${filterExcludePaid === "NO" ? "active" : ""}`} onClick={() => setFilterExcludePaid("NO")}>NO</button>
              </div>
            </div>

            <div>
              <span className="filter-label">สถานะงวดชำระ:</span>
              <div className="filter-group">
                <button type="button" className={`filter-btn ${filterStatus === "ALL" ? "active" : ""}`} onClick={() => handleStatusFilterChange("ALL")}>ทั้งหมด</button>
                <button type="button" className={`filter-btn ${filterStatus === "ยังไม่ถึงกำหนด" ? "active" : ""}`} onClick={() => handleStatusFilterChange("ยังไม่ถึงกำหนด")}>ยังไม่ถึงกำหนด</button>
                <button type="button" className={`filter-btn ${filterStatus === "ครบกำหนด" ? "active" : ""}`} onClick={() => handleStatusFilterChange("ครบกำหนด")}>ครบกำหนด</button>
                <button type="button" className={`filter-btn ${filterStatus === "เกินกำหนด" ? "active" : ""}`} onClick={() => handleStatusFilterChange("เกินกำหนด")}>เกินกำหนด</button>
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="product-table">
              <thead>
                <tr>
                  <th style={{ minWidth: "120px" }}>Transaction ID</th>
                  <th style={{ minWidth: "160px" }}>รายการสินค้า</th>
                  <th style={{ minWidth: "130px" }}>ชื่อลูกค้า</th>
                  <th style={{ minWidth: "100px" }}>เบอร์โทร</th>
                  <th style={{ minWidth: "80px" }}>ช่องทาง</th>
                  <th style={{ minWidth: "100px" }}>ค่างวดผ่อน</th>
                  <th style={{ minWidth: "90px" }}>งวดปัจจุบัน</th>
                  <th style={{ minWidth: "110px" }}>กำหนดชำระ</th>
                  <th style={{ minWidth: "110px" }}>สถานะงวดนี้</th>
                  <th style={{ minWidth: "100px" }}>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="table-empty-row">กำลังดึงข้อมูลตารางผ่อนชำระ...</td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="table-empty-row no-match">ไม่พบข้อมูลสัญญาผ่อนชำระที่ตรงตามเงื่อนไข</td>
                  </tr>
                ) : (
                  filteredData.map((x, idx) => {
                    const insList = x.transaction_installment;
                    const pData = Array.isArray(insList) && insList.length > 0 ? insList[0] : (insList || {});
                    
                    return (
                      <tr key={pData.transaction_id || idx} onClick={() => openPaymentMode(x, pData, allTransactions)}>
                        <td><strong>{pData.transaction_id || x.transaction_id || "-"}</strong></td>
                        <td><small>{x.product || "-"}</small></td>
                        <td>
                          {x.chat_link ? (
                            <a href={x.chat_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#2563eb", textDecoration: "underline" }}>
                              {x.customer_name}
                            </a>
                          ) : (
                            x.customer_name
                          )}
                        </td>
                        <td>{x.phone_number || "-"}</td>
                        <td><small>{x.channel}</small></td>
                        <td>{pData.installment_amount ? Number(pData.installment_amount).toLocaleString() : "0"} บ.</td>
                        <td>{pData.current_period || 1} / {pData.total_periods || x.total_periods || 6}</td>
                        <td>{pData.due_date || pData.next_due_date || "-"}</td>
                        <td>
                          <span className={`status-badge ${x.current_status === "ชำระแล้ว" ? "closed-yes" : "overdue"}`}>
                            {x.current_status || "ค้างชำระ"}
                          </span>
                        </td>
                        <td>
                          <button 
                            type="button" 
                            className="btn btn-default"
                            style={{ padding: "4px 8px", fontSize: "11px", color: "#dc2626" }} 
                            onClick={(e) => { e.stopPropagation(); voidEntireContract(pData.transaction_id || x.transaction_id); }}
                          >
                            ยกเลิกสัญญา
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ฝั่งขวา: ฟอร์มสร้าง/บันทึกการรับค่างวด */}
        <div className="form-card">
          <h3>
            {formMode === "add" ? <PlusCircle size={18} /> : <BadgeDollarSign size={18} />}
            <span className="form-title-text">{formMode === "add" ? "สร้างสัญญาผ่อนใหม่" : "บันทึกชำระค่างวด"}</span>
          </h3>

          <form onSubmit={saveTransaction}>
            <div className="form-sub-header">
              <span className="form-sub-title">รายละเอียดข้อมูลสัญญา</span>
            </div>

            <div className="form-group">
              <label htmlFor="product">รายการสินค้า</label>
              <input
                type="text"
                id="product"
                required
                placeholder="ชื่อสินค้า/แบรนด์สินค้า"
                disabled={formMode === "edit_payment"}
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
                disabled={formMode === "edit_payment"}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="chat_link">ลิงก์ติดต่อลูกค้า</label>
              <input
                type="text"
                id="chat_link"
                placeholder="ลิ้งค์แชท Line / Facebook"
                disabled={formMode === "edit_payment"}
                value={chatLink}
                onChange={(e) => setChatLink(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone_number">เบอร์โทรศัพท์</label>
              <input
                type="text"
                id="phone_number"
                placeholder="กรอกเบอร์โทรศัพท์"
                disabled={formMode === "edit_payment"}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="channel">ช่องทางสั่งซื้อ</label>
              <select
                id="channel"
                disabled={formMode === "edit_payment"}
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                <option value="LINE">LINE</option>
                <option value="FB">FB</option>
                <option value="IG">IG</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* โหมดสร้างสัญญาใหม่: กำหนดแพ็กเกจส่งผ่อน */}
            {formMode === "add" && (
              <>
                <div className="form-group">
                  <label htmlFor="installment_amount">ยอดส่งต่องวด (บาท)</label>
                  <input
                    type="number"
                    id="installment_amount"
                    required
                    placeholder="0.00"
                    value={installmentAmount}
                    onChange={(e) => setInstallmentAmount(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="total_periods">จำนวนงวดผ่อนทั้งหมด</label>
                  <select id="total_periods" value={totalPeriods} onChange={(e) => setTotalPeriods(e.target.value)}>
                    <option value="3">3 งวด</option>
                    <option value="6">6 งวด</option>
                    <option value="9">9 งวด</option>
                    <option value="12">12 งวด</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="label-blue">วันนัดชำระงวดแรก (วัน / เดือน / ปี)</label>
                  <div className="due-date-row">
                    <input type="number" id="monthly_due_day" required className="form-control" placeholder="วันที่" min="1" max="31" value={monthlyDueDay} onChange={(e) => setMonthlyDueDay(e.target.value)} />
                    <select id="start_month" required className="form-control" value={startMonth} onChange={(e) => setStartMonth(e.target.value)}>
                      <option value="1">ม.ค.</option><option value="2">ก.พ.</option><option value="3">มี.ค.</option>
                      <option value="4">เม.ย.</option><option value="5">พ.ค.</option><option value="6">มิ.ย.</option>
                      <option value="7">ก.ค.</option><option value="8">ส.ค.</option><option value="9">ก.ย.</option>
                      <option value="10">ต.ค.</option><option value="11">พ.ย.</option><option value="12">ธ.ค.</option>
                    </select>
                    <select id="start_year" required className="form-control" value={startYear} onChange={(e) => setStartYear(e.target.value)}>
                      {yearOptions.map(y => (
                        <option key={y} value={y}>ค.ศ. {y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: "12px", fontWeight: "600" }}>พรีวิวตารางค่างวด:</label>
                  <div className="preview-container">
                    {renderDuePreviews()}
                  </div>
                </div>
              </>
            )}

            {/* โหมดบันทึกการชำระเงิน (Edit Payment) */}
            {formMode === "edit_payment" && (
              <>
                <hr className="divider-dashed" />
                <div style={{ background: "#eff6ff", padding: "12px", border: "1px solid #bfdbfe", borderRadius: "6px", marginBottom: "12px" }}>
                  <div style={{ fontSize: "13px", fontWeight: "bold", color: "#1e40af" }}>{lblPeriod}</div>
                  <div style={{ fontSize: "12px", color: "#1e40af" }}>ยอดที่ต้องชำระตามดิว: <strong style={{ fontSize: "14px" }}>{lblAmount} บาท</strong></div>
                </div>

                {overdueNoticeList.length > 0 && (
                  <div className="alert-warning-box">
                    <div>⚠️ ลูกค้ามียอดค้างชำระจากงวดก่อนหน้า!</div>
                    {overdueNoticeList.map((lbl, idx) => <div key={idx} style={{ fontWeight: "normal", paddingLeft: "8px" }}>- {lbl}</div>)}
                    <div style={{ marginTop: "4px", borderTop: "1px dashed #fca5a5", paddingTop: "4px" }}>รวมยอดค้างเก่า: {overdueSumAmount.toLocaleString()} บ.</div>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="payment_date" className="label-blue">วันที่โอนชำระ</label>
                  <input
                    type="date"
                    id="payment_date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="total_paid_amount" className="label-blue">ยอดเงินที่ชำระเข้ามาจริง (บาท)</label>
                  <input
                    type="number"
                    step="0.01"
                    id="total_paid_amount"
                    required
                    placeholder="0.00"
                    value={totalPaidAmount}
                    onChange={(e) => setTotalPaidAmount(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="input_status">สถานะระบุโดยแอดมิน</label>
              <input
                type="text"
                id="input_status"
                placeholder="เช่น รอเช็คยอด, โอนแล้ว"
                value={inputStatus}
                onChange={(e) => setInputStatus(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="note">หมายเหตุระบบ</label>
              <textarea
                id="note"
                rows={2}
                placeholder="ระบุรายละเอียดเพิ่มเติม..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              ></textarea>
            </div>

            <button type="submit" className={`btn btn-block ${isSubmitting ? "btn-default" : "btn-success"}`} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> กำลังบันทึกข้อมูล...</> : <><Save size={16} /> บันทึกสัญญารายการ</>}
            </button>

            {formMode === "edit_payment" && (
              <button
                type="button"
                className="btn btn-block"
                style={{ backgroundColor: "#dc2626", color: "#ffffff", marginTop: "8px" }}
                disabled={isPayoffSubmitting}
                onClick={payoffEntireContract}
              >
                {isPayoffSubmitting ? "กำลังปิดยอด..." : "🌟 ปิดยอดผ่อนชำระทั้งหมดก่อนกำหนด"}
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
