import datetime
import os
import re
import urllib.parse
from calendar import monthrange
from datetime import date
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from supabase import create_client

load_dotenv()

app = FastAPI()


SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

sb = (
    create_client(SUPABASE_URL, SUPABASE_KEY)
    if SUPABASE_URL and SUPABASE_KEY
    else None
)


def validate_token(
    token: Optional[str] = None, admin_line_id: Optional[str] = None
):
    if not sb:
        return {"client_id": 1}

    # 1. ดึงค่า Token จาก Env (กรณีหน้าบ้านไม่ได้ส่งมาใน URL)
    target_token = token
    if (
        not target_token
        or target_token.strip() == ""
        or target_token == "undefined"
        or target_token == "null"
    ):
        target_token = os.getenv("CLIENT_ACCESS_TOKEN", "")

    # ถ้าไม่มี Token เลย ดีดออกเป็น 401 Unauthorized
    if not target_token:
        raise HTTPException(
            401,
            "Missing token. Please configure CLIENT_ACCESS_TOKEN in Vercel.",
        )

    print("========== VALIDATE ==========")
    print("target_token:", repr(target_token))
    print("admin_line_id:", repr(admin_line_id))
    print("allowed_admins_raw:", repr(os.getenv("ALLOWED_ADMINS")))

    # 2. ค้นหาข้อมูล Client ใน Supabase
    r = (
        sb.table("clients")
        .select("*")
        .eq("access_token", target_token)
        .limit(1)
        .execute()
    )

    if not r.data:
        raise HTTPException(401, "Invalid token")

    allowed_admins_raw = os.getenv("ALLOWED_ADMINS", "")

    # ถ้าใน Env ไม่มีการตั้งค่ารายชื่อแอดมิน (ปล่อยระบบโล่ง) ให้ผ่านได้เลย
    if not allowed_admins_raw or allowed_admins_raw.strip() == "":
        return r.data[0]

    # 🔒 เช็คสิทธิ์แอดมิน
    allowed_admins = [
        x.strip() for x in allowed_admins_raw.split(",") if x.strip()
    ]

    # ถ้าไม่มี Line ID ส่งมา หรือไม่มีสิทธิ์ในระบบ โยน 403 บล็อคทันที
    if not admin_line_id or admin_line_id not in allowed_admins:
        raise HTTPException(403, "Unauthorized LINE User ID")

    return r.data[0]


@app.get("/api/config/liff-id")
def get_liff_config():
    liff_id = os.environ.get("LIFF_ID")
    if not liff_id:
        raise HTTPException(
            status_code=500,
            detail="ระบบยังไม่ได้ตั้งค่า LIFF_ID ใน Environment Variables",
        )
    return {"liff_id": liff_id}

# --- Schema สำหรับรับข้อมูลขาเข้าจากฟอร์มหน้าบ้าน ---
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

@app.get('/api/pawn-transactions/{tx_id}')
def get_single_pawn_transaction(tx_id: str, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    c = validate_token(token, admin_line_id)
    if not sb: 
        raise HTTPException(status_code=500, detail="Supabase client not initialized")
        
    decoded_tx_id = urllib.parse.unquote(tx_id)
        
    r = sb.table('transaction_master')\
        .select('*, transaction_pawn(*), products(product_detail)')\
        .eq('transaction_id', decoded_tx_id)\
        .eq('client_id', c['client_id'])\
        .execute()
        
    if not r.data:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลตั๋วใบนี้")
        
    return r.data

@app.get('/api/pawn-transactions')
def get_pawn_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    c = validate_token(token, admin_line_id)
    if not sb: return []

    # 🌟 ปรับปรุง: ดึงคอลัมน์ 'product' ออกมาจากตารางหลักเพื่อส่งให้ตารางหน้าบ้านไป Render
    r = sb.table('transaction_master')\
        .select('*, transaction_pawn(*), products(product_detail)')\
        .eq('transaction_type', 'PAWN')\
        .eq('client_id', c['client_id'])\
        .execute()
    return r.data
    
# -------------------------------------------------------------
# 1. สร้างรายการจำนำ (POST) -> Mock
# -------------------------------------------------------------
@app.post('/api/pawn-transactions')
def add_pawn_transaction(payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return {
        "success": True, 
        "transaction_id": "PW_DEMO_9999_1",
        "message": "[Demo Mode] บันทึกข้อมูลจำนำสำเร็จ"
    }

# -------------------------------------------------------------
# 2. แก้ไข / ต่อดอก / ปิดสัญญาจำนำ (PUT) -> Mock
# -------------------------------------------------------------
@app.put('/api/pawn-transactions/{transaction_id}')
def update_pawn_transaction(transaction_id: str, payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return {
        "success": True,
        "message": "[Demo Mode] อัปเดตข้อมูลจำนำสำเร็จ"
    }

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

def calculate_next_due_date(start_year, start_month, due_day, period_index):
    total_months = (start_month - 1) + period_index
    target_year = start_year + (total_months // 12)
    target_month = (total_months % 12) + 1
    _, last_day_of_month = monthrange(target_year, target_month)
    actual_day = min(due_day, last_day_of_month)
    return date(target_year, target_month, actual_day).isoformat()

@app.get('/api/installment-transactions/{tx_id}')
def get_single_transaction(tx_id: str, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    c = validate_token(token, admin_line_id)
    r = sb.table('transaction_master')\
        .select('*, transaction_installment(*), products(product_detail)')\
        .eq('transaction_id', tx_id)\
        .eq('client_id', c['client_id'])\
        .single()\
        .execute()
    return r.data

@app.get('/api/installment-transactions')
def get_installment_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    c = validate_token(token, admin_line_id)
    if not sb: return []

    # ดึงข้อมูลมาสเตอร์ ซ่อนรายการที่เป็น VOID และเรียงจากล่าสุด
    r = sb.table('transaction_master')\
        .select('*, transaction_installment(*), products(product_detail)')\
        .eq('transaction_type', 'INSTALLMENT')\
        .neq('current_status', 'VOID')\
        .eq('client_id', c['client_id'])\
        .execute()
    return r.data
    
# -------------------------------------------------------------
# 1. สร้างสัญญาผ่อนชำระ (POST) -> Mock
# -------------------------------------------------------------
@app.post('/api/installment-transactions')
def create_installment_transactions(data: InstallmentTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    # Mock Response สั่งสำเร็จหลอกๆ ตามจำนวนงวดที่ส่งมา
    return {
        "success": True, 
        "created_count": data.total_periods,
        "message": "[Demo Mode] บันทึกข้อมูลจำลองสำเร็จ"
    }

# -------------------------------------------------------------
# 2. บันทึกรับชำระเงินรายงวด (PUT) -> Mock
# -------------------------------------------------------------
@app.put('/api/installment-transactions/{tx_id}')
def update_installment_payment(tx_id: str, payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    # Mock Response ตอบกลับโครงสร้างเดิม
    return {
        "success": True, 
        "message": "[Demo Mode] บันทึกค่างวดสำเร็จ", 
        "contract_closed": "NO"
    }

# -------------------------------------------------------------
# 3. ยกเลิกสัญญาทั้งชุด (POST /void) -> Mock
# -------------------------------------------------------------
@app.post('/api/installment-transactions/{tx_id}/void')
def void_entire_contract(tx_id: str, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return {
        "success": True, 
        "message": "[Demo Mode] ยกเลิกสัญญาทั้งชุดเรียบร้อยแล้ว"
    }

# -------------------------------------------------------------
# 4. ปิดยอดสัญญาก่อนกำหนด (POST /payoff) -> Mock
# -------------------------------------------------------------
@app.post('/api/installment-transactions/{tx_id}/payoff')
def payoff_entire_contract(tx_id: str, payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return {
        "success": True, 
        "message": "[Demo Mode] บันทึกยอดปิดสัญญาก่อนกำหนดสำเร็จเรียบร้อย"
    }


# API มัดจำ
class DepositTransactionIn(BaseModel):
    product: Optional[str] = ''             # รายละเอียดสินค้าที่มัดจำ
    product_id: Optional[str] = ''          
    customer_name: str
    phone_number: Optional[str] = ''
    channel: str                            # ช่องทางที่ลูกค้าติดต่อมา
    deposit_amount: float = 0.0                  # 💰 ยอดเงินมัดจำก้อนแรก
    deposit_date: Optional[str] = None
    remaining_balance: float = 0.0                # 💵 ยอดคงเหลือที่ต้องชำระเพิ่ม
    due_date: Optional[str] = None                           # 📅 วันนัดชำระส่วนที่เหลือ
    total_paid_amount: Optional[float] = 0.0
    payment_date: Optional[str] = None      # วันที่มาชำระยอดที่เหลือ (ถ้าจ่ายแล้วค่อยส่งมา)
    closed: str = 'NO'                      # YES หรือ NO
    note: Optional[str] = ''
    created_by_line_id: Optional[str] = 'Unknown'
    created_by_name: Optional[str] = 'Unknown'
    chat_link: Optional[str] = None
    input_status: Optional[str] = ''        # 🆕 เพิ่มฟิลด์รับสถานะมัดจำจากหน้าบ้าน

@app.get('/api/deposit-transactions')
def get_deposit_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    c = validate_token(token, admin_line_id)
    if not sb: return []

    r = sb.table('transaction_master')\
        .select('*, transaction_deposit(*)')\
        .eq('transaction_type', 'DEPOSIT')\
        .eq('client_id', c['client_id'])\
        .execute()
    return r.data

# -------------------------------------------------------------
# 1. สร้างรายการออม/มัดจำ (POST) -> Mock
# -------------------------------------------------------------
@app.post('/api/deposit-transactions')
def add_deposit_transaction(data: DepositTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return {
        "success": True, 
        "transaction_id": "DP_DEMO_9999",
        "message": "[Demo Mode] บันทึกข้อมูลมัดจำสำเร็จ"
    }

# -------------------------------------------------------------
# 2. แก้ไข / รับชำระ / ปิดเคสมัดจำ (PUT) -> Mock
# -------------------------------------------------------------
@app.put('/api/deposit-transactions/{transaction_id}')
def update_deposit_transaction(transaction_id: str, data: DepositTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return {
        "success": True,
        "message": "[Demo Mode] อัปเดตข้อมูลมัดจำสำเร็จ"
    }

# API งานซ่อม
class RepairTransactionIn(BaseModel):
    product: Optional[str] = ''             # รหัสสินค้า / อาการซ่อม
    product_id: Optional[str] = ''          
    customer_name: str                      # ชื่อลูกค้า
    phone_number: Optional[str] = ''        # เบอร์โทรศัพท์
    channel: str                            # ช่องทางติดต่อ (LINE, FB, IG, etc.)
    
    # 📅 ฟิลด์วันที่สำหรับงานซ่อม (ไม่มีเรื่องเงิน)
    received_date: Optional[str] = None     # วันที่รับสินค้า
    repaired_date: Optional[str] = None     # วันที่ซ่อมเสร็จ
    delivery_date: Optional[str] = None     # วันจัดส่ง/วันนัดรับของ
    
    closed: str = 'NO'                      # YES หรือ NO (ปิดเคสแล้ว)
    note: Optional[str] = ''                # หมายเหตุ
    input_status: Optional[str] = ''        # สถานะงานซ่อมจากแอดมิน (เช่น รออะไหล่, กำลังซ่อม)
    
    created_by_line_id: Optional[str] = 'Unknown'
    created_by_name: Optional[str] = 'Unknown'
    chat_link: Optional[str] = None

@app.get('/api/repair-transactions')
def get_repair_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    c = validate_token(token, admin_line_id)
    if not sb: return []

    # ดึงข้อมูลจากตารางหลัก โดยเชื่อมกับตารางย่อย transaction_repair
    r = sb.table('transaction_master')\
        .select('*, transaction_repair(*)')\
        .eq('transaction_type', 'REPAIR')\
        .eq('client_id', c['client_id'])\
        .execute()
    return r.data


# -------------------------------------------------------------
# 1. สร้างรายการงานซ่อม (POST) -> Mock
# -------------------------------------------------------------
@app.post('/api/repair-transactions')
def add_repair_transaction(data: RepairTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return {
        "success": True, 
        "transaction_id": "RP_DEMO_9999",
        "message": "[Demo Mode] บันทึกข้อมูลงานซ่อมสำเร็จ"
    }

# -------------------------------------------------------------
# 2. แก้ไข / อัปเดตสถานะ / ปิดเคสงานซ่อม (PUT) -> Mock
# -------------------------------------------------------------
@app.put('/api/repair-transactions/{transaction_id}')
def update_repair_transaction(transaction_id: str, data: RepairTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return {
        "success": True,
        "message": "[Demo Mode] อัปเดตข้อมูลงานซ่อมสำเร็จ"
    }

# API Tracking
# --- 1. Pydantic Schema สำหรับข้อมูลพัสดุขาเข้า ---
class TrackingTransactionIn(BaseModel):
    product: Optional[str] = ''              # รายละเอียดสินค้า / รหัสสินค้า
    customer_name: str                       # ชื่อลูกค้า
    phone_number: Optional[str] = ''         # เบอร์โทรศัพท์
    channel: str                             # ช่องทางติดต่อ (LINE, FB, IG, etc.)
    chat_link: Optional[str] = None          # ลิงก์แชทลูกค้า
    tracking_number: str                     # เลขพัสดุไปรษณีย์ไทย
    is_delivered: str = 'NO'                 # ยืนยันรับแล้ว (YES หรือ NO)
    note: Optional[str] = ''                 # หมายเหตุ
    
    # 📦 ฟิลด์เฉพาะของระบบติดตามพัสดุ (ส่งต่อไปยังตารางย่อย)
    direction: str = 'INBOUND'               # INBOUND หรือ OUTBOUND
    shipping_date: Optional[str] = None      # วันที่จัดส่ง (YYYY-MM-DD)
    expected_date: Optional[str] = None      # วันที่คาดว่าจะได้รับ (YYYY-MM-DD)
    
    created_by_line_id: Optional[str] = 'Unknown'
    created_by_name: Optional[str] = 'Unknown'


# --- 2. GET: ดึงข้อมูลรายการติดตามพัสดุทั้งหมด ---
@app.get('/api/tracking-transactions')
def get_tracking_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    c = validate_token(token, admin_line_id)
    if not sb: return []

    # แก้ไข: ลบเว้นวรรคหลัง comma ออกทั้งหมดเพื่อให้เซิร์ฟเวอร์อ่านได้ถูกต้อง
    r = sb.table('transaction_master')\
        .select('*,thailand_post_view(*)')\
        .eq('transaction_type', 'TRACKING')\
        .eq('client_id', c['client_id'])\
        .order('created_at', desc=True)\
        .execute()
        
    return r.data

# -------------------------------------------------------------
# 1. สร้างรายการติดตามพัสดุ (POST) -> Mock
# -------------------------------------------------------------
@app.post('/api/tracking-transactions')
def add_tracking_transaction(data: TrackingTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return {
        "success": True, 
        "transaction_id": "TK_DEMO_9999",
        "message": "[Demo Mode] บันทึกข้อมูลพัสดุสำเร็จ"
    }

# -------------------------------------------------------------
# 2. แก้ไข / อัปเดตสถานะจัดส่ง (PUT) -> Mock
# -------------------------------------------------------------
@app.put('/api/tracking-transactions/{transaction_id}')
def update_tracking_transaction(transaction_id: str, data: TrackingTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    validate_token(token, admin_line_id)
    return {
        "success": True,
        "message": "[Demo Mode] อัปเดตสถานะพัสดุสำเร็จ"
    }

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "index:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
