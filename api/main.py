import datetime
import os
import re
import urllib.parse
from calendar import monthrange
from datetime import date, timedelta
from typing import Optional, List, Dict, Any

from dotenv import load_dotenv
from fastapi import Body, FastAPI, HTTPException, Request, APIRouter
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

load_dotenv()

router = APIRouter(prefix="/api")

# ==============================================================================
# 1. MOCK DATA (จำลองข้อมูลในหน่วยความจำ)
# ==============================================================================

# คำนวณวันที่อ้างอิงจากวันนี้เพื่อให้ Filter สถานะระบบ (ยังไม่ถึง/ครบกำหนด/เกินกำหนด) ทำงานได้เป๊ะเสมอ
today = date.today()
yesterday = (today - timedelta(days=5)).isoformat()  # เกินกำหนด (OVERDUE)
today_str = today.isoformat()                        # ครบกำหนดวันนี้ (DUE)
next_week = (today + timedelta(days=7)).isoformat()   # ยังไม่ถึงกำหนด (PENDING)

# ==============================================================================
# MOCK DATA ชุดครอบคลุมทุก Filter
# ==============================================================================

MOCK_PAWN_TRANSACTIONS = [
    {
        "transaction_id": "PAWN-2026-001",
        "client_id": 1,
        "transaction_type": "PAWN",
        "customer_name": "1. สุชาติ (เปิดอยู่ - เกินกำหนด)",
        "phone_number": "0811111111",
        "channel": "LINE",
        "current_status": "ACTIVE",
        "note": "ตั๋วนี้เกินกำหนดชำระแล้ว",
        "created_at": "2026-01-01T10:00:00Z",
        "products": {"product_detail": "iPhone 15 Pro Max 256GB"},
        "transaction_pawn": [
            {
                "id": "pawn-sub-001",
                "interest_per_month": 500.0,
                "payment_date": None,
                "next_due_date": yesterday,  # เกินกำหนด
                "total_paid_amount": 0.0,
                "input_status": "ค้างชำระ",
                "closed": "NO"
            }
        ]
    },
    {
        "transaction_id": "PAWN-2026-002",
        "client_id": 1,
        "transaction_type": "PAWN",
        "customer_name": "2. วิภา (เปิดอยู่ - ครบกำหนดวันนี้)",
        "phone_number": "0822222222",
        "channel": "FB",
        "current_status": "ACTIVE",
        "note": "ต้องชำระดอกเบี้ยวันนี้",
        "created_at": "2026-01-10T11:00:00Z",
        "products": {"product_detail": "iPad Air 5 M1 Wi-Fi 64GB"},
        "transaction_pawn": [
            {
                "id": "pawn-sub-002",
                "interest_per_month": 300.0,
                "payment_date": None,
                "next_due_date": today_str,  # ครบกำหนดวันนี้
                "total_paid_amount": 0.0,
                "input_status": "ถึงกำหนดชำระ",
                "closed": "NO"
            }
        ]
    },
    {
        "transaction_id": "PAWN-2026-003",
        "client_id": 1,
        "transaction_type": "PAWN",
        "customer_name": "3. สมชาย (เปิดอยู่ - ยังไม่ถึงกำหนด)",
        "phone_number": "0833333333",
        "channel": "LINE",
        "current_status": "ACTIVE",
        "note": "สถานะปกติ ชำระสัปดาห์หน้า",
        "created_at": "2026-02-01T09:30:00Z",
        "products": {"product_detail": "MacBook Air M2"},
        "transaction_pawn": [
            {
                "id": "pawn-sub-003",
                "interest_per_month": 800.0,
                "payment_date": None,
                "next_due_date": next_week,  # ยังไม่ถึงกำหนด
                "total_paid_amount": 0.0,
                "input_status": "ปกติ",
                "closed": "NO"
            }
        ]
    },
    {
        "transaction_id": "PAWN-2026-004",
        "client_id": 1,
        "transaction_type": "PAWN",
        "customer_name": "4. นภา (ปิดแล้ว - ไถ่ถอนเรียบร้อย)",
        "phone_number": "0844444444",
        "channel": "หน้าร้าน",
        "current_status": "CLOSED",
        "note": "ปิดสัญญาและไถ่ถอนของคืนแล้ว",
        "created_at": "2026-01-05T14:00:00Z",
        "products": {"product_detail": "Apple Watch Series 9"},
        "transaction_pawn": [
            {
                "id": "pawn-sub-004",
                "interest_per_month": 250.0,
                "payment_date": today_str,
                "next_due_date": next_week,
                "total_paid_amount": 5250.0,
                "input_status": "ไถ่ถอนแล้ว",
                "closed": "YES"
            }
        ]
    }
]

MOCK_INSTALLMENT_TRANSACTIONS = [
    {
        "transaction_id": "INS-2026-001",
        "client_id": 1,
        "transaction_type": "INSTALLMENT",
        "customer_name": "1. อนันต์ (ผ่อนอยู่ - เกินกำหนดชำระงวด)",
        "phone_number": "0855555555",
        "channel": "LINE",
        "current_status": "ACTIVE",
        "note": "ค้างชำระงวดล่าสุด",
        "created_at": "2026-01-01T08:00:00Z",
        "products": {"product_detail": "iPhone 15 Pro 128GB"},
        "transaction_installment": [
            {
                "id": "ins-sub-001",
                "installment_amount": 3000.0,
                "total_periods": 10,
                "current_period": 2,
                "monthly_due_day": today.day,
                "start_month": 1,
                "start_year": 2026,
                "next_due_date": yesterday,  # เกินกำหนด
                "total_paid_amount": 3000.0,
                "closed": "NO"
            }
        ]
    },
    {
        "transaction_id": "INS-2026-002",
        "client_id": 1,
        "transaction_type": "INSTALLMENT",
        "customer_name": "2. กนก (ผ่อนอยู่ - ครบกำหนดงวดวันนี้)",
        "phone_number": "0866666666",
        "channel": "FB",
        "current_status": "ACTIVE",
        "note": "ดิวชำระวันนี้",
        "created_at": "2026-01-15T10:00:00Z",
        "products": {"product_detail": "Samsung Galaxy S24 Ultra"},
        "transaction_installment": [
            {
                "id": "ins-sub-002",
                "installment_amount": 3500.0,
                "total_periods": 12,
                "current_period": 1,
                "monthly_due_day": today.day,
                "start_month": 2,
                "start_year": 2026,
                "next_due_date": today_str,  # ครบกำหนดวันนี้
                "total_paid_amount": 0.0,
                "closed": "NO"
            }
        ]
    },
    {
        "transaction_id": "INS-2026-003",
        "client_id": 1,
        "transaction_type": "INSTALLMENT",
        "customer_name": "3. พิมล (ผ่อนจบแล้ว - ปิดสัญญา)",
        "phone_number": "0877777777",
        "channel": "LINE",
        "current_status": "CLOSED",
        "note": "ผ่อนครบทุกงวดเรียบร้อย",
        "created_at": "2025-05-01T09:00:00Z",
        "products": {"product_detail": "iPad Pro M2"},
        "transaction_installment": [
            {
                "id": "ins-sub-003",
                "installment_amount": 2000.0,
                "total_periods": 6,
                "current_period": 6,
                "monthly_due_day": 1,
                "start_month": 5,
                "start_year": 2025,
                "next_due_date": yesterday,
                "total_paid_amount": 12000.0,
                "closed": "YES"
            }
        ]
    }
]

MOCK_DEPOSIT_TRANSACTIONS = [
    {
        "transaction_id": "DEP-2026-001",
        "client_id": 1,
        "transaction_type": "DEPOSIT",
        "customer_name": "1. ธนกฤต (มัดจำอยู่ - เลยวันนัดรับ)",
        "phone_number": "0888888888",
        "channel": "IG",
        "current_status": "ACTIVE",
        "note": "เลยวันนัดชำระส่วนที่เหลือ",
        "created_at": "2026-02-01T11:00:00Z",
        "products": {"product_detail": "PlayStation 5 Disc Edition"},
        "transaction_deposit": [
            {
                "id": "dep-sub-001",
                "deposit_amount": 2000.0,
                "remaining_balance": 12000.0,
                "due_date": yesterday,  # เกินกำหนด
                "closed": "NO"
            }
        ]
    },
    {
        "transaction_id": "DEP-2026-002",
        "client_id": 1,
        "transaction_type": "DEPOSIT",
        "customer_name": "2. วรวุฒิ (มัดจำอยู่ - นัดรับวันนี้)",
        "phone_number": "0899999999",
        "channel": "LINE",
        "current_status": "ACTIVE",
        "note": "นัดเข้ามารับของและจ่ายส่วนที่เหลือวันนี้",
        "created_at": "2026-02-10T15:00:00Z",
        "products": {"product_detail": "Marshall Stanmore III"},
        "transaction_deposit": [
            {
                "id": "dep-sub-002",
                "deposit_amount": 1000.0,
                "remaining_balance": 8900.0,
                "due_date": today_str,  # ครบกำหนดวันนี้
                "closed": "NO"
            }
        ]
    },
    {
        "transaction_id": "DEP-2026-003",
        "client_id": 1,
        "transaction_type": "DEPOSIT",
        "customer_name": "3. ศิริพร (ชำระครบ/รับของแล้ว - ปิดเคส)",
        "phone_number": "0800000000",
        "channel": "FB",
        "current_status": "CLOSED",
        "note": "รับสินค้าและจ่ายยอดครบแล้ว",
        "created_at": "2026-02-15T16:30:00Z",
        "products": {"product_detail": "AirPods Pro 2"},
        "transaction_deposit": [
            {
                "id": "dep-sub-003",
                "deposit_amount": 1000.0,
                "remaining_balance": 0.0,
                "due_date": today_str,
                "closed": "YES"
            }
        ]
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
