"use client";
export const dynamic = "force-dynamic";
import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, RefreshCw, Plus, Search, PlusCircle, Save, Loader2, SquarePen } from "lucide-react";

const S = () => {
  const p = useSearchParams(), t = p.get("token")||"", u = p.get("tx_id")?.trim()||"";
  const [d, setD] = useState<any[]>([]), [l, setL] = useState(false), [sb, setSb] = useState(false);
  const [q, setQ] = useState(""), [cf, setCf] = useState("NO"), [xp, setXp] = useState("YES"), [sf, setSf] = useState("ALL");
  const [m, setM] = useState<"add"|"edit">("add"), [id, setId] = useState(""), [ul, setUl] = useState(false);
  const [f, setF] = useState<any>({ p:"", c:"", l:"", ph:"", ch:"LINE", da:"", dd:"", rb:"", du:"", pd:"", tp:"", cl:"NO", st:"", n:"" });
  const td = new Date().toISOString().split("T")[0];

  useEffect(() => {
    (!sessionStorage.getItem("admin_name") || !sessionStorage.getItem("admin_line_id")) 
      ? (window.location.href = "https://hheng-system.vercel.app/liff-router?" + new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(window.location.search)), goto: window.location.pathname }).toString())
      : g();
  }, [t]);

  useEffect(() => {
    if (u && d.length) {
      const x = d.find((i: any) => i.transaction_id === u);
      x && e(x);
    }
  }, [u, d.length]);

  const g = async () => {
    setL(true);
    try {
      const r = await fetch(`/api/deposit-transactions?token=${t}&admin_line_id=${sessionStorage.getItem("admin_line_id")||""}`);
      r.ok && setD(await r.json());
    } catch {} finally { setL(false); }
  };

  const calc = (x: any) => {
    const o = Array.isArray(x.transaction_deposit) ? x.transaction_deposit[0] : x.transaction_deposit;
    if (x.closed === "YES") return { t: "ปิดออเดอร์แล้ว", c: "closed-yes", d: "รับสินค้า/เสร็จสิ้น" };
    if (!o?.due_date) return { t: "ยังไม่ถึงกำหนด", c: "st-normal", d: "" };
    const t1 = new Date(o.due_date).setHours(0,0,0,0), t2 = new Date().setHours(0,0,0,0);
    return t1 === t2 ? { t: "ครบกำหนด", c: "st-today", d: "ครบกำหนดวันนี้" }
      : t1 < t2 ? { t: "เกินกำหนด", c: "st-overdue", d: `ค้าง ${Math.floor((t2 - t1) / 86400000)} วัน` }
      : { t: "ยังไม่ถึงกำหนด", c: "st-normal", d: `อีก ${Math.ceil((t1 - t2) / 86400000)} วัน` };
  };

  const clr = () => { setM("add"); setId(""); setUl(false); setF({ p:"", c:"", l:"", ph:"", ch:"LINE", da:"", dd:td, rb:"", du:"", pd:"", tp:"", cl:"NO", st:"", n:"" }); };

  const e = (x: any) => {
    const o = (Array.isArray(x.transaction_deposit) ? x.transaction_deposit[0] : x.transaction_deposit) || {};
    setM("edit"); setId(x.transaction_id); setUl(false);
    setF({ p: x.product||"", c: x.customer_name||"", l: x.chat_link||"", ph: x.phone_number||"", ch: x.channel||"LINE", da: String(o.deposit_amount||0), dd: o.deposit_date||"", rb: String(o.remaining_balance||0), du: o.due_date||"", pd: o.payment_date||"", tp: o.total_paid_amount ?? "", cl: x.closed||"NO", st: o.input_status||"", n: x.note||"" });
  };

  const sub = async (ev: any) => {
    ev.preventDefault(); setSb(true);
    const al = sessionStorage.getItem("admin_line_id")||"Unknown", an = sessionStorage.getItem("admin_name")||"Unknown";
    const py: any = { product: f.p, customer_name: f.c, phone_number: f.ph, channel: f.ch, closed: f.cl, input_status: f.st, note: f.n, created_by_line_id: al, created_by_name: an, chat_link: f.l, is_edit_deposit_master: ul };
    const da = parseFloat(f.da)||0, rb = parseFloat(f.rb)||0, tp = parseFloat(f.tp)||0;

    (m === "add" || ul) 
      ? Object.assign(py, { deposit_amount: da, deposit_date: f.dd||null, remaining_balance: rb, due_date: f.du||null, payment_date: null, total_paid_amount: 0 })
      : Object.assign(py, { deposit_amount: da, deposit_date: f.dd||null, remaining_balance: rb, due_date: f.du||null, payment_date: f.pd||null, total_paid_amount: tp });

    try {
      const res = await fetch(`${m === "edit" ? `/api/deposit-transactions/${encodeURIComponent(id)}` : "/api/deposit-transactions"}?token=${t}&admin_line_id=${al}`, {
        method: m === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(py)
      });
      if (res.ok) { alert("บันทึกข้อมูลมัดจำสำเร็จ!"); clr(); await g(); } 
      else { alert("เกิดข้อผิดพลาด: " + ((await res.json()).detail || "ไม่สามารถบันทึกได้")); }
    } catch { alert("เกิดข้อผิดพลาดในการเชื่อมต่อเน็ตเวิร์ก"); } finally { setSb(false); }
  };

  const fd = d.filter((x: any) => {
    if (cf !== "ALL" && x.closed !== cf) return false;
    const { t: st } = calc(x);
    if (sf !== "ALL" && sf !== st) return false;
    if (xp === "YES" && st === "ชำระแล้ว") return false;
    const kw = q.toLowerCase().trim();
    return !kw || [x.customer_name, x.transaction_id, x.product].some(v => (v||"").toLowerCase().includes(kw));
  });

  return (
    <div>
      <div className="header-container">
        <h2>ระบบมัดจำ (Deposit Transactions)</h2>
        <div className="action-buttons">
          <Link href={`/?${new URLSearchParams({ ...(t && { token: t }), ...(sessionStorage.getItem("admin_line_id") && { admin_line_id: sessionStorage.getItem("admin_line_id")! }) }).toString()}`} className="btn btn-default"><ArrowLeft size={24} /> กลับหน้าหลัก</Link>
          <button type="button" onClick={g} className="btn btn-default" disabled={l}><RefreshCw size={24} className={l ? "animate-spin" : ""} /> รีเฟรช</button>
          <button type="button" onClick={clr} className="btn btn-primary"><Plus size={24} /> สร้างรายการมัดจำ</button>
        </div>
      </div>
      <div className="main-layout">
        <div className="table-container">
          <div className="table-header-bar">
            <div className="search-wrapper"><Search className="search-icon" size={16} /><input type="text" className="search-input" placeholder="ค้นหา..." value={q} onChange={e => setQ(e.target.value)} /></div>
            <div>
              <span className="filter-label">ปิดยอดแล้ว:</span>
              <div className="filter-group">
                {["ALL", "NO", "YES"].map(v => <button key={v} type="button" className={`filter-btn ${cf === v ? "active" : ""}`} onClick={() => { setCf(v); v === "YES" && (setXp("NO"), setSf("ALL")); }}>{v === "ALL" ? "ทั้งหมด" : v === "NO" ? "เปิดอยู่ (NO)" : "ปิดแล้ว (YES)"}</button>)}
              </div>
            </div>
            <div>
              <span className="filter-label">ซ่อนรายการที่ชำระแล้ว:</span>
              <div className="filter-group">
                {["YES", "NO"].map(v => <button key={v} type="button" className={`filter-btn ${xp === v ? "active" : ""}`} onClick={() => setXp(v)}>{v}</button>)}
              </div>
            </div>
            <div>
              <span className="filter-label">สถานะจากระบบ:</span>
              <div className="filter-group">
                {["ALL", "ยังไม่ถึงกำหนด", "ครบกำหนด", "เกินกำหนด"].map(v => <button key={v} type="button" className={`filter-btn ${sf === v ? "active" : ""}`} onClick={() => { setSf(v); (v !== "ALL" && v !== "ชำระแล้ว" && cf === "YES") && setCf("NO"); }}>{v === "ALL" ? "ทั้งหมด" : v}</button>)}
              </div>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="product-table">
              <thead>
                <tr>{["Transaction ID", "รหัสสินค้า", "ชื่อลูกค้า", "เบอร์โทร", "ช่องทาง", "สถานะจากระบบ", "ยอดเงินมัดจำที่ชำระ", "วันที่ชำระเงินมัดจำ", "ยอดคงเหลือ", "กำหนดชำระ", "ยอดเงินที่ชำระ", "วันที่ชำระ", "สถานะจากแอดมิน", "ปิดยอดแล้ว", "หมายเหตุ", "แอดมินที่ทำรายการ"].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {l ? <tr><td colSpan={16} className="table-empty-row">กำลังดึงข้อมูล...</td></tr> : !fd.length ? <tr><td colSpan={16} className="table-empty-row no-match">ไม่พบข้อมูล</td></tr> : fd.map((x: any) => {
                  const o = (Array.isArray(x.transaction_deposit) ? x.transaction_deposit[0] : x.transaction_deposit) || {};
                  const { t: st, c: cls, d: dur } = calc(x);
                  return (
                    <tr key={x.transaction_id} onClick={() => e(x)}>
                      <td><strong>{x.transaction_id}</strong></td>
                      <td><small>{x.product || "-"}</small></td>
                      <td>{x.chat_link ? <a href={x.chat_link} target="_blank" rel="noreferrer" onClick={ev => ev.stopPropagation()} className="table-link-customer">{x.customer_name}</a> : x.customer_name}</td>
                      <td>{x.phone_number || "-"}</td>
                      <td><small>{x.channel}</small></td>
                      <td><span className={`status-badge ${cls}`}>{st}</span></td>
                      <td>{o.deposit_amount ? Number(o.deposit_amount).toLocaleString() : "0"} บ.</td>
                      <td>{o.deposit_date || "-"}</td>
                      <td>
                        <div className={x.closed === "YES" ? "table-overdue-closed" : Number(o.remaining_balance) > 0 ? "table-overdue-red" : "table-overdue-green"}>{o.remaining_balance ? Number(o.remaining_balance).toLocaleString() : "0"} บ.</div>
                        <div className="table-txt-small-italic">({dur})</div>
                      </td>
                      <td>{o.due_date || "-"}</td>
                      <td>{o.total_paid_amount ?? "-"}</td>
                      <td>{o.payment_date || "-"}</td>
                      <td>{o.input_status || "-"}</td>
                      <td><span className={`status-badge ${x.closed === "YES" ? "closed-yes" : ""}`}>{x.closed}</span></td>
                      <td><span className="table-txt-muted">{x.note || "-"}</span></td>
                      <td><span className="table-txt-admin">{x.updated_by_name && x.updated_by_name !== "Unknown" ? x.updated_by_name : (x.created_by_name || "-")}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="form-card">
          <h3>{m === "add" ? <PlusCircle size={24} /> : <SquarePen size={24} />}<span className="form-title-text">{m === "add" ? "สร้างรายการมัดจำ" : "จัดการรายการมัดจำ"}</span></h3>
          <form onSubmit={sub}>
            <div className="form-sub-header">
              <span className="form-sub-title">รายละเอียดการมัดจำ</span>
              {m === "edit" && <label className="form-edit-checkbox-label"><input type="checkbox" checked={ul} onChange={e => setUl(e.target.checked)} />แก้ไขข้อมูล</label>}
            </div>
            {[
              { id: "p", l: "รหัสสินค้า", t: "text", req: true },
              { id: "c", l: "ชื่อลูกค้า", t: "text", req: true },
              { id: "l", l: "ลิงก์แชทลูกค้า", t: "url" },
              { id: "ph", l: "เบอร์โทรศัพท์", t: "text" }
            ].map(i => (
              <div className="form-group" key={i.id}>
                <label>{i.l}</label>
                <input type={i.t} required={i.req} disabled={m === "edit" && !ul} value={f[i.id]} onChange={e => setF({ ...f, [i.id]: e.target.value })} />
              </div>
            ))}
            <div className="form-group">
              <label>ช่องทางติดต่อ</label>
              <select disabled={m === "edit" && !ul} value={f.ch} onChange={e => setF({ ...f, ch: e.target.value })}>
                {["LINE", "FB", "IG", "OTHER"].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <hr className="divider-dashed" />
            {[
              { id: "da", l: "ยอดเงินมัดจำที่ชำระ", t: "number", req: true },
              { id: "dd", l: "วันที่ชำระเงินมัดจำ", t: "date", req: true },
              { id: "rb", l: "ยอดชำระครั้งถัดไป", t: "number", req: true },
              { id: "du", l: "วันครบกำหนดชำระครั้งถัดไป", t: "date", req: true }
            ].map(i => (
              <div className="form-group" key={i.id}>
                <label>{i.l}</label>
                <input type={i.t} step="0.01" required={i.req} disabled={m === "edit" && !ul} value={f[i.id]} onChange={e => setF({ ...f, [i.id]: e.target.value })} />
              </div>
            ))}
            {m === "edit" && (
              <div className={`inner-payment-card ${ul ? "disabled-zone" : "active-zone"}`}>
                {ul && <div className="alert-warning-box"><span>⚠️ หมายเหตุ: ไม่สามารถอัปเดตชำระเงินพร้อมกันได้</span></div>}
                <div className="form-group"><label>วันที่ชำระ</label><input type="date" disabled={ul} value={f.pd} onChange={e => setF({ ...f, pd: e.target.value })} /></div>
                <div className="form-group"><label>ยอดเงินที่ชำระ (บาท)</label><input type="number" step="0.01" disabled={ul} value={f.tp} onChange={e => setF({ ...f, tp: e.target.value })} /></div>
                <div className="form-group">
                  <label>ปิดยอดรายการมัดจำนี้เลยหรือไม่?</label>
                  <select disabled={ul} value={f.cl} onChange={e => setF({ ...f, cl: e.target.value })}>
                    <option value="NO">NO (ยังค้างชำระอยู่)</option>
                    <option value="YES">YES (ชำระครบ)</option>
                  </select>
                </div>
              </div>
            )}
            <hr className="divider-dashed" />
            <div className="form-group"><label>สถานะจากแอดมิน</label><input type="text" value={f.st} onChange={e => setF({ ...f, st: e.target.value })} /></div>
            <div className="form-group"><label>หมายเหตุ</label><textarea rows={2} value={f.n} onChange={e => setF({ ...f, n: e.target.value })}></textarea></div>
            <button type="submit" className={`btn btn-block ${sb ? "btn-default" : "btn-success"}`} disabled={sb}>
              {sb ? <><Loader2 size={16} className="animate-spin" /> กำลังบันทึก...</> : <><Save size={16} /> บันทึกข้อมูลมัดจำ</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default function DepositPage() {
  return <Suspense fallback={<div>Loading...</div>}><S /></Suspense>;
}


// "use client";

// export const dynamic = "force-dynamic";
// import React, { useState, useEffect } from "react";
// import Link from "next/link";
// import { useSearchParams, useRouter } from "next/navigation";
// import { 
//   ArrowLeft, 
//   RefreshCw, 
//   Plus, 
//   Search, 
//   PlusCircle, 
//   Save,
//   Loader2,
//   SquarePen
// } from "lucide-react";

// interface DepositDetail {
//   deposit_amount: number;
//   deposit_date?: string;
//   remaining_balance: number;
//   due_date?: string;
//   payment_date?: string;
//   total_paid_amount?: number;
//   input_status?: string;
// }

// interface Transaction {
//   transaction_id: string;
//   product: string; 
//   customer_name: string;
//   phone_number?: string;
//   channel: string;
//   current_status: string;
//   closed: string;
//   note?: string;
//   chat_link?: string;
//   updated_by_name?: string;
//   created_by_name?: string;
//   transaction_deposit?: DepositDetail[] | DepositDetail; 
// }

// export default function DepositPage() {
//   const searchParams = useSearchParams();
//   const router = useRouter();
//   const token = searchParams.get("token") || "";
//   const txIdFromUrl = searchParams.get("tx_id")?.trim() || "";
//   const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [searchTerm, setSearchTerm] = useState("");
//   const [closedFilter, setClosedFilter] = useState("NO"); 
//   const [excludePaidFilter, setExcludePaidFilter] = useState("YES"); 
//   const [statusFilter, setStatusFilter] = useState("ALL"); 
//   const [formMode, setFormMode] = useState<"add" | "edit">("add");
//   const [editTxId, setEditTxId] = useState("");
//   const [isDepositUnlocked, setIsDepositUnlocked] = useState(false); 
//   const [product, setProduct] = useState("");
//   const [customerName, setCustomerName] = useState("");
//   const [chatLink, setChatLink] = useState("");
//   const [phoneNumber, setPhoneNumber] = useState("");
//   const [channel, setChannel] = useState("LINE");
//   const [depositAmount, setDepositAmount] = useState("");
//   const [depositDate, setDepositDate] = useState("");
//   const [remainingBalance, setRemainingBalance] = useState("");
//   const [dueDate, setDueDate] = useState("");
//   const [paymentDate, setPaymentDate] = useState("");
//   const [totalPaidAmount, setTotalPaidAmount] = useState("");
//   const [closed, setClosed] = useState("NO");
//   const [inputStatus, setInputStatus] = useState("");
//   const [note, setNote] = useState("");
//   const todayStr = new Date().toISOString().split("T")[0];

//   useEffect(() => {
//     const adminName = sessionStorage.getItem("admin_name");
//     const adminLineId = sessionStorage.getItem("admin_line_id");

//     if (!adminName || !adminLineId) {
//       const currentParams = new URLSearchParams(window.location.search);
//       currentParams.set("goto", window.location.pathname);
//       window.location.href = "https://hheng-system.vercel.app/liff-router?" + currentParams.toString();
//       return;
//     }

//     loadData();
//   }, [token]);

//   useEffect(() => {
//     if (txIdFromUrl && allTransactions.length > 0) {
//       const found = allTransactions.find(x => x.transaction_id === txIdFromUrl);
//       if (found) {
//         triggerEditMode(found);
//       }
//     }
//   }, [txIdFromUrl, allTransactions]);

//   const loadData = async () => {
//     try {
//       setLoading(true);
//       const adminLineId = sessionStorage.getItem("admin_line_id") || "";
//       const apiUrl = `/api/deposit-transactions?token=${token}&admin_line_id=${adminLineId}`;
//       const r = await fetch(apiUrl);
//       if (r.ok) {
//         const data = await r.json();
//         setAllTransactions(data);
//       }
//     } catch (err) {
//       console.error("Error loading data:", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const calculateOverdueAndDuration = (tx: Transaction) => {
//     const depositList = tx.transaction_deposit;
//     const dData: DepositDetail | undefined = Array.isArray(depositList) 
//       ? depositList[0] 
//       : (depositList || undefined);

//     let statusText = "ยังไม่ถึงกำหนด";
//     let badgeClass = "st-normal";
//     let durationText = "";

//     if (tx.closed === "YES") {
//       statusText = "ปิดออเดอร์แล้ว";
//       badgeClass = "closed-yes";
//       durationText = "รับสินค้า/เสร็จสิ้น";
//     } else if (dData && dData.due_date) {
//       const targetDate = new Date(dData.due_date);
//       const todayObj = new Date();

//       targetDate.setHours(0,0,0,0);
//       todayObj.setHours(0,0,0,0);

//       if (targetDate.getTime() === todayObj.getTime()) {
//         statusText = "ครบกำหนด";
//         badgeClass = "st-today";
//         durationText = "ครบกำหนดวันนี้";
//       } else if (targetDate < todayObj) {
//         statusText = "เกินกำหนด";
//         badgeClass = "st-overdue";
//         const timeDiff = todayObj.getTime() - targetDate.getTime();
//         const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
//         durationText = `ค้าง ${daysDiff} วัน`;
//       } else {
//         const diffDays = Math.ceil((targetDate.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
//         durationText = `อีก ${diffDays} วัน`;
//       }
//     }

//     return { statusText, badgeClass, durationText };
//   };

//   const clearForm = () => {
//     setFormMode("add");
//     setEditTxId("");
//     setIsDepositUnlocked(false);
    
//     setProduct("");
//     setCustomerName("");
//     setChatLink("");
//     setPhoneNumber("");
//     setChannel("LINE");
    
//     setDepositAmount("");
//     setDepositDate(todayStr);
//     setRemainingBalance("");
//     setDueDate("");
    
//     setPaymentDate("");
//     setTotalPaidAmount("");
//     setClosed("NO");
//     setInputStatus("");
//     setNote("");
//   };

//   const triggerEditMode = (tx: Transaction) => {
//     const depositList = tx.transaction_deposit;
//     const dData: DepositDetail = Array.isArray(depositList) 
//       ? depositList[0] 
//       : (depositList || { deposit_amount: 0, remaining_balance: 0 });

//     setFormMode("edit");
//     setEditTxId(tx.transaction_id);
//     setIsDepositUnlocked(false); 

//     setProduct(tx.product || "");
//     setCustomerName(tx.customer_name || "");
//     setChatLink(tx.chat_link || "");
//     setPhoneNumber(tx.phone_number || "");
//     setChannel(tx.channel || "LINE");
    
//     setDepositAmount(String(dData.deposit_amount || 0));
//     setDepositDate(dData.deposit_date || "");
//     setRemainingBalance(String(dData.remaining_balance || 0));
//     setDueDate(dData.due_date || "");

//     setPaymentDate(dData.payment_date || "");
//     setTotalPaidAmount(dData.total_paid_amount !== undefined && dData.total_paid_amount !== null ? String(dData.total_paid_amount) : "");
    
//     setClosed(tx.closed || "NO");
//     setInputStatus(dData.input_status || "");
//     setNote(tx.note || "");
//   };

//   const handleDepositUnlockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     setIsDepositUnlocked(e.target.checked);
//   };

//   const handleFormSubmit = async (event: React.FormEvent) => {
//     event.preventDefault();
//     setIsSubmitting(true);

//     const adminLineId = sessionStorage.getItem("admin_line_id") || "Unknown";
//     const adminName = sessionStorage.getItem("admin_name") || "Unknown";

//     let payload: any = {
//       product: product,
//       customer_name: customerName,
//       phone_number: phoneNumber,
//       channel: channel,
//       closed: closed,
//       input_status: inputStatus,
//       note: note,
//       created_by_line_id: adminLineId,
//       created_by_name: adminName,
//       chat_link: chatLink,
//       is_edit_deposit_master: isDepositUnlocked
//     };

//     const safeDepositAmount = parseFloat(depositAmount) || 0;
//     const safeRemainingBalance = parseFloat(remainingBalance) || 0;
//     const safeTotalPaidAmount = parseFloat(totalPaidAmount) || 0;

//     if (formMode === "add") {
//       payload.deposit_amount = parseFloat(depositAmount || "0");
//       payload.deposit_date = depositDate || null;
//       payload.remaining_balance = parseFloat(remainingBalance || "0");
//       payload.due_date = dueDate || null;
//       payload.payment_date = null;
//       payload.total_paid_amount = 0;
//     } else {
//       if (isDepositUnlocked) {
//         payload.deposit_amount = parseFloat(depositAmount || "0");
//         payload.deposit_date = depositDate || null;
//         payload.remaining_balance = parseFloat(remainingBalance || "0");
//         payload.due_date = dueDate || null;
//         payload.payment_date = null;
//         payload.total_paid_amount = 0;
//       } else {
//         payload.deposit_amount = safeDepositAmount;
//         payload.deposit_date = depositDate || null;
//         payload.remaining_balance = safeRemainingBalance;
//         payload.due_date = dueDate || null;
        
//         // บันทึกการรับชำระส่วนที่เหลือ
//         payload.payment_date = paymentDate || null;
//         payload.total_paid_amount = safeTotalPaidAmount;
//       }
//     }

//     let url = "/api/deposit-transactions";
//     let method = "POST";

//     if (formMode === "edit") {
//       url = `/api/deposit-transactions/${encodeURIComponent(editTxId)}`;
//       method = "PUT";
//     }

//     try {
//       const response = await fetch(`${url}?token=${token}&admin_line_id=${adminLineId}`, {
//         method: method,
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload)
//       });

//       if (response.ok) {
//         alert("บันทึกข้อมูลมัดจำสำเร็จ!");
//         clearForm();
//         await loadData();
//       } else {
//         const err = await response.json();
//         alert("เกิดข้อผิดพลาด: " + (err.detail || "ไม่สามารถบันทึกได้"));
//       }
//     } catch (error) {
//       console.error(error);
//       alert("เกิดข้อผิดพลาดในการเชื่อมต่อเน็ตเวิร์ก");
//     } finally {
//       setIsSubmitting(false);
//     }
//   };
  
//   const filteredTransactions = allTransactions.filter(x => {
//     if (closedFilter !== "ALL" && x.closed !== closedFilter) return false;

//     const { statusText } = calculateOverdueAndDuration(x);

//     if (statusFilter !== "ALL" && statusFilter !== statusText) return false;
//     if (excludePaidFilter === "YES" && statusText === "ชำระแล้ว") return false;

//     const q = searchTerm.toLowerCase().trim();
//     const name = (x.customer_name || "").toLowerCase();
//     const txId = (x.transaction_id || "").toLowerCase();
//     const pDetail = (x.product || "").toLowerCase();

//     return q === "" || name.includes(q) || txId.includes(q) || pDetail.includes(q);
//   });

//   // ฟังก์ชันสลับเงื่อนไขตัวกรองอัจฉริยะแบบโค้ดเก่า
//   const changeClosedFilter = (val: string) => {
//     setClosedFilter(val);
//     if (val === "YES") {
//       setExcludePaidFilter("NO");
//       setStatusFilter("ALL");
//     }
//   };

//   const changeStatusFilter = (val: string) => {
//     setStatusFilter(val);
//     if (val !== "ALL" && val !== "ชำระแล้ว" && closedFilter === "YES") {
//       setClosedFilter("NO");
//     }
//   };

//   const getHomeUrl = () => {
//     const adminLineId = sessionStorage.getItem("admin_line_id") || "";
//     const params = new URLSearchParams();
//     if (token) params.set("token", token);
//     if (adminLineId) params.set("admin_line_id", adminLineId);
//     return params.toString() ? `/?${params.toString()}` : "/";
//   };

//   return (
//     <div>
//       <div className="header-container">
//         <h2>ระบบมัดจำ (Deposit Transactions)</h2>
//         <div className="action-buttons">
//           <Link href={getHomeUrl()} className="btn btn-default">
//             <ArrowLeft size={24} /> กลับหน้าหลัก
//           </Link>
//           <button type="button" onClick={loadData} className="btn btn-default" disabled={loading}>
//             <RefreshCw size={24} className={loading ? "animate-spin" : ""} /> รีเฟรช
//           </button>
//           <button type="button" onClick={clearForm} className="btn btn-primary">
//             <Plus size={24} /> สร้างรายการมัดจำ
//           </button>
//         </div>
//       </div>

//       <div className="main-layout">
//         <div className="table-container">
//           <div className="table-header-bar">
//             <div className="search-wrapper">
//               <Search className="search-icon" size={16} />
//               <input
//                 type="text"
//                 className="search-input"
//                 placeholder="ค้นหาชื่อลูกค้า, สินค้า หรือ ID..."
//                 value={searchTerm}
//                 onChange={(e) => setSearchTerm(e.target.value)}
//               />
//             </div>

//             <div>
//               <span className="filter-label">ปิดยอดแล้ว:</span>
//               <div className="filter-group">
//                 <button type="button" className={`filter-btn ${closedFilter === "ALL" ? "active" : ""}`} onClick={() => changeClosedFilter("ALL")}>ทั้งหมด</button>
//                 <button type="button" className={`filter-btn ${closedFilter === "NO" ? "active" : ""}`} onClick={() => changeClosedFilter("NO")}>เปิดอยู่ (NO)</button>
//                 <button type="button" className={`filter-btn ${closedFilter === "YES" ? "active" : ""}`} onClick={() => changeClosedFilter("YES")}>ปิดแล้ว (YES)</button>
//               </div>
//             </div>

//             <div>
//               <span className="filter-label">ซ่อนรายการที่ชำระแล้ว:</span>
//               <div className="filter-group">
//                 <button type="button" className={`filter-btn ${excludePaidFilter === "YES" ? "active" : ""}`} onClick={() => setExcludePaidFilter("YES")}>YES</button>
//                 <button type="button" className={`filter-btn ${excludePaidFilter === "NO" ? "active" : ""}`} onClick={() => setExcludePaidFilter("NO")}>NO</button>
//               </div>
//             </div>

//             <div>
//               <span className="filter-label">สถานะจากระบบ:</span>
//               <div className="filter-group">
//                 <button type="button" className={`filter-btn ${statusFilter === "ALL" ? "active" : ""}`} onClick={() => changeStatusFilter("ALL")}>ทั้งหมด</button>
//                 <button type="button" className={`filter-btn ${statusFilter === "ยังไม่ถึงกำหนด" ? "active" : ""}`} onClick={() => changeStatusFilter("ยังไม่ถึงกำหนด")}>ยังไม่ถึงกำหนด</button>
//                 <button type="button" className={`filter-btn ${statusFilter === "ครบกำหนด" ? "active" : ""}`} onClick={() => changeStatusFilter("ครบกำหนด")}>ครบกำหนด</button>
//                 <button type="button" className={`filter-btn ${statusFilter === "เกินกำหนด" ? "active" : ""}`} onClick={() => changeStatusFilter("เกินกำหนด")}>เกินกำหนด</button>
//               </div>
//             </div>
//           </div>

//           <div className="table-wrapper">
//             <table className="product-table">
//               <thead>
//                 <tr>
//                   <th className="col-id">Transaction ID</th>
//                   <th className="col-product">รหัสสินค้า</th>
//                   <th className="col-customer">ชื่อลูกค้า</th>
//                   <th className="col-phone">เบอร์โทร</th>
//                   <th className="col-channel">ช่องทาง</th>
//                   <th className="col-sys-status">สถานะจากระบบ</th>
//                   <th className="col-amount">ยอดเงินมัดจำที่ชำระ</th>
//                   <th className="col-date">วันที่ชำระเงินมัดจำ</th>
//                   <th className="col-balance">ยอดคงเหลือ</th>
//                   <th className="col-due-date">กำหนดชำระ</th>
//                   <th className="col-paid">ยอดเงินที่ชำระ</th>
//                   <th className="col-pay-date">วันที่ชำระ</th>
//                   <th className="col-admin-status">สถานะจากแอดมิน</th>
//                   <th className="col-closed">ปิดยอดแล้ว</th>
//                   <th className="col-note">หมายเหตุ</th>
//                   <th className="col-admin-name">แอดมินที่ทำรายการ</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {loading ? (
//                   <tr><td colSpan={16} className="table-empty-row">กำลังดึงข้อมูลการมัดจำ...</td></tr>
//                 ) : filteredTransactions.length === 0 ? (
//                   <tr><td colSpan={16} className="table-empty-row no-match">ไม่พบข้อมูลการมัดจำที่ตรงเงื่อนไข</td></tr>
//                 ) : (
//                   filteredTransactions.map((x) => {
//                     const depositList = x.transaction_deposit;
//                     const dData = Array.isArray(depositList) ? depositList[0] : depositList;
//                     const { statusText, badgeClass, durationText } = calculateOverdueAndDuration(x);

//                     const adminUserText = x.updated_by_name && x.updated_by_name !== "Unknown" 
//                       ? x.updated_by_name 
//                       : (x.created_by_name || "-");

//                     return (
//                       <tr key={x.transaction_id} onClick={() => triggerEditMode(x)}>
//                         <td><strong>{x.transaction_id}</strong></td>
//                         <td><small>{x.product || "-"}</small></td>
//                         <td>
//                           {x.chat_link ? (
//                             <a 
//                               href={x.chat_link} 
//                               target="_blank" 
//                               rel="noreferrer"
//                               onClick={(e) => e.stopPropagation()} 
//                               className="table-link-customer"
//                             >
//                               {x.customer_name}
//                             </a>
//                           ) : (
//                             x.customer_name
//                           )}
//                         </td>
//                         <td>{x.phone_number || "-"}</td>
//                         <td><small>{x.channel}</small></td>
//                         <td><span className={`status-badge ${badgeClass}`}>{statusText}</span></td>
//                         <td>{dData?.deposit_amount ? Number(dData.deposit_amount).toLocaleString() : "0"} บ.</td>
//                         <td>{dData?.deposit_date || "-"}</td>
//                         <td>
//                           <div className={
//                             x.closed === "YES" 
//                             ? "table-overdue-closed" // หรือใช้คลาสสีเทา/เขียวเข้มที่คุณมี เช่น "table-txt-muted"
//                             : (dData?.remaining_balance && Number(dData.remaining_balance) > 0) 
//                               ? "table-overdue-red" 
//                               : "table-overdue-green"
//                           }>
//                             {dData?.remaining_balance ? Number(dData.remaining_balance).toLocaleString() : "0"} บ.
//                           </div>
//                           <div className="table-txt-small-italic">
//                             ({durationText})
//                           </div>
//                         </td>
//                         <td>{dData?.due_date || "-"}</td>
//                         <td>{dData?.total_paid_amount ? Number(dData.total_paid_amount).toLocaleString() : "-"}</td>
//                         <td>{dData?.payment_date || "-"}</td>
//                         <td>{dData?.input_status || "-"}</td>
//                         <td><span className={`status-badge ${x.closed === "YES" ? "closed-yes" : ""}`}>{x.closed}</span></td>
//                         <td><span className="table-txt-muted">{x.note || "-"}</span></td>
//                         <td><span className="table-txt-admin">{adminUserText}</span></td>
//                       </tr>
//                     );
//                   })
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </div>

//         <div className="form-card">
//           <h3>
//             {formMode === "add" ? <PlusCircle size={24} /> : <SquarePen size={24} />}
//             <span className="form-title-text">{formMode === "add" ? "สร้างรายการมัดจำ" : "จัดการรายการมัดจำ"}</span>
//           </h3>
          
//           <form onSubmit={handleFormSubmit}>
//             <div className="form-sub-header">
//               <span className="form-sub-title">รายละเอียดการมัดจำ</span>
//               {formMode === "edit" && (
//                 <label className="form-edit-checkbox-label">
//                   <input type="checkbox" checked={isDepositUnlocked} onChange={handleDepositUnlockChange} />
//                   แก้ไขข้อมูล
//                 </label>
//               )}
//             </div>

//             <div className="form-group">
//               <label htmlFor="product">รหัสสินค้า</label>
//               <input
//                 type="text"
//                 id="product"
//                 required
//                 placeholder="กรอกรายละเอียดสินค้า"
//                 disabled={formMode === "edit" && !isDepositUnlocked}
//                 value={product}
//                 onChange={(e) => setProduct(e.target.value)}
//               />
//             </div>

//             <div className="form-group">
//               <label htmlFor="customer_name">ชื่อลูกค้า</label>
//               <input
//                 type="text"
//                 id="customer_name"
//                 required
//                 placeholder="ชื่อ-นามสกุล"
//                 disabled={formMode === "edit" && !isDepositUnlocked}
//                 value={customerName}
//                 onChange={(e) => setCustomerName(e.target.value)}
//               />
//             </div>

//             <div className="form-group">
//               <label htmlFor="chat_link">ลิงก์แชทลูกค้า</label>
//               <input
//                 type="url"
//                 id="chat_link"
//                 placeholder="วางลิงก์แชท เช่น https://line.me/..."
//                 disabled={formMode === "edit" && !isDepositUnlocked}
//                 value={chatLink}
//                 onChange={(e) => setChatLink(e.target.value)}
//               />
//             </div>

//             <div className="form-group">
//               <label htmlFor="phone_number">เบอร์โทรศัพท์</label>
//               <input
//                 type="text"
//                 id="phone_number"
//                 placeholder="0xxxxxxxxx"
//                 disabled={formMode === "edit" && !isDepositUnlocked}
//                 value={phoneNumber}
//                 onChange={(e) => setPhoneNumber(e.target.value)}
//               />
//             </div>

//             <div className="form-group">
//               <label htmlFor="channel">ช่องทางติดต่อ</label>
//               <select
//                 id="channel"
//                 disabled={formMode === "edit" && !isDepositUnlocked}
//                 value={channel}
//                 onChange={(e) => setChannel(e.target.value)}
//               >
//                 <option value="LINE">LINE</option>
//                 <option value="FB">FB</option>
//                 <option value="IG">IG</option>
//                 <option value="OTHER">Other</option>
//               </select>
//             </div>


//             <hr className="divider-dashed" />

//             <div className="form-group">
//               <label>ยอดเงินมัดจำที่ชำระ</label>
//               <input
//                 type="number"
//                 step="0.01"
//                 required
//                 disabled={formMode === "edit" && !isDepositUnlocked}
//                 value={depositAmount}
//                 onChange={(e) => setDepositAmount(e.target.value)}
//               />
//             </div>

//             <div className="form-group">
//               <label>วันที่ชำระเงินมัดจำ</label>
//               <input
//                 type="date"
//                 required
//                 disabled={formMode === "edit" && !isDepositUnlocked}
//                 value={depositDate}
//                 onChange={(e) => setDepositDate(e.target.value)}
//               />
//             </div>

//             <div className="form-group">
//               <label>ยอดชำระครั้งถัดไป</label>
//               <input
//                 type="number"
//                 step="0.01"
//                 required
//                 disabled={formMode === "edit" && !isDepositUnlocked}
//                 value={remainingBalance}
//                 onChange={(e) => setRemainingBalance(e.target.value)}
//               />
//             </div>

//             <div className="form-group">
//               <label>วันครบกำหนดชำระครั้งถัดไป</label>
//               <input
//                 type="date"
//                 required
//                 disabled={formMode === "edit" && !isDepositUnlocked}
//                 value={dueDate}
//                 onChange={(e) => setDueDate(e.target.value)}
//               />
//             </div>

//             {formMode === "edit" && (
//               <>
//                 <div className={`inner-payment-card ${isDepositUnlocked ? "disabled-zone" : "active-zone"}`}>
//                   {isDepositUnlocked && (
//                    <div className="alert-warning-box">
//                     <span>
//                       ⚠️ หมายเหตุ: กรณีแก้ไขข้อมูลรายการมัดจำเดิม จะไม่สามารถอัปเดตข้อมูลการรับชำระพร้อมกันได้ 
//                     </span>
//                   </div>
//                 )}
                  
//                   <div className="form-group">
//                     <label htmlFor="payment_date">วันที่ชำระ</label>
//                     <input
//                       type="date"
//                       id="payment_date"
//                       disabled={isDepositUnlocked} 
//                       value={paymentDate}
//                       onChange={(e) => setPaymentDate(e.target.value)}
//                     />
//                   </div>
                  
//                   <div className="form-group">
//                     <label htmlFor="total_paid_amount">ยอดเงินที่ชำระ (บาท)</label>
//                     <input
//                       type="number"
//                       step="0.01"
//                       id="total_paid_amount"
//                       placeholder="0.00"
//                       disabled={isDepositUnlocked} 
//                       value={totalPaidAmount}
//                       onChange={(e) => setTotalPaidAmount(e.target.value)}
//                     />
//                   </div>

//                   <div className="form-group">
//                     <label htmlFor="closed">ปิดยอดรายการมัดจำนี้เลยหรือไม่?</label>
//                     <select
//                       id="closed"
//                       disabled={isDepositUnlocked}
//                       value={closed}
//                       onChange={(e) => setClosed(e.target.value)}
//                     >
//                       <option value="NO">NO (ยังค้างชำระอยู่)</option>
//                       <option value="YES">YES (ชำระครบ)</option>
//                     </select>
//                   </div>
//                 </div>
//               </>
//             )}

//             <hr className="divider-dashed" />

//             <div className="form-group">
//               <label htmlFor="input_status">สถานะจากแอดมิน</label>
//               <input
//                 type="text"
//                 id="input_status"
//                 placeholder="ระบุสถานะ..."
//                 value={inputStatus}
//                 onChange={(e) => setInputStatus(e.target.value)}
//               />
//             </div>

//             <div className="form-group">
//               <label htmlFor="note">หมายเหตุ</label>
//               <textarea
//                 id="note"
//                 placeholder="ระบุหมายเหตุ..."
//                 rows={2}
//                 value={note}
//                 onChange={(e) => setNote(e.target.value)}
//               ></textarea>
//             </div>

//             <button 
//               type="submit" 
//               className={`btn btn-block ${isSubmitting ? "btn-default" : "btn-success"}`} 
//               disabled={isSubmitting}
//             >
//               {isSubmitting ? (
//                 <><Loader2 size={16} className="animate-spin" /> กำลังบันทึก...</>
//               ) : (
//                 <><Save size={16} /> บันทึกข้อมูลมัดจำ</>
//               )}
//             </button>
//           </form>
//         </div>
//       </div>
//     </div>
//   );
// }
