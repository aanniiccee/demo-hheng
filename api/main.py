import datetime
import os
import re
import urllib.parse
from calendar import monthrange
from datetime import date
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv
from fastapi import Body, FastAPI, HTTPException
from pydantic import BaseModel

load_dotenv()

app = FastAPI()

# ==============================================================================
# 1. MOCK DATASETS
# ==============================================================================

TRANSACTION_MASTER = [
    # --- DEPOSIT (มัดจำ) ---
    {
        "transaction_id": "DP_1_1",
        "transaction_type": "DEPOSIT",
        "product_id": None,
        "customer_name": "คุณสมชาย สายเปย์",
        "phone_number": "0812345678",
        "channel": "FB",
        "current_status": "ชำระครบแล้ว",
        "closed": "YES",
        "note": "[ระบบ] รับชำระส่วนที่เหลือเรียบร้อย ปิดเคสทันที",
        "client_id": 1,
        "created_at": "2026-07-17 07:32:19.48177+00",
        "updated_at": "2026-07-17 07:43:26.62551+00",
        "product": "Rolex Submariner",
        "created_by_line_id": "U11112222333344445555666677778888",
        "created_by_name": "Admin Alex",
        "updated_by_line_id": "U11112222333344445555666677778888",
        "updated_by_name": "Admin Alex",
        "chat_link": "https://m.me/demo_shop_page",
    },
    {
        "transaction_id": "DP_1_2",
        "transaction_type": "DEPOSIT",
        "product_id": None,
        "customer_name": "คุณวิภาวี มั่นคง",
        "phone_number": "0835447001",
        "channel": "LINE",
        "current_status": "ชำระครบแล้ว",
        "closed": "YES",
        "note": "[ระบบ] รับชำระส่วนที่เหลือเรียบร้อย ปิดเคสทันที",
        "client_id": 1,
        "created_at": "2026-07-20 05:51:01.807821+00",
        "updated_at": "2026-07-20 07:09:43.836039+00",
        "product": "Hermes Birkin 30",
        "created_by_line_id": "U99998888777766665555444433332222",
        "created_by_name": "Admin Bella",
        "updated_by_line_id": "U99998888777766665555444433332222",
        "updated_by_name": "Admin Bella",
        "chat_link": "https://line.me/R/ti/p/@demo_shop",
    },
    {
        "transaction_id": "DP_1_3",
        "transaction_type": "DEPOSIT",
        "product_id": None,
        "customer_name": "คุณกิตติศักดิ์ มีทรัพย์",
        "phone_number": "0891112233",
        "channel": "IG",
        "current_status": "รอนัดรับ/ชำระส่วนที่เหลือ",
        "closed": "NO",
        "note": "ลูกค้ามัดจำไว้แล้ว นัดรับสินค้าปลายเดือน",
        "client_id": 1,
        "created_at": "2026-08-01 10:15:00.000000+00",
        "updated_at": "2026-08-01 10:15:00.000000+00",
        "product": "Chanel Classic Flap",
        "created_by_line_id": "U11112222333344445555666677778888",
        "created_by_name": "Admin Alex",
        "updated_by_line_id": "U11112222333344445555666677778888",
        "updated_by_name": "Admin Alex",
        "chat_link": "https://instagram.com/direct/t/demo_chat",
    },

    # --- INSTALLMENT (ผ่อนชำระ) ---
    {
        "transaction_id": "IS_1_1_1",
        "transaction_type": "INSTALLMENT",
        "product_id": None,
        "customer_name": "คุณนภา วงศ์สว่าง",
        "phone_number": "0899999991",
        "channel": "LINE",
        "current_status": "ยังไม่ถึงกำหนด",
        "closed": "NO",
        "note": "[ระบบ] สร้างงวดที่ 1/3",
        "client_id": 1,
        "created_at": "2026-06-24 07:05:46.223269+00",
        "updated_at": "2026-06-24 07:05:46.223269+00",
        "product": "แหวนเพชร 5 กะรัต",
        "created_by_line_id": "U11112222333344445555666677778888",
        "created_by_name": "Admin Alex",
        "updated_by_line_id": "Unknown",
        "updated_by_name": "Unknown",
        "chat_link": "https://line.me/R/ti/p/@demo_shop",
    },
    {
        "transaction_id": "IS_1_2_1",
        "transaction_type": "INSTALLMENT",
        "product_id": None,
        "customer_name": "คุณธนกฤต ใจดี",
        "phone_number": "0899999990",
        "channel": "LINE",
        "current_status": "VOID",
        "closed": "YES",
        "note": "[ระบบ] สัญญานี้ถูกยกเลิก (Voided)",
        "client_id": 1,
        "created_at": "2026-06-26 04:19:57.37935+00",
        "updated_at": "2026-06-26 04:20:47.40644+00",
        "product": "สร้อยคอ",
        "created_by_line_id": "U11112222333344445555666677778888",
        "created_by_name": "Admin Alex",
        "updated_by_line_id": "Unknown",
        "updated_by_name": "Unknown",
        "chat_link": None,
    },
    {
        "transaction_id": "IS_1_3_1",
        "transaction_type": "INSTALLMENT",
        "product_id": None,
        "customer_name": "คุณอนันต์ สุขสวัสดิ์",
        "phone_number": "0823456789",
        "channel": "WALK_IN",
        "current_status": "เกินกำหนดชำระ",
        "closed": "NO",
        "note": "ค้างชำระงวดที่ 2 ติดต่อแล้วแจ้งจะโอนเย็นนี้",
        "client_id": 1,
        "created_at": "2026-05-10 09:00:00.000000+00",
        "updated_at": "2026-06-11 11:20:00.000000+00",
        "product": "กำไลข้อมือ",
        "created_by_line_id": "U99998888777766665555444433332222",
        "created_by_name": "Admin Bella",
        "updated_by_line_id": "U99998888777766665555444433332222",
        "updated_by_name": "Admin Bella",
        "chat_link": None,
    },

    # --- PAWN (ขายฝาก/จำนำ) ---
    {
        "transaction_id": "PW_1_1_1",
        "transaction_type": "PAWN",
        "product_id": None,
        "customer_name": "คุณปิยะวัฒน์ รักดี",
        "phone_number": "0899999999",
        "channel": "FB",
        "current_status": "PENDING",
        "closed": "NO",
        "note": "รอชำระดอกเบี้ยงวดถัดไป",
        "client_id": 1,
        "created_at": "2026-06-24 07:03:37.050306+00",
        "updated_at": "2026-06-24 07:03:37.050306+00",
        "product": "สร้อยคอทองคำ 2 บาท",
        "created_by_line_id": "U11112222333344445555666677778888",
        "created_by_name": "Admin Alex",
        "updated_by_line_id": "Unknown",
        "updated_by_name": "Unknown",
        "chat_link": "https://m.me/demo_shop_page",
    },
    {
        "transaction_id": "PW_1_3_1",
        "transaction_type": "PAWN",
        "product_id": None,
        "customer_name": "คุณศิริพร บุญมา",
        "phone_number": "0899999991",
        "channel": "FB",
        "current_status": "ชำระแล้ว",
        "closed": "YES",
        "note": "[ระบบ] ปิดสัญญา ไถ่ถอนเรียบร้อย",
        "client_id": 1,
        "created_at": "2026-06-26 03:12:46.556952+00",
        "updated_at": "2026-06-26 04:15:48.394839+00",
        "product": "เลสข้อมือทองคำ 1 บาท",
        "created_by_line_id": "U11112222333344445555666677778888",
        "created_by_name": "Admin Alex",
        "updated_by_line_id": "U11112222333344445555666677778888",
        "updated_by_name": "Admin Alex",
        "chat_link": "https://m.me/demo_shop_page",
    },
    {
        "transaction_id": "PW_1_4_1",
        "transaction_type": "PAWN",
        "product_id": None,
        "customer_name": "คุณณรงค์ศักดิ์ มั่งคั่ง",
        "phone_number": "0876543210",
        "channel": "WALK_IN",
        "current_status": "OVERDUE",
        "closed": "NO",
        "note": "เลยกำหนดต่อดอก 5 วัน ส่ง SMS แจ้งเตือนแล้ว",
        "client_id": 1,
        "created_at": "2026-05-01 08:30:00.000000+00",
        "updated_at": "2026-06-05 09:10:00.000000+00",
        "product": "แหวนเพชรแท้ 1 กะรัต",
        "created_by_line_id": "U99998888777766665555444433332222",
        "created_by_name": "Admin Bella",
        "updated_by_line_id": "U99998888777766665555444433332222",
        "updated_by_name": "Admin Bella",
        "chat_link": None,
    },

    # --- REPAIR (งานซ่อม) ---
    {
        "transaction_id": "RP_1_1",
        "transaction_type": "REPAIR",
        "product_id": None,
        "customer_name": "คุณชลธิชา เจริญสุข",
        "phone_number": "0845273824",
        "channel": "FB",
        "current_status": "ปิดเคสแล้ว",
        "closed": "YES",
        "note": "[ระบบ] ส่งมอบสินค้าและปิดเคสเรียบร้อย",
        "client_id": 1,
        "created_at": "2026-07-20 01:32:19.797846+00",
        "updated_at": "2026-07-20 02:32:32.076507+00",
        "product": "แหวนเพชร ซ่อมเพชรหลุด",
        "created_by_line_id": "U11112222333344445555666677778888",
        "created_by_name": "Admin Alex",
        "updated_by_line_id": "U11112222333344445555666677778888",
        "updated_by_name": "Admin Alex",
        "chat_link": "https://m.me/demo_shop_page",
    },
    {
        "transaction_id": "RP_1_2",
        "transaction_type": "REPAIR",
        "product_id": None,
        "customer_name": "คุณก้องเกียรติ สุขใจ",
        "phone_number": "0861122334",
        "channel": "LINE",
        "current_status": "กำลังดำเนินการซ่อม",
        "closed": "NO",
        "note": "รออะไหล่",
        "client_id": 1,
        "created_at": "2026-08-02 04:20:00.000000+00",
        "updated_at": "2026-08-02 04:20:00.000000+00",
        "product": "ปรับไซส์แหวน",
        "created_by_line_id": "U99998888777766665555444433332222",
        "created_by_name": "Admin Bella",
        "updated_by_line_id": "U99998888777766665555444433332222",
        "updated_by_name": "Admin Bella",
        "chat_link": "https://line.me/R/ti/p/@demo_shop",
    },

    # --- TRACKING (พัสดุ/ติดตาม) ---
    {
        "transaction_id": "TK_1_1",
        "transaction_type": "TRACKING",
        "product_id": None,
        "customer_name": "คุณนพดล ดวงดี",
        "phone_number": "0834210824",
        "channel": "LINE",
        "current_status": "PENDING",
        "closed": "NO",
        "note": "จัดส่งเรียบร้อย รอลูกค้าเซ็นรับ",
        "client_id": 1,
        "created_at": "2026-07-20 05:50:01.822708+00",
        "updated_at": "2026-07-20 05:56:14.839041+00",
        "product": "กำไลเพชร",
        "created_by_line_id": "U11112222333344445555666677778888",
        "created_by_name": "Admin Alex",
        "updated_by_line_id": "U11112222333344445555666677778888",
        "updated_by_name": "Admin Alex",
        "chat_link": "https://line.me/R/ti/p/@demo_shop",
    },
    {
        "transaction_id": "TK_1_2",
        "transaction_type": "TRACKING",
        "product_id": None,
        "customer_name": "คุณอารียา สมบูรณ์",
        "phone_number": "0859988776",
        "channel": "IG",
        "current_status": "DELIVERED",
        "closed": "YES",
        "note": "ลูกค้ารับสินค้าเรียบร้อยแล้ว",
        "client_id": 1,
        "created_at": "2026-07-10 03:00:00.000000+00",
        "updated_at": "2026-07-12 08:30:00.000000+00",
        "product": "นาฬิกา Patek Philippe",
        "created_by_line_id": "U99998888777766665555444433332222",
        "created_by_name": "Admin Bella",
        "updated_by_line_id": "U99998888777766665555444433332222",
        "updated_by_name": "Admin Bella",
        "chat_link": "https://instagram.com/direct/t/demo_chat",
    },
]

TRANSACTION_DEPOSIT = [
    {
        "transaction_id": "DP_1_1",
        "deposit_amount": "4000.00",
        "remaining_balance": "0.00",
        "due_date": "2026-07-17",
        "payment_date": "2026-07-17",
        "client_id": 1,
        "input_status": "ชำระครบแล้ว",
        "created_at": "2026-07-17 07:32:20.304568+00",
        "updated_at": "2026-07-17 07:43:27.381134+00",
        "deposit_date": "2026-07-01",
        "total_paid_amount": "14000.00",
    },
    {
        "transaction_id": "DP_1_2",
        "deposit_amount": "10000.00",
        "remaining_balance": "0.00",
        "due_date": "2026-07-31",
        "payment_date": "2026-07-20",
        "client_id": 1,
        "input_status": "ชำระครบแล้ว",
        "created_at": "2026-07-20 05:51:02.579744+00",
        "updated_at": "2026-07-20 07:09:44.6394+00",
        "deposit_date": "2026-07-20",
        "total_paid_amount": "70000.00",
    },
    {
        "transaction_id": "DP_1_3",
        "deposit_amount": "15000.00",
        "remaining_balance": "45000.00",
        "due_date": "2026-08-31",
        "payment_date": None,
        "client_id": 1,
        "input_status": "คงเหลือชำระ",
        "created_at": "2026-08-01 10:15:00.000000+00",
        "updated_at": "2026-08-01 10:15:00.000000+00",
        "deposit_date": "2026-08-01",
        "total_paid_amount": "15000.00",
    },
]

TRANSACTION_INSTALLMENT = [
    {
        "transaction_id": "IS_1_1_1",
        "installment_amount": "2000.00",
        "total_periods": 3,
        "current_period": 1,
        "monthly_due_day": 22,
        "payment_date": None,
        "total_paid_amount": 0,
        "due_date": "2026-09-22",
        "input_status": "ปกติ",
        "client_id": 1,
        "created_at": "2026-06-24 07:05:46.493584+00",
        "updated_at": "2026-06-24 07:05:46.493584+00",
    },
    {
        "transaction_id": "IS_1_2_1",
        "installment_amount": "4000.00",
        "total_periods": 6,
        "current_period": 1,
        "monthly_due_day": 26,
        "payment_date": "2026-06-26",
        "total_paid_amount": 4000,
        "due_date": "2026-06-26",
        "input_status": "ยกเลิกสัญญา",
        "client_id": 1,
        "created_at": "2026-06-26 04:19:57.686225+00",
        "updated_at": "2026-06-26 04:19:57.686225+00",
    },
    {
        "transaction_id": "IS_1_3_1",
        "installment_amount": "3500.00",
        "total_periods": 4,
        "current_period": 2,
        "monthly_due_day": 10,
        "payment_date": None,
        "total_paid_amount": 3500,
        "due_date": "2026-06-10",
        "input_status": "ค้างชำระ",
        "client_id": 1,
        "created_at": "2026-05-10 09:00:00.000000+00",
        "updated_at": "2026-06-11 11:20:00.000000+00",
    },
]

TRANSACTION_PAWN = [
    {
        "transaction_id": "PW_1_1_1",
        "interest_per_month": "500.00",
        "payment_date": None,
        "next_due_date": "2026-09-21",
        "input_status": "ปกติ",
        "client_id": 1,
        "total_paid_amount": 0,
        "created_at": "2026-07-17 03:16:03.514291+00",
        "updated_at": "2026-07-17 03:16:03.514291+00",
    },
    {
        "transaction_id": "PW_1_3_1",
        "interest_per_month": "300.00",
        "payment_date": "2026-06-26",
        "next_due_date": "2026-06-26",
        "input_status": "ไถ่ถอนแล้ว",
        "client_id": 1,
        "total_paid_amount": 300,
        "created_at": "2026-07-17 03:16:03.514291+00",
        "updated_at": "2026-07-17 03:16:03.514291+00",
    },
    {
        "transaction_id": "PW_1_4_1",
        "interest_per_month": "1500.00",
        "payment_date": None,
        "next_due_date": "2026-06-01",
        "input_status": "เกินกำหนด",
        "client_id": 1,
        "total_paid_amount": 0,
        "created_at": "2026-05-01 08:30:00.000000+00",
        "updated_at": "2026-06-05 09:10:00.000000+00",
    },
]

TRANSACTION_REPAIR = [
    {
        "transaction_id": "RP_1_1",
        "received_date": "2026-07-16",
        "repaired_date": "2026-07-19",
        "delivery_date": "2026-07-20",
        "input_status": "ส่งมอบเรียบร้อย",
        "client_id": 1,
        "created_at": "2026-07-20 01:32:20.57407+00",
        "updated_at": "2026-07-20 02:32:32.867394+00",
    },
    {
        "transaction_id": "RP_1_2",
        "received_date": "2026-08-02",
        "repaired_date": None,
        "delivery_date": None,
        "input_status": "กำลังซ่อม",
        "client_id": 1,
        "created_at": "2026-08-02 04:20:00.000000+00",
        "updated_at": "2026-08-02 04:20:00.000000+00",
    },
]

TRANSACTION_TRACKING_MAP = {
    "TK_1_1": {
        "direction": "OUTBOUND",
        "shipping_date": "2026-07-20",
        "expected_date": "2026-07-22",
        "tracking_number": "EF123456789TH",
        "last_status": "นำจ่ายสำเร็จ",
        "status_detail": "พัสดุจัดส่งถึงผู้รับเรียบร้อยแล้ว",
        "status_update_at": "2026-07-22 14:30:00"
    },
    "TK_1_2": {
        "direction": "OUTBOUND",
        "shipping_date": "2026-07-10",
        "expected_date": "2026-07-12",
        "tracking_number": "TH01928374652A",
        "last_status": "ส่งมอบสำเร็จ",
        "status_detail": "นำจ่ายเรียบร้อย",
        "status_update_at": "2026-07-12 11:20:00"
    },
    "TK_1_3": {
        "direction": "INBOUND",
        "shipping_date": "2026-08-01",
        "expected_date": "2026-08-05",
        "tracking_number": "ED987654321TH",
        "last_status": "อยู่ระหว่างการขนส่ง",
        "status_detail": "ศูนย์ส่งมอบพัสดุ",
        "status_update_at": "2026-08-02 09:00:00"
    }
}

# ==============================================================================
# 2. VALIDATION & HELPERS (ตัด access_token ออก เช็คสิทธิ์ผ่านชีตอย่างเดียว)
# ==============================================================================

def validate_token(
    token: Optional[str] = None, admin_line_id: Optional[str] = None
):
    """
    ข้ามการตรวจเช็ค CLIENT_ACCESS_TOKEN 
    เนื่องจากเปลี่ยนมาใช้ระบบเช็คสิทธิ์ในชีต/Apps Script แทนแล้ว
    """
    if not admin_line_id or admin_line_id.strip() == "" or admin_line_id == "undefined":
        raise HTTPException(403, "Unauthorized: Missing admin_line_id")

    return {"client_id": 1}

def _get_joined_transactions(tx_type: str, child_table: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    child_map = {item["transaction_id"]: item for item in child_table}
    results = []
    for master in TRANSACTION_MASTER:
        if master.get("transaction_type") == tx_type:
            tx_id = master["transaction_id"]
            child_data = child_map.get(tx_id, {})
            merged = {**master, **child_data}
            results.append(merged)
    return results

def calculate_next_due_date(start_year, start_month, due_day, period_index):
    total_months = (start_month - 1) + period_index
    target_year = start_year + (total_months // 12)
    target_month = (total_months % 12) + 1
    _, last_day_of_month = monthrange(target_year, target_month)
    actual_day = min(due_day, last_day_of_month)
    return date(target_year, target_month, actual_day).isoformat()

# ==============================================================================
# 3. SCHEMAS
# ==============================================================================

class RedeemRequestIn(BaseModel):
    invite_code: Optional[str] = ""
    line_user_id: str
    admin_name: Optional[str] = "Unknown"

class PawnTransactionIn(BaseModel):
    product: Optional[str] = ''
    product_id: Optional[str] = ''
    is_edit_pawn_master: Optional[bool] = False
    customer_name: str
    phone_number: Optional[str] = ''
    channel: str
    closed: str
    note: Optional[str] = ''
    interest_per_month: float
    payment_date: Optional[str] = None
    next_due_date: str
    input_status: Optional[str] = ''
    total_paid_amount: Optional[float] = 0.0
    created_by_line_id: Optional[str] = 'Unknown'
    created_by_name: Optional[str] = 'Unknown'
    chat_link: Optional[str] = None

class InstallmentTransactionIn(BaseModel):
    product: Optional[str] = ''
    product_id: Optional[str] = ''
    customer_name: str
    phone_number: Optional[str] = ''
    channel: str
    note: Optional[str] = ''
    installment_amount: float
    total_periods: int
    current_period: int
    monthly_due_day: int
    start_month: int
    start_year: int
    payment_date: Optional[str] = None
    total_paid_amount: Optional[float] = 0.0
    input_status: Optional[str] = ''
    created_by_line_id: Optional[str] = 'Unknown'
    created_by_name: Optional[str] = 'Unknown'
    chat_link: Optional[str] = None

class DepositTransactionIn(BaseModel):
    product: Optional[str] = ''
    product_id: Optional[str] = ''
    customer_name: str
    phone_number: Optional[str] = ''
    channel: str
    deposit_amount: float = 0.0
    deposit_date: Optional[str] = None
    remaining_balance: float = 0.0
    due_date: Optional[str] = None
    total_paid_amount: Optional[float] = 0.0
    payment_date: Optional[str] = None
    closed: str = 'NO'
    note: Optional[str] = ''
    created_by_line_id: Optional[str] = 'Unknown'
    created_by_name: Optional[str] = 'Unknown'
    chat_link: Optional[str] = None
    input_status: Optional[str] = ''

class RepairTransactionIn(BaseModel):
    product: Optional[str] = ''
    product_id: Optional[str] = ''
    customer_name: str
    phone_number: Optional[str] = ''
    channel: str
    received_date: Optional[str] = None
    repaired_date: Optional[str] = None
    delivery_date: Optional[str] = None
    closed: str = 'NO'
    note: Optional[str] = ''
    input_status: Optional[str] = ''
    created_by_line_id: Optional[str] = 'Unknown'
    created_by_name: Optional[str] = 'Unknown'
    chat_link: Optional[str] = None

class TrackingTransactionIn(BaseModel):
    product: Optional[str] = ''
    customer_name: str
    phone_number: Optional[str] = ''
    channel: str
    chat_link: Optional[str] = None
    tracking_number: str
    is_delivered: str = 'NO'
    note: Optional[str] = ''
    direction: str = 'INBOUND'
    shipping_date: Optional[str] = None
    expected_date: Optional[str] = None
    created_by_line_id: Optional[str] = 'Unknown'
    created_by_name: Optional[str] = 'Unknown'

# ==============================================================================
# 4. API ENDPOINTS
# ==============================================================================

@app.get("/api/config/liff-id")
def get_liff_config():
    liff_id = os.environ.get("LIFF_ID") or os.environ.get("NEXT_PUBLIC_LIFF_ID")
    if not liff_id:
        raise HTTPException(
            status_code=500,
            detail="ระบบยังไม่ได้ตั้งค่า LIFF_ID ใน Environment Variables",
        )
    return {"liff_id": liff_id}

# --- REDEEM & AUTH ENDPOINT (เชื่อมต่อไปยัง Google Apps Script ของจริง) ---
@app.post('/api/redeem')
def redeem_admin_invite(payload: RedeemRequestIn):
    script_url = os.getenv("GOOGLE_SCRIPT_URL")
    if not script_url:
        raise HTTPException(
            status_code=500,
            detail="Server configuration error: GOOGLE_SCRIPT_URL is missing"
        )

    try:
        response = requests.post(
            script_url,
            json={
                "invite_code": payload.invite_code,
                "line_user_id": payload.line_user_id,
                "admin_name": payload.admin_name
            },
            timeout=10
        )
        return response.json()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to Google Script: {str(e)}"
        )

# --- PAWN ENDPOINTS ---
@app.get('/api/pawn-transactions/{tx_id}')
def get_single_pawn_transaction(tx_id: str, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    decoded_tx_id = urllib.parse.unquote(tx_id)
    
    pawns = _get_joined_transactions("PAWN", TRANSACTION_PAWN)
    for item in pawns:
        if item["transaction_id"] == decoded_tx_id:
            return [item]
            
    raise HTTPException(status_code=404, detail="ไม่พบข้อมูลตั๋วใบนี้")

@app.get('/api/pawn-transactions')
def get_pawn_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return _get_joined_transactions("PAWN", TRANSACTION_PAWN)

@app.post('/api/pawn-transactions')
def add_pawn_transaction(payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถเพิ่มข้อมูลจำนำได้ในโหมดนี้"
    )

@app.put('/api/pawn-transactions/{transaction_id}')
def update_pawn_transaction(transaction_id: str, payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถแก้ไขข้อมูลจำนำได้ในโหมดนี้"
    )

# --- INSTALLMENT ENDPOINTS ---
@app.get('/api/installment-transactions/{tx_id}')
def get_single_transaction(tx_id: str, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    decoded_tx_id = urllib.parse.unquote(tx_id)
    
    installments = _get_joined_transactions("INSTALLMENT", TRANSACTION_INSTALLMENT)
    for item in installments:
        if item["transaction_id"] == decoded_tx_id:
            return item
            
    raise HTTPException(status_code=404, detail="ไม่พบข้อมูลสัญญาผ่อนนี้")

@app.get('/api/installment-transactions')
def get_installment_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    installments = _get_joined_transactions("INSTALLMENT", TRANSACTION_INSTALLMENT)
    return [item for item in installments if item.get("current_status") != "VOID"]

@app.post('/api/installment-transactions')
def create_installment_transactions(data: InstallmentTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถสร้างสัญญาผ่อนชำระได้ในโหมดนี้"
    )

@app.put('/api/installment-transactions/{tx_id}')
def update_installment_payment(tx_id: str, payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถบันทึกค่างวดได้ในโหมดนี้"
    )

@app.post('/api/installment-transactions/{tx_id}/void')
def void_entire_contract(tx_id: str, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถยกเลิกสัญญาได้ในโหมดนี้"
    )

@app.post('/api/installment-transactions/{tx_id}/payoff')
def payoff_entire_contract(tx_id: str, payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถปิดยอดสัญญาก่อนกำหนดได้ในโหมดนี้"
    )

# --- DEPOSIT ENDPOINTS ---
@app.get('/api/deposit-transactions')
def get_deposit_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return _get_joined_transactions("DEPOSIT", TRANSACTION_DEPOSIT)

@app.post('/api/deposit-transactions')
def add_deposit_transaction(data: DepositTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถบันทึกข้อมูลมัดจำได้ในโหมดนี้"
    )

@app.put('/api/deposit-transactions/{transaction_id}')
def update_deposit_transaction(transaction_id: str, data: DepositTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถอัปเดตข้อมูลมัดจำได้ในโหมดนี้"
    )

# --- REPAIR ENDPOINTS ---
@app.get('/api/repair-transactions')
def get_repair_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return _get_joined_transactions("REPAIR", TRANSACTION_REPAIR)

@app.post('/api/repair-transactions')
def add_repair_transaction(data: RepairTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถบันทึกงานซ่อมได้ในโหมดนี้"
    )

@app.put('/api/repair-transactions/{transaction_id}')
def update_repair_transaction(transaction_id: str, data: RepairTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถอัปเดตงานซ่อมได้ในโหมดนี้"
    )

# --- TRACKING ENDPOINTS ---
@app.get('/api/tracking-transactions')
def get_tracking_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    
    results = []
    for master in TRANSACTION_MASTER:
        tx_id = master.get("transaction_id")
        
        if tx_id in TRANSACTION_TRACKING_MAP:
            item = dict(master)
            item["thailand_post_view"] = [TRANSACTION_TRACKING_MAP[tx_id]]
            results.append(item)
        
    return results

@app.post('/api/tracking-transactions')
def add_tracking_transaction(payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถบันทึกข้อมูลพัสดุได้ในโหมดนี้"
    )

@app.put('/api/tracking-transactions/{transaction_id}')
def update_tracking_transaction(transaction_id: str, payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถอัปเดตพัสดุได้ในโหมดนี้"
    )

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "index:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
