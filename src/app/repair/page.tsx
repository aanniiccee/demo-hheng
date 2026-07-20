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

// 🌟 โครงสร้างข้อมูลรายละเอียดงานซ่อม (Repair Detail)
interface RepairDetail {
  received_date?: string;       // วันที่รับสินค้า
  repaired_date?: string;       // วันที่ซ่อมเสร็จ
  delivery_date?: string;       // วันจัดส่ง/วันนัดรับของ
  input_status?: string;        // สถานะจากแอดมิน
}

interface RepairTransaction {
  transaction_id: string;
  product: string; 
  customer_name: string;
  phone_number?: string;
  channel: string;
  current_status: string;       // สถานะจากระบบ
  closed: string;               // ปิดเคสแล้ว (YES/NO)
  note?: string;
  chat_link?: string;
  updated_by_name?: string;
  created_by_name?: string;
  transaction_repair?: RepairDetail[] | RepairDetail; 
}

export default function RepairPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token") || "";
  const txIdFromUrl = searchParams.get("tx_id")?.trim() || "";

  // --- States ข้อมูลรวม ---
  const [allTransactions, setAllTransactions] = useState<RepairTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- States Filters ---
  const [searchTerm, setSearchTerm] = useState("");
  const [closedFilter, setClosedFilter] = useState("NO"); 
  const [statusFilter, setStatusFilter] = useState("ALL"); 

  // --- States ควบคุมโหมดฟอร์ม ---
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editTxId, setEditTxId] = useState("");

  // --- States สำหรับผูก Input ฟอร์ม ---
  const [product, setProduct] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [chatLink, setChatLink] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [channel, setChannel] = useState("LINE");
  
  // ฟิลด์ข้อมูลวันที่ของงานซ่อม
  const [receivedDate, setReceivedDate] = useState("");
  const [repairedDate, setRepairedDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");

  const [closed, setClosed] = useState("NO");
  const [inputStatus, setInputStatus] = useState("");
  const [note, setNote] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (closedFilter === "YES") {
      setStatusFilter("ALL");
    }
  }, [closedFilter]);

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
      const apiUrl = `/api/repair-transactions?token=${token}&admin_line_id=${adminLineId}`;
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

  // คำนวณสถานะจากระบบตามวันนัดรับของ หรือสถานะปิดเคส
  const calculateSystemStatus = (tx: RepairTransaction) => {
  const repairList = tx.transaction_repair;
  const rData: RepairDetail | undefined = Array.isArray(repairList) 
    ? repairList[0] 
    : (repairList || undefined);

  let statusText = "รอดำเนินการ"; // ค่าเริ่มต้นสำหรับเคสที่เพิ่งรับเข้ามา (มีแค่ received_date)
  let badgeClass = "st-normal";

  if (tx.closed === "YES") {
    // 1. ถ้าปิดเคสแล้ว ไม่ว่ากรณีใดๆ ถือว่าจบงาน
    statusText = "ปิดเคสแล้ว";
    badgeClass = "closed-yes";
  } else if (rData && rData.delivery_date) {
    // 2. ถ้ายังไม่ปิดเคส แต่ใส่ delivery_date แปลว่าส่งของไปแล้ว แต่อยู่ระหว่างเดินทาง/รอแอดมินตามผล
    statusText = "จัดส่งแล้ว";
    badgeClass = "st-overdue"; // ใช้ class ที่เด่นเพื่อให้รู้ว่าต้องตามต่อ
  } else if (rData && rData.repaired_date) {
    // 3. ถ้ายังไม่ส่ง แต่ซ่อมเสร็จแล้ว
    statusText = "ซ่อมเสร็จแล้ว";
    badgeClass = "st-today";
  }

  return { statusText, badgeClass };
  };

  const clearForm = () => {
    setFormMode("add");
    setEditTxId("");
    
    setProduct("");
    setCustomerName("");
    setChatLink("");
    setPhoneNumber("");
    setChannel("LINE");
    
    setReceivedDate(todayStr);
    setRepairedDate("");
    setDeliveryDate("");
    
    setClosed("NO");
    setInputStatus("");
    setNote("");
  };

  const triggerEditMode = (tx: RepairTransaction) => {
    const repairList = tx.transaction_repair;
    const rData: RepairDetail = Array.isArray(repairList) 
      ? repairList[0] 
      : (repairList || {});

    setFormMode("edit");
    setEditTxId(tx.transaction_id);

    setProduct(tx.product || "");
    setCustomerName(tx.customer_name || "");
    setChatLink(tx.chat_link || "");
    setPhoneNumber(tx.phone_number || "");
    setChannel(tx.channel || "LINE");
    
    setReceivedDate(rData.received_date || "");
    setRepairedDate(rData.repaired_date || "");
    setDeliveryDate(rData.delivery_date || "");
    
    setClosed(tx.closed || "NO");
    setInputStatus(rData.input_status || "");
    setNote(tx.note || "");
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
      received_date: receivedDate || null,
      repaired_date: repairedDate || null,
      delivery_date: deliveryDate || null
    };

    let url = "/api/repair-transactions";
    let method = "POST";

    if (formMode === "edit") {
      url = `/api/repair-transactions/${encodeURIComponent(editTxId)}`;
      method = "PUT";
    }

    try {
      const response = await fetch(`${url}?token=${token}&admin_line_id=${adminLineId}`, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert("บันทึกข้อมูลงานซ่อมสำเร็จ!");
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

  // --- ระบบกรองข้อมูล (Filter Data Client-side) ---
  const filteredTransactions = allTransactions.filter(x => {
    if (closedFilter !== "ALL" && x.closed !== closedFilter) return false;

    const { statusText } = calculateSystemStatus(x);
    if (statusFilter !== "ALL" && statusFilter !== statusText) return false;

    const q = searchTerm.toLowerCase().trim();
    const name = (x.customer_name || "").toLowerCase();
    const txId = (x.transaction_id || "").toLowerCase();
    const pDetail = (x.product || "").toLowerCase();

    return q === "" || name.includes(q) || txId.includes(q) || pDetail.includes(q);
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
        <h2>ระบบงานซ่อม (Repair Transactions)</h2>
        <div className="action-buttons">
          <Link href={getHomeUrl()} className="btn btn-default">
            <ArrowLeft size={24} /> กลับหน้าหลัก
          </Link>
          <button type="button" onClick={loadData} className="btn btn-default" disabled={loading}>
            <RefreshCw size={24} className={loading ? "animate-spin" : ""} /> รีเฟรช
          </button>
          <button type="button" onClick={clearForm} className="btn btn-primary">
            <Plus size={24} /> สร้างรายการซ่อม
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
                placeholder="ชื่อลูกค้า สินค้า หรือ Transaction ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <span className="filter-label">ปิดเคสแล้ว:</span>
              <div className="filter-group">
                <button type="button" className={`filter-btn ${closedFilter === "ALL" ? "active" : ""}`} onClick={() => setClosedFilter("ALL")}>ทั้งหมด</button>
                <button type="button" className={`filter-btn ${closedFilter === "NO" ? "active" : ""}`} onClick={() => setClosedFilter("NO")}>เปิดอยู่ (NO)</button>
                <button type="button" className={`filter-btn ${closedFilter === "YES" ? "active" : ""}`} onClick={() => setClosedFilter("YES")}>ปิดแล้ว (YES)</button>
              </div>
            </div>

            <div>
              <span className="filter-label">สถานะจากระบบ:</span>
              <div className="filter-group">
                <button type="button" className={`filter-btn ${statusFilter === "ALL" ? "active" : ""}`} onClick={() => setStatusFilter("ALL")}>ทั้งหมด</button>
                <button type="button" className={`filter-btn ${statusFilter === "รอดำเนินการ" ? "active" : ""}`} onClick={() => setStatusFilter("รอดำเนินการ")}>รอดำเนินการ</button>
                <button type="button" className={`filter-btn ${statusFilter === "ซ่อมเสร็จแล้ว" ? "active" : ""}`} onClick={() => setStatusFilter("ซ่อมเสร็จแล้ว")}>ซ่อมเสร็จแล้ว</button>
                <button type="button" className={`filter-btn ${statusFilter === "จัดส่งแล้ว" ? "active" : ""}`} onClick={() => setStatusFilter("จัดส่งแล้ว")}>จัดส่งแล้ว</button>
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
                  <th className="col-date">วันที่รับสินค้า</th>
                  <th className="col-date">วันที่ซ่อมเสร็จ</th>
                  <th className="col-date">วันจัดส่ง/นัดรับ</th>
                  <th className="col-admin-status">สถานะจากแอดมิน</th>
                  <th className="col-closed">ปิดเคสแล้ว</th>
                  <th className="col-note">หมายเหตุ</th>
                  <th className="col-admin-name">แอดมินที่ทำรายการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={13} className="table-empty-row">กำลังดึงข้อมูลงานซ่อม...</td></tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr><td colSpan={13} className="table-empty-row no-match">ไม่พบข้อมูลงานซ่อมที่ตรงเงื่อนไข</td></tr>
                ) : (
                  filteredTransactions.map((x) => {
                    const repairList = x.transaction_repair;
                    const rData = Array.isArray(repairList) ? repairList[0] : repairList;
                    const { statusText, badgeClass } = calculateSystemStatus(x);

                    const adminUserText = x.updated_by_name && x.updated_by_name !== "Unknown" 
                      ? x.updated_by_name 
                      : (x.created_by_name || "-");

                    const renderDayCount = (targetDateStr: string | undefined, type: "received" | "repaired" | "delivery") => {
                    if (!targetDateStr || x.closed === "YES") return null;
                      
                    const targetDate = new Date(targetDateStr);
                    const todayObj = new Date(todayStr);
                      targetDate.setHours(0, 0, 0, 0);
                      todayObj.setHours(0, 0, 0, 0);

                    const diffTime = todayObj.getTime() - targetDate.getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                    if (type === "received") {
                      // นับจากวันรับเข้า: แสดงจำนวนวันที่ผ่านไปแล้วจนถึงปัจจุบัน
                    return <div className="table-txt-small-italic text-amber-600">รับเข้าแล้ว {diffDays} วัน</div>;
                    }

                    if (type === "repaired") {
                      // นับจากวันซ่อมเสร็จ: แสดงจำนวนวันที่ซ่อมเสร็จค้างไว้
                    return <div className="table-txt-small-italic text-blue-600">ซ่อมเสร็จแล้ว {diffDays} วัน</div>;
                    }

                    if (type === "delivery") {
                      // นับจากวันที่จัดส่งจริง: ดูว่าส่งไปแล้วกี่วัน
                      return <div className={`table-txt-small-italic ${diffDays >= 3 ? "text-rose-600 font-semibold" : "text-amber-600"}`}>จัดส่งแล้ว {diffDays} วัน</div>;
                    }
                };

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
                        <td>
                          <div>{rData?.received_date || "-"}</div>
                          {renderDayCount(rData?.received_date, "received")}
                        </td>
                        <td>
                          <div>{rData?.repaired_date || "-"}</div>
                          {renderDayCount(rData?.repaired_date, "repaired")}
                        </td>
                        <td>
                          <div>{rData?.delivery_date || "-"}</div>
                          {renderDayCount(rData?.delivery_date, "delivery")}
                        </td>
                        <td>{rData?.input_status || "-"}</td>
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

        {/* ฝั่งขวา: ฟอร์มจัดการงานซ่อม */}
        <div className="form-card">
          <h3>
            {formMode === "add" ? <PlusCircle size={24} /> : <SquarePen size={24} />}
            <span className="form-title-text">{formMode === "add" ? "สร้างรายการซ่อม" : "จัดการรายการซ่อม"}</span>
          </h3>
          
          <form onSubmit={handleFormSubmit}>
            <div className="form-sub-header">
              <span className="form-sub-title">รายละเอียดการซ่อม</span>
            </div>

            <div className="form-group">
              <label htmlFor="product">รหัสสินค้า</label>
              <input
                type="text"
                id="product"
                required
                placeholder="กรอกรายละเอียดสินค้า"
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
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="chat_link">ลิงก์แชทลูกค้า</label>
              <input
                type="url"
                id="chat_link"
                placeholder="วางลิงก์แชท เช่น https://line.me/..."
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
              <span className="form-sub-title text-blue">บันทึกสถานะการซ่อม</span>
            </div>

            <div className="form-group">
              <label>วันที่รับสินค้า</label>
              <input
                type="date"
                required
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>วันที่ซ่อมเสร็จ</label>
              <input
                type="date"
                value={repairedDate}
                onChange={(e) => setRepairedDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>วันจัดส่ง / วันนัดรับของ</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="closed">ปิดเคสแล้วหรือไม่?</label>
              <select
                id="closed"
                value={closed}
                onChange={(e) => setClosed(e.target.value)}
              >
                <option value="NO">NO (กำลังดำเนินการ)</option>
                <option value="YES">YES (ปิดเคส/ส่งมอบสำเร็จ)</option>
              </select>
            </div>

            <hr className="divider-dashed" />

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
                <><Save size={16} /> บันทึกข้อมูลงานซ่อม</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
