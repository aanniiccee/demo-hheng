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
# 1. MOCK DATA (จำลองข้อมูลในหน่วยความจำ)
# ==============================================================================

# ==============================================================================
# 1. PAWN (ระบบต่อดอก)
# ==============================================================================
MOCK_PAWN_DATA = [
    {
        "transaction_id": "PAWN-001",
        "transaction_type": "PAWN",
        "customer_name": "สุชาติ (เปิดอยู่ - เกินกำหนด)",
        "phone_number": "0811111111",
        "channel": "LINE",
        "current_status": "ACTIVE",
        "closed": "NO",
        "client_id": 1,
        "product": "iPhone 15 Pro Max",
        "transaction_pawn": {
            "interest_per_month": 500.0,
            "payment_date": None,
            "next_due_date": "2026-09-01",  # เกินกำหนด
            "input_status": "ค้างชำระ",
            "total_paid_amount": 0.0
        }
    },
    {
        "transaction_id": "PAWN-002",
        "transaction_type": "PAWN",
        "customer_name": "วิภา (เปิดอยู่ - ครบกำหนดวันนี้)",
        "phone_number": "0822222222",
        "channel": "FB",
        "current_status": "ACTIVE",
        "closed": "NO",
        "client_id": 1,
        "product": "iPad Air 5",
        "transaction_pawn": {
            "interest_per_month": 300.0,
            "payment_date": None,
            "next_due_date": "2026-09-09",  # ครบกำหนดวันนี้
            "input_status": "ถึงกำหนดชำระ",
            "total_paid_amount": 0.0
        }
    },
    {
        "transaction_id": "PAWN-003",
        "transaction_type": "PAWN",
        "customer_name": "สมชาย (เปิดอยู่ - ยังไม่ถึงกำหนด)",
        "phone_number": "0833333333",
        "channel": "LINE",
        "current_status": "ACTIVE",
        "closed": "NO",
        "client_id": 1,
        "product": "MacBook Air M2",
        "transaction_pawn": {
            "interest_per_month": 800.0,
            "payment_date": None,
            "next_due_date": "2026-09-20",  # ยังไม่ถึงกำหนด
            "input_status": "ปกติ",
            "total_paid_amount": 0.0
        }
    },
    {
        "transaction_id": "PAWN-004",
        "transaction_type": "PAWN",
        "customer_name": "นภา (ปิดแล้ว - ชำระ/ไถ่ถอนแล้ว)",
        "phone_number": "0844444444",
        "channel": "OTHER",
        "current_status": "CLOSED",
        "closed": "YES",
        "client_id": 1,
        "product": "Apple Watch S9",
        "transaction_pawn": {
            "interest_per_month": 250.0,
            "payment_date": "2026-09-09",
            "next_due_date": "2026-09-20",
            "input_status": "ไถ่ถอนแล้ว",
            "total_paid_amount": 5250.0
        }
    }
]

# ==============================================================================
# 2. INSTALLMENT (ระบบผ่อนสินค้า)
# ==============================================================================
MOCK_INSTALLMENT_DATA = [
    {
        "transaction_id": "INS-001",
        "transaction_type": "INSTALLMENT",
        "customer_name": "อนันต์ (เปิดอยู่ - เกินกำหนดชำระงวด)",
        "phone_number": "0855555555",
        "channel": "LINE",
        "current_status": "ACTIVE",
        "closed": "NO",
        "client_id": 1,
        "product": "iPhone 15 Pro 128GB",
        "transaction_installment": {
            "installment_amount": 3000.0,
            "total_periods": 10,
            "current_period": 2,
            "monthly_due_day": 1,
            "due_date": "2026-09-01",  # เกินกำหนด
            "payment_date": None,
            "total_paid_amount": 3000.0,
            "input_status": "ค้างชำระ"
        }
    },
    {
        "transaction_id": "INS-002",
        "transaction_type": "INSTALLMENT",
        "customer_name": "กนก (เปิดอยู่ - ครบกำหนดงวดวันนี้)",
        "phone_number": "0866666666",
        "channel": "FB",
        "current_status": "ACTIVE",
        "closed": "NO",
        "client_id": 1,
        "product": "Samsung Galaxy S24 Ultra",
        "transaction_installment": {
            "installment_amount": 3500.0,
            "total_periods": 12,
            "current_period": 1,
            "monthly_due_day": 9,
            "due_date": "2026-09-09",  # ครบกำหนดวันนี้
            "payment_date": None,
            "total_paid_amount": 0.0,
            "input_status": "ถึงกำหนดชำระ"
        }
    },
    {
        "transaction_id": "INS-003",
        "transaction_type": "INSTALLMENT",
        "customer_name": "พิมล (เปิดอยู่ - ยังไม่ถึงกำหนดงวดถัดไป)",
        "phone_number": "0877777777",
        "channel": "LINE",
        "current_status": "ACTIVE",
        "closed": "NO",
        "client_id": 1,
        "product": "iPad Pro M2",
        "transaction_installment": {
            "installment_amount": 2500.0,
            "total_periods": 6,
            "current_period": 3,
            "monthly_due_day": 20,
            "due_date": "2026-09-20",  # ยังไม่ถึงกำหนด
            "payment_date": None,
            "total_paid_amount": 5000.0,
            "input_status": "ปกติ"
        }
    },
    {
        "transaction_id": "INS-004",
        "transaction_type": "INSTALLMENT",
        "customer_name": "สมศักดิ์ (ปิดแล้ว - ผ่อนครบทุกงวด)",
        "phone_number": "0888888888",
        "channel": "OTHER",
        "current_status": "CLOSED",
        "closed": "YES",
        "client_id": 1,
        "product": "MacBook Pro M3",
        "transaction_installment": {
            "installment_amount": 5000.0,
            "total_periods": 10,
            "current_period": 10,
            "monthly_due_day": 1,
            "due_date": "2026-09-01",
            "payment_date": "2026-09-09",
            "total_paid_amount": 50000.0,
            "input_status": "ผ่อนชำระครบแล้ว"
        }
    }
]

# ==============================================================================
# 3. DEPOSIT (ระบบมัดจำ)
# ==============================================================================
MOCK_DEPOSIT_DATA = [
    {
        "transaction_id": "DEP-001",
        "transaction_type": "DEPOSIT",
        "customer_name": "ธนกฤต (เปิดอยู่ - เกินกำหนดนัดรับ)",
        "phone_number": "0899999999",
        "channel": "IG",
        "current_status": "ACTIVE",
        "closed": "NO",
        "client_id": 1,
        "product": "PlayStation 5 Disc Edition",
        "transaction_deposit": {
            "deposit_amount": 2000.0,
            "remaining_balance": 12000.0,
            "due_date": "2026-09-01",  # เกินกำหนด
            "payment_date": None,
            "deposit_date": "2026-08-25",
            "total_paid_amount": 2000.0,
            "input_status": "เกินกำหนดนัดรับ"
        }
    },
    {
        "transaction_id": "DEP-002",
        "transaction_type": "DEPOSIT",
        "customer_name": "วรวุฒิ (เปิดอยู่ - ครบกำหนดนัดรับวันนี้)",
        "phone_number": "0800000000",
        "channel": "LINE",
        "current_status": "ACTIVE",
        "closed": "NO",
        "client_id": 1,
        "product": "Marshall Stanmore III",
        "transaction_deposit": {
            "deposit_amount": 1000.0,
            "remaining_balance": 8900.0,
            "due_date": "2026-09-09",  # ครบกำหนดวันนี้
            "payment_date": None,
            "deposit_date": "2026-09-01",
            "total_paid_amount": 1000.0,
            "input_status": "นัดรับวันนี้"
        }
    },
    {
        "transaction_id": "DEP-003",
        "transaction_type": "DEPOSIT",
        "customer_name": "เมธา (เปิดอยู่ - ยังไม่ถึงกำหนดนัดรับ)",
        "phone_number": "0812345678",
        "channel": "FB",
        "current_status": "ACTIVE",
        "closed": "NO",
        "client_id": 1,
        "product": "Nintendo Switch OLED",
        "transaction_deposit": {
            "deposit_amount": 1500.0,
            "remaining_balance": 8500.0,
            "due_date": "2026-09-20",  # ยังไม่ถึงกำหนด
            "payment_date": None,
            "deposit_date": "2026-09-09",
            "total_paid_amount": 1500.0,
            "input_status": "รอรับสินค้า"
        }
    },
    {
        "transaction_id": "DEP-004",
        "transaction_type": "DEPOSIT",
        "customer_name": "ศิริพร (ปิดแล้ว - จ่ายครบรับของแล้ว)",
        "phone_number": "0823456789",
        "channel": "LINE",
        "current_status": "CLOSED",
        "closed": "YES",
        "client_id": 1,
        "product": "AirPods Pro 2",
        "transaction_deposit": {
            "deposit_amount": 1000.0,
            "remaining_balance": 0.0,
            "due_date": "2026-09-09",
            "payment_date": "2026-09-09",
            "deposit_date": "2026-09-01",
            "total_paid_amount": 8900.0,
            "input_status": "ชำระครบถ้วนแล้ว"
        }
    }
]

# ==============================================================================
# 4. REPAIR (ระบบงานซ่อม)
# ==============================================================================
MOCK_REPAIR_DATA = [
    {
        "transaction_id": "REP-001",
        "transaction_type": "REPAIR",
        "customer_name": "กิตติ (เปิดอยู่ - รอดำเนินการ)",
        "phone_number": "0834567890",
        "channel": "LINE",
        "current_status": "PENDING",  # รอดำเนินการ
        "closed": "NO",
        "client_id": 1,
        "product": "Notebook Asus - เปลี่ยนจอ",
        "transaction_repair": {
            "received_date": "2026-09-08",
            "repaired_date": None,
            "delivery_date": None,
            "input_status": "รอดำเนินการ"
        }
    },
    {
        "transaction_id": "REP-002",
        "transaction_type": "REPAIR",
        "customer_name": "อนุชา (เปิดอยู่ - ซ่อมเสร็จแล้ว)",
        "phone_number": "0845678901",
        "channel": "FB",
        "current_status": "REPAIRED",  # ซ่อมเสร็จแล้ว
        "closed": "NO",
        "client_id": 1,
        "product": "iPhone 13 - เปลี่ยนแบต",
        "transaction_repair": {
            "received_date": "2026-09-08",
            "repaired_date": "2026-09-09",
            "delivery_date": None,
            "input_status": "ซ่อมเสร็จแล้ว"
        }
    },
    {
        "transaction_id": "REP-003",
        "transaction_type": "REPAIR",
        "customer_name": "พรทิพย์ (ปิดแล้ว - จัดส่งแล้ว)",
        "phone_number": "0856789012",
        "channel": "LINE",
        "current_status": "DELIVERED",  # จัดส่งแล้ว
        "closed": "YES",
        "client_id": 1,
        "product": "PS5 - ล้างเครื่อง",
        "transaction_repair": {
            "received_date": "2026-09-08",
            "repaired_date": "2026-09-08",
            "delivery_date": "2026-09-09",
            "input_status": "จัดส่งแล้ว"
        }
    }
]

# ==============================================================================
# 5. TRACKING (ระบบติดตามพัสดุ)
# ==============================================================================
MOCK_TRACKING_DATA = [
    {
        "transaction_id": "TRK-001",
        "transaction_type": "TRACKING",
        "customer_name": "พัสดุรับเข้า (รับเข้า - ยังไม่รับ)",
        "phone_number": "0867890123",
        "channel": "LINE",
        "current_status": "IN_TRANSIT",
        "closed": "NO",  # ยืนยันรับแล้ว: NO
        "client_id": "1",
        "product": "กล่องพัสดุเครื่องซ่อม",
        "transaction_tracking": {
            "tracking_number": "TH1234567890",
            "direction": "INBOUND",  # ประเภทรายการ: รับเข้า
            "shipping_date": "2026-09-08",
            "expected_date": "2026-09-09",
            "thailand_post_status": "อยู่ระหว่างการขนส่ง"
        }
    },
    {
        "transaction_id": "TRK-002",
        "transaction_type": "TRACKING",
        "customer_name": "พัสดุส่งออก (ส่งออก - ยังไม่รับ)",
        "phone_number": "0878901234",
        "channel": "FB",
        "current_status": "IN_TRANSIT",
        "closed": "NO",  # ยืนยันรับแล้ว: NO
        "client_id": "1",
        "product": "กล่องพัสดุสินค้าผ่อน",
        "transaction_tracking": {
            "tracking_number": "TH0987654321",
            "direction": "OUTBOUND",  # ประเภทรายการ: ส่งออก
            "shipping_date": "2026-09-09",
            "expected_date": "2026-09-20",
            "thailand_post_status": "รับฝากเรียบร้อย"
        }
    },
    {
        "transaction_id": "TRK-003",
        "transaction_type": "TRACKING",
        "customer_name": "พัสดุจัดส่งสำเร็จ (ส่งออก - รับแล้ว)",
        "phone_number": "0889012345",
        "channel": "LINE",
        "current_status": "COMPLETED",
        "closed": "YES",  # ยืนยันรับแล้ว: YES
        "client_id": "1",
        "product": "กล่องพัสดุสินค้าคืน",
        "transaction_tracking": {
            "tracking_number": "TH1122334455",
            "direction": "OUTBOUND",  # ประเภทรายการ: ส่งออก
            "shipping_date": "2026-09-08",
            "expected_date": "2026-09-09",
            "thailand_post_status": "ผู้รับได้รับเรียบร้อยแล้ว"
        }
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
