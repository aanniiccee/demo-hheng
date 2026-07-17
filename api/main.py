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

@app.post('/api/pawn-transactions')
def add_pawn_transaction(data: PawnTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    c = validate_token(token, admin_line_id)
    if not sb: raise HTTPException(500, "Supabase client not initialized")

    current_client_id = c['client_id']

    # --- 1. Logic รันเลข ID อัตโนมัติ: PW_[client_id]_[เลขรัน]_[งวด] ---
    last_t = sb.table('transaction_master')\
        .select('transaction_id')\
        .like('transaction_id', f'PW_{current_client_id}_%')\
        .eq('client_id', current_client_id)\
        .order('transaction_id', desc=True)\
        .limit(1)\
        .execute()

    next_num = 1
    next_sub = 1 # งวดเริ่มต้นที่ 1 เสมอสำหรับรายการแรก

    if last_t.data:
        last_id = last_t.data[0]['transaction_id']
        
        # Regex รองรับโครงสร้าง: PW_{client_id}_{เลขรัน}_{เลขงวด}
        # เช่น PW_123_4_1 -> group(1) = 4, group(2) = 1
        match = re.search(rf'PW_{current_client_id}_(\d+)_(\d+)', last_id)
        
        if match:
            last_num = int(match.group(1))
            # เนื่องจากเป็นการ "สร้างรายการใหม่" (ไม่ใช่การต่อดอกรายการเดิม) 
            # เราจึงขยับเลขรันหลักขึ้น 1 และรีเซ็ตงวดกลับไปเริ่มที่ 1
            next_num = last_num + 1
            next_sub = 1 
        else:
            # Fallback เผื่อมีข้อมูลเก่าในระบบที่ไม่มี _[งวด] ต่อท้าย
            match_old = re.search(rf'PW_{current_client_id}_(\d+)', last_id)
            if match_old:
                next_num = int(match_old.group(1)) + 1

    # ได้ ID ใหม่ในรูปแบบ เช่น PW_1001_1_1 (Client 1001, รายการที่ 1, งวดที่ 1)
    new_tx_id = f"PW_{current_client_id}_{next_num}_{next_sub}"

    # --- 2. บันทึกลงตาราง transaction_master ---
    master_payload = {
        "transaction_id": new_tx_id,
        "transaction_type": "PAWN",
        "product": data.product,       
        "product_id": data.product_id if data.product_id else None, 
        "customer_name": data.customer_name,
        "phone_number": data.phone_number,
        "channel": data.channel,
        "current_status": "PENDING", 
        "closed": data.closed,
        "note": data.note,
        "client_id": current_client_id,
        "created_by_line_id": data.created_by_line_id,
        "created_by_name": data.created_by_name,
        "chat_link": data.chat_link
    }

    # --- 3. บันทึกลงตาราง transaction_pawn ---
    pawn_payload = {
        "transaction_id": new_tx_id,
        "interest_per_month": data.interest_per_month,
        "payment_date": data.payment_date,
        "next_due_date": data.next_due_date,
        "input_status": data.input_status,
        "client_id": current_client_id,
        "total_paid_amount": data.total_paid_amount if data.total_paid_amount else 0.0
    }

    try:
        sb.table('transaction_master').insert(master_payload).execute()
        sb.table('transaction_pawn').insert(pawn_payload).execute()
        return {"success": True, "transaction_id": new_tx_id}
    except Exception as e:
        raise HTTPException(500, f"Database error: {str(e)}")

@app.put('/api/pawn-transactions/{transaction_id}')
def update_pawn_transaction(transaction_id: str, data: PawnTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    c = validate_token(token, admin_line_id)
    if not sb: raise HTTPException(500, "Supabase client not initialized")

    current_client_id = c['client_id']

    # 1. ดึงข้อมูลตั๋วปัจจุบัน
    old_tx = sb.table('transaction_master')\
        .select('*, transaction_pawn(*)').eq('transaction_id', transaction_id)\
        .eq('client_id', current_client_id).limit(1).execute()

    if not old_tx.data:
        raise HTTPException(404, "ไม่พบข้อมูลรายการต่อดอก")

    master_info = old_tx.data[0]
    pawn_list = master_info.get('transaction_pawn', [])
    old_pawn_data = pawn_list[0] if isinstance(pawn_list, list) and len(pawn_list) > 0 else (pawn_list or {})
    original_due_date = old_pawn_data.get('next_due_date')

    # ตั้งค่าสถานะเริ่มต้นตามจริง
    new_status_for_current = "ชำระแล้ว" if data.payment_date else master_info.get('current_status')
    final_master_closed = data.closed  # YES หรือ NO จากหน้าบ้าน
    current_note = data.note or ""
    admin_input_status = data.input_status
    base_id = transaction_id.rsplit('_', 1)[0]

    # 🌟 [เงื่อนไขที่ 1 เพิ่มใหม่]: เคสแก้ไขข้อมูลตั๋วเดิม (Master Data) ของรายการเดิม
    if getattr(data, 'is_edit_pawn_master', False) == True:
        try:
            # อัปเดตข้อมูลตั๋วใบเดิมที่ตาราง master (เปลี่ยนจาก product_id เป็น product)
            sb.table('transaction_master').update({
                "product": data.product,              # 🌟 เก็บเข้าคอลัมน์ใหม่ที่เป็น Freetext
                "product_id": data.product_id if data.product_id else None,
                "customer_name": data.customer_name,
                "phone_number": data.phone_number,
                "channel": data.channel,
                "note": f"[ระบบ] แก้ไขข้อมูลต่อดอกเดิม. " + current_note,
                "updated_at": "now()",
                "updated_by_line_id": data.created_by_line_id,
                "updated_by_name": data.created_by_name,
                "chat_link": data.chat_link
            }).eq('transaction_id', transaction_id).eq('client_id', current_client_id).execute()

            # อัปเดตข้อมูลดอกเบี้ยและสถานะแอดมินที่ตาราง pawn ของตั๋วใบเดิม
            sb.table('transaction_pawn').update({
                "interest_per_month": data.interest_per_month,
                "next_due_date": data.next_due_date,
                "input_status": admin_input_status,
                "updated_at": "now()"
            }).eq('transaction_id', transaction_id).eq('client_id', current_client_id).execute()

            return {"success": True, "message": "อัปเดตข้อมูลต่อดอกเดิมสำเร็จ"}
        except Exception as e:
            raise HTTPException(500, f"Database error (Edit Master): {str(e)}")

    # ----------------------------------------------------------------------
    # 2. เคสปกติ: เป็นการ "ต่อดอก" (มีการกรอกวันชำระ และ closed == "NO")
    # ----------------------------------------------------------------------
    elif data.payment_date and data.payment_date.strip() != "" and data.closed == "NO":

        # --- บล็อกแตกตั๋วใหม่ (_#2, _#3...) ---
        last_sub = sb.table('transaction_master').select('transaction_id').like('transaction_id', f'{base_id}_%').eq('client_id', current_client_id).execute()
        next_version = 2
        if last_sub.data:
            max_ver = 1
            for item in last_sub.data:
                match = re.search(r'_(\d+)$', item['transaction_id'])
                if match: max_ver = max(max_ver, int(match.group(1)))
                next_version = max_ver + 1

        new_sub_tx_id = f"{base_id}_{next_version}"

        # สร้างตั๋วใบใหม่รองรับประวัติถัดไป (เปลี่ยนไปใช้ฟิลด์ product แทน product_id)
        sb.table('transaction_master').insert({
            "transaction_id": new_sub_tx_id,
            "transaction_type": "PAWN",
            "product": data.product,
            "product_id": data.product_id if data.product_id else None, 
            "customer_name": data.customer_name,
            "phone_number": data.phone_number,
            "channel": data.channel,
            "current_status": "ยังไม่ถึงกำหนด",
            "closed": "NO",
            "note": f"[ระบบ] ต่อดอกจากเลขที่ {transaction_id}. " + current_note,
            "client_id": current_client_id,
            "created_by_line_id": data.created_by_line_id,
            "created_by_name": data.created_by_name,
            "chat_link": data.chat_link
        }).execute()

        sb.table('transaction_pawn').insert({
            "transaction_id": new_sub_tx_id,
            "interest_per_month": data.interest_per_month,
            "payment_date": None,
            "next_due_date": data.next_due_date,
            "input_status": data.input_status,
            "client_id": current_client_id,
            "total_paid_amount": 0.0,
            "created_at": "now()",
            "updated_at": "now()"
        }).execute()

        final_master_closed = "NO"
        current_note = f"[ระบบ] ต่อดอกสำเร็จ สร้างรายการต่อดอกเลขที่ {new_sub_tx_id}. " + current_note

    # ----------------------------------------------------------------------
    # 3. เคสปกติ: เป็นการ "ปิดสัญญา / ไถ่ถอน" (closed == "YES")
    # ----------------------------------------------------------------------
    elif data.closed == "YES":
        current_note = "[ระบบ] ปิดสัญญา " + current_note
        new_status_for_current = "ชำระแล้ว"

        try:
            sb.table('transaction_master')\
                .update({
                    "closed": "YES",
                    "current_status": "ชำระแล้ว",
                    "note": f"[ระบบ] ปิดสัญญาทั้งหมดของรายการ {transaction_id}"
                })\
                .like('transaction_id', f'{base_id}%')\
                .neq('transaction_id', transaction_id)\
                .eq('client_id', current_client_id)\
                .execute()
        except Exception as e:
            pass

    # 4. อัปเดตข้อมูลลงตั๋วใบเดิม (กรณีมาจากการกดบันทึกต่อดอก หรือปิดสัญญาปกติ)
    try:
        sb.table('transaction_master').update({
            "product": data.product,
            "product_id": data.product_id if data.product_id else None, 
            "customer_name": data.customer_name,
            "phone_number": data.phone_number,
            "channel": data.channel,
            "current_status": new_status_for_current,
            "closed": final_master_closed,
            "note": current_note, 
            "updated_at": "now()",
            "updated_by_line_id": data.created_by_line_id,
            "updated_by_name": data.created_by_name,
            "chat_link": data.chat_link
        }).eq('transaction_id', transaction_id).eq('client_id', current_client_id).execute()

        sb.table('transaction_pawn').update({
            "interest_per_month": data.interest_per_month,
            "payment_date": data.payment_date if data.payment_date else None,
            "next_due_date": original_due_date,
            "input_status": admin_input_status,
            "total_paid_amount": data.total_paid_amount,
            "updated_at": "now()"
        }).eq('transaction_id', transaction_id).eq('client_id', current_client_id).execute()

        return {"success": True}
    except Exception as e:
        raise HTTPException(500, f"Database error: {str(e)}")

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
    
@app.post('/api/installment-transactions')
def create_installment_transactions(data: InstallmentTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    c = validate_token(token, admin_line_id)
    current_client_id = c['client_id']

    prefix = f"IS_{current_client_id}_"
    last_tx = sb.table('transaction_master')\
        .select('transaction_id')\
        .like('transaction_id', f'{prefix}%')\
        .eq('client_id', current_client_id)\
        .execute()

    max_item_no = 0
    if last_tx.data:
        for item in last_tx.data:
            match = re.search(rf"IS_{current_client_id}_(\d+)", item['transaction_id'])
            if match:
                max_item_no = max(max_item_no, int(match.group(1)))

    next_item_no = max_item_no + 1
    base_note = data.note or ""

    # 🌟 1. สร้างตระกร้ารองรับข้อมูลที่จะ Insert แบบเป็นชุด
    master_records = []
    installment_records = []

    for i in range(1, data.total_periods + 1):
        target_tx_id = f"IS_{current_client_id}_{next_item_no}_{i}"
        calculated_due = calculate_next_due_date(data.start_year, data.start_month, data.monthly_due_day, i - 1)

        # 🌟 2. โยนข้อมูลใส่ List แทนการยิงตรงเข้า DB
        master_records.append({
            "transaction_id": target_tx_id,
            "transaction_type": "INSTALLMENT",
            "product": data.product,
            "product_id": data.product_id if data.product_id else None,
            "customer_name": data.customer_name,
            "phone_number": data.phone_number,
            "channel": data.channel,
            "current_status": "ยังไม่ถึงกำหนด",
            "closed": "NO",
            "note": f"[ระบบ] สร้างงวดที่ {i}/{data.total_periods}. " + base_note,
            "client_id": current_client_id,
            "created_by_line_id": data.created_by_line_id,
            "created_by_name": data.created_by_name,
            "chat_link": data.chat_link
        })

        installment_records.append({
            "transaction_id": target_tx_id,
            "installment_amount": data.installment_amount,
            "total_periods": data.total_periods,
            "current_period": i,
            "monthly_due_day": data.monthly_due_day,
            "payment_date": None,
            "total_paid_amount": 0.0,
            "due_date": calculated_due,
            "input_status": data.input_status,
            "client_id": current_client_id
        })

    # 🌟 3. สั่งบันทึกข้อมูลแบบ Bulk Insert (ยิงเข้า Supabase ตารางละ 1 ครั้งถ้วน!)
    if master_records:
        sb.table('transaction_master').insert(master_records).execute()
    if installment_records:
        sb.table('transaction_installment').insert(installment_records).execute()

    return {"success": True, "created_count": data.total_periods}

# -------------------------------------------------------------
# 2. บันทึกรับชำระเงินรายงวดปกติ (PUT)
# -------------------------------------------------------------
@app.put('/api/installment-transactions/{tx_id}')
def update_installment_payment(tx_id: str, payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    c = validate_token(token, admin_line_id)
    current_client_id = c['client_id']

    admin_line_id = c.get('line_id', c.get('admin_line_id', 'Unknown'))
    admin_name = c.get('name', c.get('admin_name', 'Unknown'))

    current_inst = sb.table('transaction_installment')\
        .select('total_periods, current_period, total_paid_amount, installment_amount, input_status')\
        .eq('transaction_id', tx_id)\
        .eq('client_id', current_client_id)\
        .single()\
        .execute()

    if not current_inst.data:
        raise HTTPException(status_code=404, detail="ไม่พบรหัสค่างวดนี้ในระบบ")

    inst_data = current_inst.data
    total_periods = inst_data.get('total_periods', 1)
    current_period = inst_data.get('current_period', 1)
    old_paid_amount = inst_data.get('total_paid_amount', 0.0) or 0.0
    inst_amount = inst_data.get('installment_amount', 0.0)

    incoming_paid = float(payload.get('total_paid_amount', 0.0))
    new_accumulated_paid = old_paid_amount + incoming_paid

    payment_date_input = payload.get('payment_date')

    # 🌟 รักษาค่า input_status ดั้งเดิมของแอดมินไว้ ไม่โดนระบบเขียนประโยคอื่นทับ
    admin_input_status = payload.get('input_status', inst_data.get('input_status', ''))

    # ประเมินสถานะระบบจากยอดเงิน
    installment_status = "ชำระแล้ว" if new_accumulated_paid >= inst_amount else "ยังไม่ถึงกำหนด"

    # 🌟 ย้าย Log ระบบมาห้อยท้ายในช่อง Note แทน
    current_note = payload.get('note', '')
    if installment_status == "ชำระแล้ว":
        current_note = f"[ระบบ] ชำระเงินงวดที่ {current_period} เรียบร้อยแล้ว. " + current_note

    is_last_period = (current_period == total_periods)
    should_close_contract = "YES" if (is_last_period and installment_status == "ชำระแล้ว") else "NO"

    parts = tx_id.split('_')
    if len(parts) < 3 or parts[0] != 'IS':
        raise HTTPException(status_code=400, detail="รูปแบบรหัสธุรกรรมไม่ถูกต้อง")
    base_prefix = f"{parts[0]}_{parts[1]}_{parts[2]}_"

    sb.table('transaction_installment')\
        .update({
            "payment_date": payment_date_input if payment_date_input else datetime.date.today().strftime("%Y-%m-%d"),
            "total_paid_amount": new_accumulated_paid,
            "input_status": admin_input_status # 🌟 เซฟค่าของแอดมินแท้ๆ
        })\
        .eq('transaction_id', tx_id)\
        .eq('client_id', current_client_id)\
        .execute()

    # 🌟 จัดการชุดข้อมูลตารางมาสเตอร์ให้ถูกต้อง ดึงจาก payload.get('product')
    master_update_data = {
        "current_status": installment_status,
        "note": current_note,
        "updated_at": "now()",
        "updated_by_line_id": admin_line_id,
        "updated_by_name": admin_name
    }
    
    if "product" in payload and payload.get("product"):
        master_update_data["product"] = payload.get("product")

    if "chat_link" in payload and payload.get("chat_link") is not None and str(payload.get("chat_link")).strip() != "":
        master_update_data["chat_link"] = payload.get("chat_link")

    sb.table('transaction_master')\
        .update(master_update_data)\
        .eq('transaction_id', tx_id)\
        .eq('client_id', current_client_id)\
        .execute()
    
    if should_close_contract == "YES":
        sb.table('transaction_master')\
            .update({
                "closed": "YES",
                "note": f"[ระบบ] ปิดสัญญาสมบูรณ์เนื่องจากชำระครบงวดสุดท้ายแล้ว.",
                "updated_at": "now()",
                "updated_by_line_id": admin_line_id,
                "updated_by_name": admin_name
            })\
            .like('transaction_id', f'{base_prefix}%')\
            .eq('client_id', current_client_id)\
            .execute()

    return {"success": True, "message": "บันทึกค่างวดสำเร็จ", "contract_closed": should_close_contract}

# -------------------------------------------------------------
# 3. ฟังก์ชัน VOID ยกเลิกสัญญาทั้งชุด (POST /void)
# -------------------------------------------------------------
@app.post('/api/installment-transactions/{tx_id}/void')
def void_entire_contract(tx_id: str, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    c = validate_token(token, admin_line_id)
    current_client_id = c['client_id']

    admin_line_id = c.get('line_id', c.get('admin_line_id', 'Unknown'))
    admin_name = c.get('name', c.get('admin_name', 'Unknown'))

    parts = tx_id.split('_')
    if len(parts) < 3 or parts[0] != 'IS':
        raise HTTPException(status_code=400, detail="รูปแบบรหัสธุรกรรมไม่ถูกต้อง")
    base_prefix = f"{parts[0]}_{parts[1]}_{parts[2]}_"

    # 🌟 ย้ายการอ้างอิงคำว่ายกเลิก ไปเก็บไว้ที่ฟิลด์ note ทั้งสองตาราง และปล่อย input_status ไว้ตามเดิม
    sb.table('transaction_master')\
        .update({
            "current_status": "VOID",
            "closed": "YES",
            "note": "[ระบบ] สัญญานี้ถูกยกเลิก (Voided)",
            "updated_at": "now()",
            "updated_by_line_id": admin_line_id,
            "updated_by_name": admin_name
        })\
        .like('transaction_id', f'{base_prefix}%')\
        .eq('client_id', current_client_id)\
        .execute()
    
    return {"success": True, "message": "ยกเลิกสัญญาทั้งชุดเรียบร้อยแล้ว"}


# -------------------------------------------------------------
# 4. ปิดยอดสัญญาก่อนกำหนด (POST /payoff)
# -------------------------------------------------------------
@app.post('/api/installment-transactions/{tx_id}/payoff')
def payoff_entire_contract(tx_id: str, payload: dict, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    c = validate_token(token, admin_line_id)
    current_client_id = c['client_id']

    admin_line_id = c.get('line_id', c.get('admin_line_id', 'Unknown'))
    admin_name = c.get('name', c.get('admin_name', 'Unknown'))

    actual_payment_date = payload.get('payment_date', datetime.date.today().strftime("%Y-%m-%d"))
    actual_paid_amount = float(payload.get('total_paid_amount', 0.0))

    # 🌟 รับค่าสถานะจากหน้าบ้านตรงๆ (ถ้าหน้าบ้านคีย์อะไรมาก็ใช้ค่านั้น)
    admin_input_status = payload.get('input_status', '')

    parts = tx_id.split('_')
    if len(parts) < 3 or parts[0] != 'IS':
        raise HTTPException(status_code=400, detail="รูปแบบรหัสธุรกรรมไม่ถูกต้อง")
    base_prefix = f"{parts[0]}_{parts[1]}_{parts[2]}_"

    # 🌟 อัปเดตตารางหลัก: บันทึกความจำลงช่อง note ว่าปิดยอดก่อนกำหนด
    sb.table('transaction_master')\
        .update({
            "current_status": "ชำระแล้ว",
            "closed": "YES",
            "note": "[ระบบ] ปิดยอดสัญญาก่อนกำหนด (Payoff ทั้งหมด)",
            "updated_at": "now()",
            "updated_by_line_id": admin_line_id,
            "updated_by_name": admin_name
        })\
        .like('transaction_id', f'{base_prefix}%')\
        .eq('client_id', current_client_id)\
        .execute()

    current_inst = sb.table('transaction_installment')\
        .select('total_paid_amount, input_status')\
        .eq('transaction_id', tx_id)\
        .eq('client_id', current_client_id)\
        .single()\
        .execute()

    old_paid_amount = current_inst.data.get('total_paid_amount', 0.0) if current_inst.data else 0.0
    new_accumulated_paid = old_paid_amount + actual_paid_amount

    # ดึงค่าสถานะแอดมินเดิมกรณีที่ใน payload ไม่ได้ส่งมา
    if not admin_input_status and current_inst.data:
        admin_input_status = current_inst.data.get('input_status', '')

    # งวดที่แอดมินคลิกปิดยอด: บันทึกจำนวนเงินจริง และรักษาสถานะแอดมินไว้
    sb.table('transaction_installment')\
        .update({
            "payment_date": actual_payment_date,
            "total_paid_amount": new_accumulated_paid,
            "input_status": admin_input_status
        })\
        .eq('transaction_id', tx_id)\
        .eq('client_id', current_client_id)\
        .execute()

    # 🌟 งวดอื่นๆ ที่เหลือที่ระบบช่วยปิดตามหลัง: ให้ลงวันชำระเงิน แต่ห้ามเขียนคำว่า "ระบบเคลียร์ยอด" ทับช่องสถานะแอดมิน
    sb.table('transaction_installment')\
        .update({
            "payment_date": actual_payment_date,
            # ถอดบรรทัด "input_status": "ปิดยอดก่อนกำหนด (ระบบเคลียร์ยอด)" ออกไป เพื่อคงค่าของเดิมไว้
        })\
        .like('transaction_id', f'{base_prefix}%')\
        .neq('transaction_id', tx_id)\
        .eq('client_id', current_client_id)\
        .execute()

    return {"success": True, "message": "บันทึกยอดปิดสัญญาก่อนกำหนดสำเร็จเรียบร้อย"}


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

@app.post('/api/deposit-transactions')
def add_deposit_transaction(data: DepositTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    c = validate_token(token, admin_line_id)
    if not sb: raise HTTPException(500, "Supabase client not initialized")

    current_client_id = c['client_id']

    # --- รันเลข ID อัตโนมัติ: DP_[client_id]_[เลขรัน] ---
    last_t = sb.table('transaction_master')\
        .select('transaction_id')\
        .like('transaction_id', f'DP_{current_client_id}_%')\
        .eq('client_id', current_client_id)\
        .order('transaction_id', desc=True)\
        .limit(1)\
        .execute()

    next_num = 1
    if last_t.data:
        last_id = last_t.data[0]['transaction_id']
        match = re.search(rf'DP_{current_client_id}_(\d+)', last_id)
        if match:
            next_num = int(match.group(1)) + 1

    new_tx_id = f"DP_{current_client_id}_{next_num}"

    master_payload = {
        "transaction_id": new_tx_id,
        "transaction_type": "DEPOSIT",
        "product": data.product,         
        "product_id": data.product_id if data.product_id and data.product_id.strip() != "" else None, 
        "customer_name": data.customer_name,
        "phone_number": data.phone_number,
        "channel": data.channel,
        "current_status": "PENDING", 
        "closed": "NO",
        "note": data.note,
        "client_id": current_client_id,
        "created_by_line_id": data.created_by_line_id,
        "created_by_name": data.created_by_name,
        "chat_link": data.chat_link if data.chat_link and data.chat_link.strip() != "" else None
    }

    # 🌟 2. เพิ่ม input_status เข้าตาราง transaction_deposit ตอนสร้างรายการใหม่
    deposit_payload = {
        "transaction_id": new_tx_id,
        "deposit_amount": data.deposit_amount,
        "deposit_date": data.deposit_date,
        "remaining_balance": data.remaining_balance,
        "due_date": data.due_date,
        "total_paid_amount": 0.0,
        "payment_date": None,
        "input_status": data.input_status,  # 🆕 บันทึกสถานะมัดจำลงตารางย่อย
        "client_id": current_client_id
    }

    try:
        sb.table('transaction_master').insert(master_payload).execute()
        sb.table('transaction_deposit').insert(deposit_payload).execute()
        return {"success": True, "transaction_id": new_tx_id}
    except Exception as e:
        raise HTTPException(500, f"Database error: {str(e)}")

@app.put('/api/deposit-transactions/{transaction_id}')
def update_deposit_transaction(transaction_id: str, data: DepositTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    c = validate_token(token, admin_line_id)
    if not sb: raise HTTPException(500, "Supabase client not initialized")

    current_client_id = c['client_id']
    current_note = data.note or ""

    # ป้องกันบั๊กสตริงว่างจากหน้าบ้านดักจับปุ่มปิดงาน
    is_payment_done = data.payment_date and data.payment_date.strip() != "" and data.payment_date != "null" and data.payment_date != "undefined"

    if data.closed == "YES":
        new_status = "ชำระครบแล้ว"
        final_closed = "YES"
        # ป้องกันการเติมข้อความซ้ำซ้อนถ้าเคสถูกปิดไปแล้ว
        if "[ระบบ]" not in current_note:
            current_note = "[ระบบ] รับชำระส่วนที่เหลือเรียบร้อย ปิดเคสทันที. " + current_note
    else:
        new_status = "PENDING"
        final_closed = "NO"

    try:
        # 1. อัปเดตตารางหลัก
        sb.table('transaction_master').update({
            "product": data.product,
            "product_id": data.product_id if data.product_id and data.product_id.strip() != "" else None, 
            "customer_name": data.customer_name,
            "phone_number": data.phone_number,
            "channel": data.channel,
            "current_status": new_status,
            "closed": final_closed,
            "note": current_note, 
            "updated_at": "now()",
            "updated_by_line_id": data.created_by_line_id,
            "updated_by_name": data.created_by_name,
            "chat_link": data.chat_link if data.chat_link and data.chat_link.strip() != "" else None
        }).eq('transaction_id', transaction_id).eq('client_id', current_client_id).execute()

        # 🌟 3. เพิ่ม input_status เข้าเงื่อนไขอัปเดตตารางย่อย transaction_deposit
        sb.table('transaction_deposit').update({
            "deposit_amount": data.deposit_amount,
            "deposit_date": data.deposit_date,
            "remaining_balance": data.remaining_balance,
            "due_date": data.due_date,
            "total_paid_amount": data.total_paid_amount,
            "payment_date": data.payment_date if is_payment_done else None,
            "input_status": data.input_status,  # อัปเดตสถานะมัดจำล่าสุด
            "updated_at": "now()"
        }).eq('transaction_id', transaction_id).eq('client_id', current_client_id).execute()

        return {"success": True}
    except Exception as e:
        raise HTTPException(500, f"Database error: {str(e)}")

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


@app.post('/api/repair-transactions')
def add_repair_transaction(data: RepairTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    c = validate_token(token, admin_line_id)
    if not sb: raise HTTPException(500, "Supabase client not initialized")

    current_client_id = c['client_id']

    # --- รันเลข ID อัตโนมัติสำหรับงานซ่อม: RP_[client_id]_[เลขรัน] ---
    last_t = sb.table('transaction_master')\
        .select('transaction_id')\
        .like('transaction_id', f'RP_{current_client_id}_%')\
        .eq('client_id', current_client_id)\
        .order('transaction_id', desc=True)\
        .limit(1)\
        .execute()

    next_num = 1
    if last_t.data:
        last_id = last_t.data[0]['transaction_id']
        match = re.search(rf'RP_{current_client_id}_(\d+)', last_id)
        if match:
            next_num = int(match.group(1)) + 1

    new_tx_id = f"RP_{current_client_id}_{next_num}"

    # 1. ข้อมูลสำหรับตารางหลัก (Master Table)
    master_payload = {
        "transaction_id": new_tx_id,
        "transaction_type": "REPAIR",
        "product": data.product,         
        "product_id": data.product_id if data.product_id and data.product_id.strip() != "" else None, 
        "customer_name": data.customer_name,
        "phone_number": data.phone_number,
        "channel": data.channel,
        "current_status": "PENDING", 
        "closed": "NO",
        "note": data.note,
        "client_id": current_client_id,
        "created_by_line_id": data.created_by_line_id,
        "created_by_name": data.created_by_name,
        "chat_link": data.chat_link if data.chat_link and data.chat_link.strip() != "" else None
    }

    # 2. ข้อมูลสำหรับตารางย่อยงานซ่อม (Repair Detail Table)
    repair_payload = {
        "transaction_id": new_tx_id,
        "received_date": data.received_date,
        "repaired_date": data.repaired_date,
        "delivery_date": data.delivery_date,
        "input_status": data.input_status,
        "client_id": current_client_id
    }

    try:
        sb.table('transaction_master').insert(master_payload).execute()
        sb.table('transaction_repair').insert(repair_payload).execute()
        return {"success": True, "transaction_id": new_tx_id}
    except Exception as e:
        raise HTTPException(500, f"Database error: {str(e)}")


@app.put('/api/repair-transactions/{transaction_id}')
def update_repair_transaction(transaction_id: str, data: RepairTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    c = validate_token(token, admin_line_id)
    if not sb: raise HTTPException(500, "Supabase client not initialized")

    current_client_id = c['client_id']
    current_note = data.note or ""

    # จัดการ Logic สถานะปิดเคส/เปิดเคส
    if data.closed == "YES":
        new_status = "ปิดเคสแล้ว"
        final_closed = "YES"
        if "[ระบบ]" not in current_note:
            current_note = "[ระบบ] ส่งมอบสินค้าและปิดเคสเรียบร้อย. " + current_note
    else:
        new_status = "PENDING"
        final_closed = "NO"

    try:
        # 1. อัปเดตตารางหลัก (Master)
        sb.table('transaction_master').update({
            "product": data.product,
            "product_id": data.product_id if data.product_id and data.product_id.strip() != "" else None, 
            "customer_name": data.customer_name,
            "phone_number": data.phone_number,
            "channel": data.channel,
            "current_status": new_status,
            "closed": final_closed,
            "note": current_note, 
            "updated_at": "now()",
            "updated_by_line_id": data.created_by_line_id,
            "updated_by_name": data.created_by_name,
            "chat_link": data.chat_link if data.chat_link and data.chat_link.strip() != "" else None
        }).eq('transaction_id', transaction_id).eq('client_id', current_client_id).execute()

        # 2. อัปเดตตารางย่อยงานซ่อม (Repair Detail)
        sb.table('transaction_repair').update({
            "received_date": data.received_date,
            "repaired_date": data.repaired_date,
            "delivery_date": data.delivery_date,
            "input_status": data.input_status,
            "updated_at": "now()"
        }).eq('transaction_id', transaction_id).eq('client_id', current_client_id).execute()

        return {"success": True}
    except Exception as e:
        raise HTTPException(500, f"Database error: {str(e)}")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "index:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
