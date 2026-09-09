import datetime
import os
import re
import urllib.parse
from calendar import monthrange
from datetime import date
from typing import Optional, List, Dict, Any

from dotenv import load_dotenv
from fastapi import Body, FastAPI, HTTPException, Request, APIRouter
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

load_dotenv()

router = APIRouter(prefix="/api")

# ==============================================================================
# 1. TRANSACTION MASTER
# ==============================================================================
TRANSACTION_MASTER = [
    {
        "transaction_id": "DP_1_1",
        "transaction_type": "DEPOSIT",
        "product_id": None,
        "customer_name": "test-deposit",
        "phone_number": "03498714153",
        "channel": "FB",
        "current_status": "ชำระครบแล้ว",
        "closed": "YES",
        "note": "[ระบบ] รับชำระส่วนที่เหลือเรียบร้อย ปิดเคสทันที. ",
        "client_id": 1,
        "created_at": "2026-07-17 07:32:19.48177+00",
        "updated_at": "2026-07-17 07:43:26.62551+00",
        "product": "test-deposit",
        "created_by_line_id": "U0adb39a4d6d1ef2383a5087d759e7658",
        "created_by_name": "吉拉万Lee JC",
        "updated_by_line_id": "U0adb39a4d6d1ef2383a5087d759e7658",
        "updated_by_name": "吉拉万Lee JC",
        "chat_link": None
    },
    {
        "transaction_id": "DP_1_2",
        "transaction_type": "DEPOSIT",
        "product_id": None,
        "customer_name": "Test1",
        "phone_number": "0835447001",
        "channel": "LINE",
        "current_status": "ชำระครบแล้ว",
        "closed": "YES",
        "note": "[ระบบ] รับชำระส่วนที่เหลือเรียบร้อย ปิดเคสทันที. ",
        "client_id": 1,
        "created_at": "2026-07-20 05:51:01.807821+00",
        "updated_at": "2026-07-20 07:09:43.836039+00",
        "product": "RD26_0001",
        "created_by_line_id": "U575e54c9469b11259d6ef10c73dcb08b",
        "created_by_name": "ITIM ʕᵔᴥᵔʔ",
        "updated_by_line_id": "U575e54c9469b11259d6ef10c73dcb08b",
        "updated_by_name": "ITIM ʕᵔᴥᵔʔ",
        "chat_link": None
    },
    {
        "transaction_id": "IS_1_1_1",
        "transaction_type": "INSTALLMENT",
        "product_id": None,
        "customer_name": "Line P'Lyn",
        "phone_number": "0899999991",
        "channel": "LINE",
        "current_status": "ยังไม่ถึงกำหนด",
        "closed": "NO",
        "note": "[ระบบ] สร้างงวดที่ 1/3. ",
        "client_id": 1,
        "created_at": "2026-06-24 07:05:46.223269+00",
        "updated_at": "2026-06-24 07:05:46.223269+00",
        "product": "AB-0000",
        "created_by_line_id": "Ubae171fb51a7d2694048ed32130f244c",
        "created_by_name": "吉拉万Lee JC",
        "updated_by_line_id": "Unknown",
        "updated_by_name": "Unknown",
        "chat_link": "https://chat.line.biz/Ub610b6c9a9f51933f72faad2bf35274e/chat/U9cc65aea0ec82ee36ff2c727e9d4f60b"
    },
    {
        "transaction_id": "IS_1_2_1",
        "transaction_type": "INSTALLMENT",
        "product_id": None,
        "customer_name": "ทดสอบ",
        "phone_number": "0899999990",
        "channel": "LINE",
        "current_status": "VOID",
        "closed": "YES",
        "note": "[ระบบ] สัญญานี้ถูกยกเลิก (Voided)",
        "client_id": 1,
        "created_at": "2026-06-26 04:19:57.37935+00",
        "updated_at": "2026-06-26 04:20:47.40644+00",
        "product": "AB-1234",
        "created_by_line_id": "Ubae171fb51a7d2694048ed32130f244c",
        "created_by_name": "吉拉万Lee JC",
        "updated_by_line_id": "Unknown",
        "updated_by_name": "Unknown",
        "chat_link": ""
    },
    {
        "transaction_id": "PW_1_1_1",
        "transaction_type": "PAWN",
        "product_id": None,
        "customer_name": "FB Nice",
        "phone_number": "0899999999",
        "channel": "FB",
        "current_status": "PENDING",
        "closed": "NO",
        "note": "",
        "client_id": 1,
        "created_at": "2026-06-24 07:03:37.050306+00",
        "updated_at": "2026-06-24 07:03:37.050306+00",
        "product": "AB-1234",
        "created_by_line_id": "Ubae171fb51a7d2694048ed32130f244c",
        "created_by_name": "吉拉万Lee JC",
        "updated_by_line_id": "Unknown",
        "updated_by_name": "Unknown",
        "chat_link": "https://business.facebook.com/latest/inbox/all/?business_id=1944906108911797&asset_id=760351943826166&mailbox_id=760351943826166&selected_item_id=100011870872833&thread_type=FB_MESSAGE"
    },
    {
        "transaction_id": "PW_1_3_1",
        "transaction_type": "PAWN",
        "product_id": None,
        "customer_name": "ทดสอบ",
        "phone_number": "0899999991",
        "channel": "FB",
        "current_status": "ชำระแล้ว",
        "closed": "YES",
        "note": "[ระบบ] ปิดสัญญา [ระบบ] ปิดสัญญา ",
        "client_id": 1,
        "created_at": "2026-06-26 03:12:46.556952+00",
        "updated_at": "2026-06-26 04:15:48.394839+00",
        "product": "AB-0000",
        "created_by_line_id": "Ubae171fb51a7d2694048ed32130f244c",
        "created_by_name": "吉拉万Lee JC",
        "updated_by_line_id": "Ubae171fb51a7d2694048ed32130f244c",
        "updated_by_name": "吉拉万Lee JC",
        "chat_link": "https://business.facebook.com/latest/inbox/all/?business_id=1944906108911797&asset_id=760351943826166&mailbox_id=760351943826166&selected_item_id=100011870872833&thread_type=FB_MESSAGE"
    },
    {
        "transaction_id": "RP_1_1",
        "transaction_type": "REPAIR",
        "product_id": None,
        "customer_name": "Nice",
        "phone_number": "04527382423",
        "channel": "FB",
        "current_status": "ปิดเคสแล้ว",
        "closed": "YES",
        "note": "[ระบบ] ส่งมอบสินค้าและปิดเคสเรียบร้อย. ",
        "client_id": 1,
        "created_at": "2026-07-20 01:32:19.797846+00",
        "updated_at": "2026-07-20 02:32:32.076507+00",
        "product": "test-repair",
        "created_by_line_id": "U0adb39a4d6d1ef2383a5087d759e7658",
        "created_by_name": "吉拉万Lee JC",
        "updated_by_line_id": "U0adb39a4d6d1ef2383a5087d759e7658",
        "updated_by_name": "吉拉万Lee JC",
        "chat_link": None
    },
    {
        "transaction_id": "TK_1_1",
        "transaction_type": "TRACKING",
        "product_id": None,
        "customer_name": "test",
        "phone_number": "03421082401",
        "channel": "LINE",
        "current_status": "PENDING",
        "closed": "NO",
        "note": "",
        "client_id": 1,
        "created_at": "2026-07-20 05:50:01.822708+00",
        "updated_at": "2026-07-20 05:56:14.839041+00",
        "product": "test-tracking",
        "created_by_line_id": "U0adb39a4d6d1ef2383a5087d759e7658",
        "created_by_name": "吉拉万Lee JC",
        "updated_by_line_id": "U0adb39a4d6d1ef2383a5087d759e7658",
        "updated_by_name": "吉拉万Lee JC",
        "chat_link": None
    }
]

# ==============================================================================
# 2. TRANSACTION DEPOSIT
# ==============================================================================
TRANSACTION_DEPOSIT = [
    {
        "transaction_id": "DP_1_1",
        "deposit_amount": "4000.00",
        "remaining_balance": "10000.00",
        "due_date": "2026-07-17",
        "payment_date": "2026-07-17",
        "client_id": 1,
        "input_status": "",
        "created_at": "2026-07-17 07:32:20.304568+00",
        "updated_at": "2026-07-17 07:43:27.381134+00",
        "deposit_date": "2026-07-01",
        "total_paid_amount": "10000.00"
    },
    {
        "transaction_id": "DP_1_2",
        "deposit_amount": "10000.00",
        "remaining_balance": "60000.00",
        "due_date": "2026-07-31",
        "payment_date": "2026-07-20",
        "client_id": 1,
        "input_status": "",
        "created_at": "2026-07-20 05:51:02.579744+00",
        "updated_at": "2026-07-20 07:09:44.6394+00",
        "deposit_date": "2026-07-20",
        "total_paid_amount": "60000.00"
    }
]

# ==============================================================================
# 3. TRANSACTION INSTALLMENT
# ==============================================================================
TRANSACTION_INSTALLMENT = [
    {
        "transaction_id": "IS_1_1_1",
        "installment_amount": "2000.00",
        "total_periods": 3,
        "current_period": 1,
        "monthly_due_day": 22,
        "payment_date": None,
        "total_paid_amount": 0,
        "due_date": "2026-06-22",
        "input_status": "",
        "client_id": 1,
        "created_at": "2026-06-24 07:05:46.493584+00",
        "updated_at": "2026-06-24 07:05:46.493584+00"
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
        "input_status": "",
        "client_id": 1,
        "created_at": "2026-06-26 04:19:57.686225+00",
        "updated_at": "2026-06-26 04:19:57.686225+00"
    }
]

# ==============================================================================
# 4. TRANSACTION PAWN
# ==============================================================================
TRANSACTION_PAWN = [
    {
        "transaction_id": "PW_1_1_1",
        "interest_per_month": "4000.00",
        "payment_date": None,
        "next_due_date": "2026-06-21",
        "input_status": "",
        "client_id": 1,
        "total_paid_amount": 0,
        "created_at": "2026-07-17 03:16:03.514291+00",
        "updated_at": "2026-07-17 03:16:03.514291+00"
    },
    {
        "transaction_id": "PW_1_3_1",
        "interest_per_month": "4000.00",
        "payment_date": "2026-06-26",
        "next_due_date": "2026-06-26",
        "input_status": "",
        "client_id": 1,
        "total_paid_amount": 4000,
        "created_at": "2026-07-17 03:16:03.514291+00",
        "updated_at": "2026-07-17 03:16:03.514291+00"
    }
]

# ==============================================================================
# 5. TRANSACTION REPAIR
# ==============================================================================
TRANSACTION_REPAIR = [
    {
        "transaction_id": "RP_1_1",
        "received_date": "2026-07-16",
        "repaired_date": "2026-07-19",
        "delivery_date": "2026-07-20",
        "input_status": "ซ่อมเสร็จแล้ว",
        "client_id": 1,
        "created_at": "2026-07-20 01:32:20.57407+00",
        "updated_at": "2026-07-20 02:32:32.867394+00"
    }
]

# ==============================================================================
# 6. TRANSACTION TRACKING
# ==============================================================================
TRANSACTION_TRACKING = [
    {
        "transaction_id": "TK_1_1",
        "tracking_number": "ED087224551TH",
        "direction": "INBOUND",
        "shipping_date": "2026-07-15",
        "expected_date": "2026-07-20",
        "thailand_post_status": "รอดำเนินการเข้ารับ",
        "client_id": "1",
        "created_at": "2026-07-20 05:50:02.096949+00",
        "updated_at": "2026-07-20 05:56:15.099386+00"
    }
]

# ==============================================================================
# 2. TOKEN VALIDATION (ใช้ค่าจาก ENV โดยไม่ต้องใช้ Database)
# ==============================================================================

def validate_token(
    token: Optional[str] = None, admin_line_id: Optional[str] = None
):
    target_token = token
    if (
        not target_token
        or target_token.strip() == ""
        or target_token == "undefined"
        or target_token == "null"
    ):
        target_token = os.getenv("CLIENT_ACCESS_TOKEN", "")

    if not target_token:
        raise HTTPException(
            401,
            "Missing token. Please configure CLIENT_ACCESS_TOKEN in Vercel.",
        )

    # เช็คว่า Token ตรงกับค่าที่ตั้งไว้ใน ENV หรือไม่
    expected_token = os.getenv("CLIENT_ACCESS_TOKEN", "default-demo-token")
    if target_token != expected_token:
        raise HTTPException(401, "Invalid token")

    allowed_admins_raw = os.getenv("ALLOWED_ADMINS", "")

    # หากไม่ได้จำกัดแอดมิน ให้ผ่านได้เลย
    if not allowed_admins_raw or allowed_admins_raw.strip() == "":
        return {"client_id": 1, "client_name": "Demo Client"}

    # เช็คสิทธิ์แอดมิน LINE User ID
    allowed_admins = [
        x.strip() for x in allowed_admins_raw.split(",") if x.strip()
    ]

    if not admin_line_id or admin_line_id not in allowed_admins:
        raise HTTPException(403, "Unauthorized LINE User ID")

    return {"client_id": 1, "client_name": "Demo Client"}

# ==============================================================================
# 3. PYDANTIC SCHEMAS
# ==============================================================================

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

@router.get("/config/liff-id")
def get_liff_config():
    liff_id = os.environ.get("LIFF_ID")
    if not liff_id:
        raise HTTPException(
            status_code=500,
            detail="ระบบยังไม่ได้ตั้งค่า LIFF_ID ใน Environment Variables",
        )
    return {"liff_id": liff_id}

# --- PAWN ENDPOINTS ---
@router.get('/pawn-transactions/{tx_id}')
def get_single_pawn_transaction(tx_id: str, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    decoded_tx_id = urllib.parse.unquote(tx_id)
    
    for item in MOCK_PAWN_TRANSACTIONS:
        if item["transaction_id"] == decoded_tx_id:
            return [item]
            
    raise HTTPException(status_code=404, detail="ไม่พบข้อมูลตั๋วใบนี้")

@router.get('/pawn-transactions')
def get_pawn_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return MOCK_PAWN_TRANSACTIONS

@router.post('/pawn-transactions')
def add_pawn_transaction(payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถเพิ่มข้อมูลจำนำได้ในโหมดนี้"
    )

@router.put('/pawn-transactions/{transaction_id}')
def update_pawn_transaction(transaction_id: str, payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถแก้ไขข้อมูลจำนำได้ในโหมดนี้"
    )

# --- INSTALLMENT ENDPOINTS ---
@router.get('/installment-transactions/{tx_id}')
def get_single_transaction(tx_id: str, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    decoded_tx_id = urllib.parse.unquote(tx_id)
    
    for item in MOCK_INSTALLMENT_TRANSACTIONS:
        if item["transaction_id"] == decoded_tx_id:
            return item
            
    raise HTTPException(status_code=404, detail="ไม่พบข้อมูลสัญญาผ่อนนี้")

@router.get('/installment-transactions')
def get_installment_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return MOCK_INSTALLMENT_TRANSACTIONS

@router.post('/installment-transactions')
def create_installment_transactions(data: InstallmentTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถสร้างสัญญาผ่อนชำระได้ในโหมดนี้"
    )

@router.put('/installment-transactions/{tx_id}')
def update_installment_payment(tx_id: str, payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถบันทึกค่างวดได้ในโหมดนี้"
    )

@router.post('/installment-transactions/{tx_id}/void')
def void_entire_contract(tx_id: str, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถยกเลิกสัญญาได้ในโหมดนี้"
    )

@router.post('/installment-transactions/{tx_id}/payoff')
def payoff_entire_contract(tx_id: str, payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถปิดยอดสัญญาก่อนกำหนดได้ในโหมดนี้"
    )

# --- DEPOSIT ENDPOINTS ---
@router.get('/deposit-transactions')
def get_deposit_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return MOCK_DEPOSIT_TRANSACTIONS

@router.post('/deposit-transactions')
def add_deposit_transaction(data: DepositTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถบันทึกข้อมูลมัดจำได้ในโหมดนี้"
    )

@router.put('/deposit-transactions/{transaction_id}')
def update_deposit_transaction(transaction_id: str, data: DepositTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถอัปเดตข้อมูลมัดจำได้ในโหมดนี้"
    )

# --- REPAIR ENDPOINTS ---
@router.get('/repair-transactions')
def get_repair_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return MOCK_REPAIR_TRANSACTIONS

@router.post('/repair-transactions')
def add_repair_transaction(data: RepairTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถบันทึกงานซ่อมได้ในโหมดนี้"
    )

@router.put('/repair-transactions/{transaction_id}')
def update_repair_transaction(transaction_id: str, data: RepairTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถอัปเดตงานซ่อมได้ในโหมดนี้"
    )

# --- TRACKING ENDPOINTS ---
@router.get('/tracking-transactions')
def get_tracking_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return MOCK_TRACKING_TRANSACTIONS

@router.post('/tracking-transactions')
def add_tracking_transaction(data: TrackingTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถบันทึกข้อมูลพัสดุได้ในโหมดนี้"
    )

@router.put('/tracking-transactions/{transaction_id}')
def update_tracking_transaction(transaction_id: str, data: TrackingTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถอัปเดตพัสดุได้ในโหมดนี้"
    )

# ==============================================================================
# 5. INITIALIZE FASTAPI APP
# ==============================================================================

app = FastAPI()
app.include_router(router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "index:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
