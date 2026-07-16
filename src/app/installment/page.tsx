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
  const [showContractDetail, setShowContractDetail] = useState(false);

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
      setLoading(true); // 🌟 1. เปิดสถานะ Loading เพื่อให้ปุ่มหมุน และ Disable ปุ่มไว้กันกดซ้ำ
    
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
    } finally {
      setLoading(false); // 🌟 2. ปิดสถานะ Loading เมื่อทำงานเสร็จสิ้น (ไม่ว่าจะสำเร็จหรือ Error) เพื่อให้ปุ่มหยุดหมุน
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
      <h2 style={{ margin: 0 }}>ระบบผ่อนสินค้า (Installment Transactions)</h2>
      <div className="action-buttons">
        <Link href={getHomeUrl()} className="btn btn-default">
          <ArrowLeft size={24} /> กลับหน้าหลัก
        </Link>
        <button type="button" onClick={() => loadData()} className="btn btn-default" disabled={loading}>
          <RefreshCw size={24} className={loading ? "animate-spin" : ""} /> รีเฟรช
        </button>
        <button type="button" onClick={clearForm} className="btn btn-primary">
          <Plus size={24} /> สร้างรายการผ่อน
        </button>
      </div>
    </div>

    <div className="main-layout">
      
      {/* --- LEFT SIDE: TABLE AND FILTERS --- */}
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
            <span style={{ fontSize: "12px", fontWeight: 500, color: "#4b5563", marginRight: "6px" }}>ปิดยอดแล้ว:</span>
            <div className="filter-group">
              <button className={`filter-btn ${filterClosed === "ALL" ? "active" : ""}`} onClick={() => handleClosedFilterChange("ALL")}>ทั้งหมด</button>
              <button className={`filter-btn ${filterClosed === "NO" ? "active" : ""}`} onClick={() => handleClosedFilterChange("NO")}>เปิดอยู่ (NO)</button>
              <button className={`filter-btn ${filterClosed === "YES" ? "active" : ""}`} onClick={() => handleClosedFilterChange("YES")}>ปิดแล้ว (YES)</button>
            </div>
          </div>

          <div>
            <span style={{ fontSize: "12px", fontWeight: 500, color: "#4b5563", marginRight: "6px" }}>ซ่อนรายการที่ชำระแล้ว:</span>
            <div className="filter-group">
              <button 
                className={`filter-btn ${filterExcludePaid === "YES" ? "active" : ""}`} 
                onClick={() => setFilterExcludePaid("YES")}
                disabled={filterClosed === "YES"}
                style={filterClosed === "YES" ? { opacity: 0.5, cursor: "not-allowed" } : {}}
              >YES</button>
              <button 
                className={`filter-btn ${filterExcludePaid === "NO" ? "active" : ""}`} 
                onClick={() => setFilterExcludePaid("NO")}
                disabled={filterClosed === "YES"}
                style={filterClosed === "YES" ? { opacity: 0.5, cursor: "not-allowed" } : {}}
              >NO</button>
            </div>
          </div>

          <div>
            <span style={{ fontSize: "12px", fontWeight: 500, color: "#4b5563", marginRight: "6px" }}>สถานะจากระบบ:</span>
            <div className="filter-group">
              <button className={`filter-btn ${filterStatus === "ALL" ? "active" : ""}`} onClick={() => handleStatusFilterChange("ALL")}>ทั้งหมด</button>
              <button className={`filter-btn ${filterStatus === "ยังไม่ถึงกำหนด" ? "active" : ""}`} onClick={() => handleStatusFilterChange("ยังไม่ถึงกำหนด")}>ยังไม่ถึงกำหนด</button>
              <button className={`filter-btn ${filterStatus === "ครบกำหนด" ? "active" : ""}`} onClick={() => handleStatusFilterChange("ครบกำหนด")}>ครบกำหนด</button>
              <button className={`filter-btn ${filterStatus === "เกินกำหนด" ? "active" : ""}`} onClick={() => handleStatusFilterChange("เกินกำหนด")}>เกินกำหนด</button>
            </div>
          </div>
        </div>

        {/* --- TABLE CONTENT (ครบ 19 คอลัมน์) --- */}
        <div className="table-wrapper">
          <table className="product-table">
            <thead>
              <tr>
                <th style={{ minWidth: "100px", textAlign: "center"}}>ยกเลิกสัญญา</th>
                <th style={{ minWidth: "120px"}}>Transaction ID</th>
                <th style={{ minWidth: "180px"}}>รหัสสินค้า</th>
                <th style={{ minWidth: "120px"}}>ชื่อลูกค้า</th>
                <th style={{ minWidth: "100px"}}>เบอร์โทร</th>
                <th style={{ minWidth: "80px"}}>ช่องทาง</th>
                <th style={{ minWidth: "110px"}}>สถานะจากระบบ</th>
                <th style={{ minWidth: "100px"}}>ยอดผ่อนต่องวด</th>
                <th style={{ minWidth: "80px"}}>จำนวนงวด</th>
                <th style={{ minWidth: "80px"}}>งวดที่</th>
                <th style={{ minWidth: "100px"}}>วันดีลนัดชำระ</th>
                <th style={{ minWidth: "100px"}}>วันที่ชำระ</th>
                <th style={{ minWidth: "140px"}}>ยอดเงินที่ชำระ</th>
                <th style={{ minWidth: "100px"}}>กำหนดชำระ</th>
                <th style={{ minWidth: "100px"}}>ยอดค้างชำระ</th>
                <th style={{ minWidth: "120px"}}>สถานะจากแอดมิน</th>
                <th style={{ minWidth: "80px"}}>ปิดยอดแล้ว</th>
                <th style={{ minWidth: "150px"}}>หมายเหตุ</th>
                <th style={{ minWidth: "120px"}}>แอดมินที่ทำรายการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={19} style={{ textAlign: "left", color: "#6b7280", padding: "30px" }}>
                    กำลังดึงข้อมูลการผ่อนชำระ...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={19} style={{ textAlign: "left", color: "#9ca3af", padding: "30px" }}>
                    ไม่พบข้อมูลการผ่อนชำระที่ตรงเงื่อนไข
                  </td>
                </tr>
              ) : (
                filteredData.map((x: any, idx: number) => {
                  const insList = x.transaction_installment;
                  const pData = Array.isArray(insList) && insList.length > 0 ? insList[0] : (insList || {});

                  let statusText = "ยังไม่ถึงกำหนด";
                  let badgeClass = "st-normal";
                  let overdueAmount = 0;
                  let durationText = "";

                  let pDateText = pData?.payment_date || "-";
                  let dueDateText = pData?.due_date || "-";
                  let inputStatusText = pData?.input_status || "-";
                  let amtPerPeriod = pData?.installment_amount || 0;
                  let paidAmountText = pData?.total_paid_amount ? Number(pData.total_paid_amount).toLocaleString() : "0";

                  if (x.current_status === "ชำระแล้ว") {
                    statusText = "ชำระแล้ว";
                    badgeClass = "closed-yes";
                    durationText = "เรียบร้อย";
                  } else if (pData && pData.due_date) {
                    const dueDate = new Date(pData.due_date);
                    if (dueDate.getTime() === todayObj.getTime()) {
                      statusText = "ครบกำหนด"; badgeClass = "st-today"; durationText = "วันนี้";
                    } else if (dueDate < todayObj) {
                      statusText = "เกินกำหนด"; badgeClass = "st-overdue";
                      const diffDays = Math.floor((todayObj.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                      durationText = `ค้าง ${diffDays} วัน`;
                      overdueAmount = amtPerPeriod;
                    } else {
                      const diffDays = Math.ceil((dueDate.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
                      durationText = `อีก ${diffDays} วัน`;
                    }
                  }

                  let adminUserText = x.updated_by_name && x.updated_by_name !== "Unknown" 
                    ? x.updated_by_name 
                    : (x.created_by_name || "-");

                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb" }} className={editTxId === pData?.transaction_id ? "row-active" : ""}>
                      <td style={{ textAlign: "center", padding: "8px" }}>
                        <button 
                          className="btn" 
                          style={{ backgroundColor: "#dc2626", color: "white", padding: "6px 10px", fontSize: "11px", borderRadius: "6px" }} 
                          onClick={() => voidEntireContract(x.transaction_id)}
                        >Void</button>
                      </td>
                      <td className="clickable-cell" onClick={() => openPaymentMode(x, pData)} style={{ padding: "8px", fontWeight: "bold" }}>{x.transaction_id}</td>
                      <td className="clickable-cell" onClick={() => openPaymentMode(x, pData)} style={{ padding: "8px" }}>{x.product}</td>
                      <td className="clickable-cell" style={{ padding: "8px" }}>
                        {x.chat_link ? (
                          <a href={x.chat_link} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "underline", fontWeight: 500 }}>{x.customer_name}</a>
                        ) : (
                          <span onClick={() => openPaymentMode(x, pData)}>{x.customer_name}</span>
                        )}
                      </td>
                      <td className="clickable-cell" onClick={() => openPaymentMode(x, pData)} style={{ padding: "8px" }}>{x.phone_number || "-"}</td>
                      <td className="clickable-cell" onClick={() => openPaymentMode(x, pData)} style={{ padding: "8px" }}><small>{x.channel}</small></td>
                      <td className="clickable-cell" onClick={() => openPaymentMode(x, pData)} style={{ padding: "8px" }}><span className={`status-badge ${badgeClass}`}>{statusText}</span></td>
                      <td className="clickable-cell" onClick={() => openPaymentMode(x, pData)} style={{ padding: "8px" }}>{Number(amtPerPeriod).toLocaleString()} บ.</td>
                      <td className="clickable-cell" onClick={() => openPaymentMode(x, pData)} style={{ padding: "8px" }}>{pData?.total_periods || "-"} งวด</td>
                      <td className="clickable-cell" onClick={() => openPaymentMode(x, pData)} style={{ padding: "8px" }}><strong>{pData?.current_period || "-"}</strong></td>
                      <td className="clickable-cell" onClick={() => openPaymentMode(x, pData)} style={{ padding: "8px" }}>ทุกวันที่ {pData?.monthly_due_day || "-"}</td>
                      <td className="clickable-cell" onClick={() => openPaymentMode(x, pData)} style={{ padding: "8px" }}>{pDateText}</td>
                      <td className="clickable-cell" onClick={() => openPaymentMode(x, pData)} style={{ padding: "8px", color: "#2563eb", fontWeight: "bold" }}>{paidAmountText} บ.</td>
                      <td className="clickable-cell" onClick={() => openPaymentMode(x, pData)} style={{ padding: "8px" }}>{dueDateText}</td>
                      <td style={{ padding: "8px" }} onClick={() => openPaymentMode(x, pData)}>
                        <span style={{ color: overdueAmount > 0 ? "#b91c1c" : "#10b981", fontWeight: "bold" }}>{overdueAmount.toLocaleString()} บ.</span>
                        <div style={{ fontSize: "10px", color: "#6b7280", fontStyle: "italic" }}>({durationText})</div>
                      </td>
                      <td className="clickable-cell" onClick={() => openPaymentMode(x, pData)} style={{ padding: "8px" }}>{inputStatusText}</td>
                      <td className="clickable-cell" onClick={() => openPaymentMode(x, pData)} style={{ padding: "8px" }}><span className={`status-badge ${x.closed === "YES" ? "closed-yes" : ""}`}>{x.closed}</span></td>
                      <td className="clickable-cell" onClick={() => openPaymentMode(x, pData)} style={{ padding: "8px" }}><span style={{ color: "#6b7280", fontSize: "12px" }}>{x.note || "-"}</span></td>
                      <td className="clickable-cell" onClick={() => openPaymentMode(x, pData)} style={{ padding: "8px" }}><span style={{ color: "#4b5563", fontWeight: 500 }}>{adminUserText}</span></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- RIGHT SIDE: ACTION FORM CARD --- */}
      <div className="form-card">
        <h3>
          {formMode === "add" ? <PlusCircle size={24} /> : <BadgeDollarSign size={24} />}
          <span>{formMode === "add" ? "สร้างรายการผ่อนใหม่" : "บันทึกชำระค่างวด"}</span>
        </h3>

        <form onSubmit={saveTransaction}>
          
          {/* --- ZONE 1: CONTRACT FIELDS (โหมดสร้างสัญญา) --- */}
          {formMode === "add" && (
            <div id="contract_fields_zone">
              <div className="form-group">
                <label htmlFor="product">รหัสสินค้า</label>
                <input type="text" id="product" required className="form-control" placeholder="กรอกรายละเอียดสินค้า" value={product} onChange={(e) => setProduct(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="customer_name">ชื่อลูกค้า</label>
                <input type="text" id="customer_name" required className="form-control" placeholder="ชื่อ-นามสกุล" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="chat_link">ลิงก์แชทลูกค้า</label>
                <input type="text" id="chat_link" className="form-control" placeholder="วางลิงก์แชท เช่น https://line.me/..." value={chatLink} onChange={(e) => setChatLink(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="phone_number">เบอร์โทรศัพท์</label>
                <input type="text" id="phone_number" className="form-control" placeholder="0xxxxxxxxx" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="channel">ช่องทางติดต่อ</label>
                <select id="channel" className="form-control" value={channel} onChange={(e) => setChannel(e.target.value)}>
                  <option value="LINE">LINE</option>
                  <option value="FB">FB</option>
                  <option value="IG">IG</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="installment_amount">ยอดผ่อนต่องวด (บาท)</label>
                <input type="number" step="0.01" id="installment_amount" required className="form-control" placeholder="0.00" value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="total_periods">จำนวนงวดทั้งหมด</label>
                <input type="number" id="total_periods" required className="form-control" placeholder="ระบุจำนวนงวด เช่น 6" min="1" value={totalPeriods} onChange={(e) => setTotalPeriods(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="label-blue">วันนัดชำระงวดแรก (วัน / เดือน / ปี)</label>
                <div className="due-date-row">
                  <input type="number" id="monthly_due_day" required className="form-control" placeholder="วันที่" min="1" max="31" value={monthlyDueDay} onChange={(e) => setMonthlyDueDay(e.target.value)} style={{ flex: 1 }} />
                  <select id="start_month" required className="form-control" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} style={{ flex: 1.2 }}>
                    <option value="1">ม.ค.</option><option value="2">ก.พ.</option><option value="3">มี.ค.</option>
                    <option value="4">เม.ย.</option><option value="5">พ.ค.</option><option value="6">มิ.ย.</option>
                    <option value="7">ก.ค.</option><option value="8">ส.ค.</option><option value="9">ก.ย.</option>
                    <option value="10">ต.ค.</option><option value="11">พ.ย.</option><option value="12">ธ.ค.</option>
                  </select>
                  <select id="start_year" required className="form-control" value={startYear} onChange={(e) => setStartYear(e.target.value)} style={{ flex: 1.5 }}>
                    {yearOptions.map(y => (
                      <option key={y} value={y}>ค.ศ. {y} (พ.ศ. {y + 543})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="preview-box">
                <div className="preview-title">
                  <CalendarRange size={14} /> ตารางประมาณการวันครบกำหนด
                </div>
                <div id="due_preview_list" className="due-preview-container">
                  {renderDuePreviews()}
                </div>
              </div>
            </div>
          )}

          {/* --- ZONE 2: PAYMENT FIELDS (โหมดบันทึกรับชำระค่างวด) --- */}
          {formMode === "edit_payment" && (
            <div id="payment_fields_zone">
              
              {/* 🌟 1. ย้าย Alert ขึ้นมาไว้บนสุด + ป้องกันค่า undefined */}
              {Array.isArray(overdueNoticeList) && overdueNoticeList.length > 0 && (
                <div className="alert-danger-box">
                  <span>
                    ⚠️ แจ้งเตือน: มีรายการผ่อนที่ยังไม่ได้ชำระ กรุณาบันทึกการรับชำระที่รายการผ่อนก่อนหน้า<br/>
                    • งวดที่ยังไม่ได้ชำระ: <span className="underline">{overdueNoticeList.join(", ")}</span><br/>
                    • รวมยอดที่ยังไม่ได้ชำระ: <span className="price">{(overdueSumAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
                  </span>
                </div>
              )}

              {/* 🌟 2. แสดงข้อมูลหลักในการรับชำระเงินงวดปัจจุบัน */}
              <div className="payment-summary">
                <div><strong>Transaction ID:</strong> <span className="bold">{editTxId || "-"}</span></div>
                <div><strong>ชื่อลูกค้า:</strong> <span>{customerName || "-"}</span></div>
                <div><strong>ชำระงวดที่:</strong> <span className="highlight-blue">{lblPeriod || "-"}</span></div>
                <div><strong>ยอดผ่อนชำระงวดนี้:</strong> <span className="bold">{(lblAmount || 0).toLocaleString()}</span> บาท</div>
              </div>

              {/* 🌟 3. ทำปุ่มกดหุบ/แสดง ข้อมูลรายละเอียดสัญญาเดิม (Default: ซ่อนไว้) */}
              <div style={{ marginBottom: "12px" }}>
                <button 
                  type="button" 
                  className="btn btn-default" 
                  style={{ width: "100%", justifyContent: "space-between", padding: "6px 12px", fontSize: "12px" }}
                  onClick={() => setShowContractDetail(!showContractDetail)}
                >
                  <span>{showContractDetail ? "👇 ซ่อนข้อมูลสัญญาเดิม" : "👉 ดูข้อมูลสัญญาเดิม"}</span>
                </button>
                
                {showContractDetail && (
                  <div style={{ marginTop: "10px", padding: "10px", background: "#f3f4f6", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: "11px" }}>รหัสสินค้า</label>
                      <input type="text" className="form-control" readOnly value={product || "-"} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: "11px" }}>ลิงก์แชทลูกค้า</label>
                      <input type="text" className="form-control" readOnly value={chatLink || "-"} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: "11px" }}>เบอร์โทรศัพท์</label>
                      <input type="text" className="form-control" readOnly value={phoneNumber || "-"} />
                    </div>
                  </div>
                )}
              </div>

              {/* 🌟 4. ช่องกรอกสำหรับการชำระเงินจริง */}
              <div className="form-group">
                <label htmlFor="payment_date">วันที่ชำระเงิน</label>
                <input type="date" id="payment_date" className="form-control" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="total_paid_amount">ยอดเงินที่ชำระ (บาท)</label>
                <input type="number" step="0.01" id="total_paid_amount" className="form-control" placeholder="0.00" value={totalPaidAmount} onChange={(e) => setTotalPaidAmount(e.target.value)} />
              </div>
            </div>
          )}

          {/* ช่องแก้ไขสถานะและหมายเหตุที่แสดงผลทุกโหมด */}
          <div className="form-group">
            <label htmlFor="input_status">สถานะจากแอดมิน</label>
            <input type="text" id="input_status" className="form-control" placeholder="ระบุสถานะ..." value={inputStatus} onChange={(e) => setInputStatus(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="note">หมายเหตุ</label>
            <textarea id="note" rows={2} className="form-control" placeholder="ระบุหมายเหตุ..." value={note} onChange={(e) => setNote(e.target.value)}></textarea>
          </div>

          <button 
            type="submit" 
            className={`btn btn-block btn-submit ${isSubmitting ? "btn-secondary" : "btn-success"}`} 
            disabled={isSubmitting || isPayoffSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> กำลังบันทึกข้อมูล...
              </>
            ) : (
              <>
                <Save size={16} /> บันทึกข้อมูลการผ่อนชำระ
              </>
            )}
          </button>

          {formMode === "edit_payment" && (
            <button 
              type="button" 
              className="btn btn-block btn-danger"
              onClick={payoffEntireContract}
              disabled={isSubmitting || isPayoffSubmitting}
            >
              {isPayoffSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> กำลังดำเนินการปิดยอดผ่อนชำระ...
                </>
              ) : (
                <>
                  <ShieldCheck size={16} /> ปิดยอดสัญญาก่อนกำหนด (ปิดทุกงวด)
                </>
              )}
            </button>
          )}
        </form>
      </div>
    </div>
  </div>
);
}
