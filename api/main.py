import datetime
import os
import re
import urllib.parse
from calendar import monthrange
from datetime import date
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv
from fastapi import Body, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

load_dotenv()

app = FastAPI()

# กำหนด Security Token ที่ยอมรับ
EXPECTED_TOKEN = "c925e1c7-5663-4ffa-8add-8c019d5a73f9"


# --- ฟังก์ชันยืนยัน Security Token & LINE Token ---
def verify_access_and_token(
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    admin_line_id: Optional[str] = None
):
    # 1. ตรวจสอบ Security Token ก่อนเป็นอันดับแรก
    if token != EXPECTED_TOKEN:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: Security Token ไม่ถูกต้องหรือไม่มีสิทธิ์เข้าถึง"
        )

    # 2. ตรวจสอบ LINE ID Token (ถ้ามี)
    liff_channel_id = os.environ.get("LINE_CHANNEL_ID")
    if authorization and authorization.startswith("Bearer "):
        id_token = authorization.split(" ")[1]
        try:
            resp = requests.post(
                "https://api.line.me/oauth2/v2.1/verify",
                data={"id_token": id_token, "client_id": liff_channel_id},
                timeout=5
            )
            if resp.status_code == 200:
                payload = resp.json()
                return {
                    "client_id": 1,
                    "line_user_id": payload.get("sub"),
                    "name": payload.get("name")
                }
        except Exception:
            pass
            
    return {"client_id": 1, "line_user_id": admin_line_id or "U_DEMO_USER"}


@app.get("/api/config/liff-id")
def get_liff_config(token: Optional[str] = Query(None)):
    if token != EXPECTED_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    liff_id = os.environ.get("LIFF_ID")
    if not liff_id:
        raise HTTPException(status_code=500, detail="LIFF_ID is not configured in .env")
    return {"liff_id": liff_id}


# ==========================================
# 1. PAWN (จำนำ)
# ==========================================
class PawnTransactionIn(BaseModel):
    product: Optional[str] = ''          
    product_id: Optional[str] = None     
    customer_name: str
    phone_number: Optional[str] = ''
    channel: str  # LINE, FB, IG, OTHER
    closed: str = 'NO'  # YES, NO
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
def get_single_pawn_transaction(
    tx_id: str, 
    token: Optional[str] = Query(None), 
    authorization: Optional[str] = Header(None)
):
    user = verify_access_and_token(token, authorization)
    decoded_tx_id = urllib.parse.unquote(tx_id)
    return [{
        "transaction_id": decoded_tx_id,
        "transaction_type": "PAWN",
        "product_id": "PROD-001",
        "product": "ทองคำแท่ง 1 บาท",
        "customer_name": "สมชาย ใจดี",
        "phone_number": "0812345678",
        "channel": "LINE",
        "current_status": "ACTIVE",
        "closed": "NO",
        "note": "ต่อดอกเบี้ยเรียบร้อยแล้วรอบที่ 2",
        "client_id": user["client_id"],
        "created_at": "2026-03-01T10:00:00Z",
        "updated_at": "2026-03-01T10:00:00Z",
        "created_by_line_id": "U111122223333",
        "created_by_name": "แอดมินเจมส์",
        "updated_by_line_id": "U111122223333",
        "updated_by_name": "แอดมินเจมส์",
        "chat_link": "https://line.me/R/oaMessage/@demo/?somchai",
        "transaction_pawn": [{
            "transaction_id": decoded_tx_id,
            "interest_per_month": 1050.00,
            "payment_date": "2026-03-01",
            "next_due_date": "2026-04-01",
            "input_status": "ต่อดอกแล้ว",
            "client_id": user["client_id"],
            "total_paid_amount": 1050.0,
            "created_at": "2026-03-01T10:00:00Z",
            "updated_at": "2026-03-01T10:00:00Z"
        }]
    }]


@app.get('/api/pawn-transactions')
def get_pawn_transactions(
    token: Optional[str] = Query(None), 
    authorization: Optional[str] = Header(None)
):
    user = verify_access_and_token(token, authorization)
    return [
        {
            "transaction_id": "PW-202603-001",
            "transaction_type": "PAWN",
            "product_id": "PROD-001",
            "product": "ทองคำแท่ง 1 บาท",
            "customer_name": "สมชาย ใจดี",
            "phone_number": "0812345678",
            "channel": "LINE",
            "current_status": "ACTIVE",
            "closed": "NO",
            "note": "ลูกค้าแจ้งต่อดอกทุกวันที่ 1 ของเดือน",
            "client_id": user["client_id"],
            "created_at": "2026-03-01T10:00:00Z",
            "updated_at": "2026-03-01T10:00:00Z",
            "created_by_line_id": "U111122223333",
            "created_by_name": "แอดมินเจมส์",
            "updated_by_line_id": "U111122223333",
            "updated_by_name": "แอดมินเจมส์",
            "chat_link": "https://line.me/R/oaMessage/@demo/?somchai",
            "transaction_pawn": [{
                "transaction_id": "PW-202603-001",
                "interest_per_month": 1050.00,
                "payment_date": "2026-03-01",
                "next_due_date": "2026-04-01",
                "input_status": "ปกติ",
                "client_id": user["client_id"],
                "total_paid_amount": 0.0,
                "created_at": "2026-03-01T10:00:00Z",
                "updated_at": "2026-03-01T10:00:00Z"
            }]
        },
        {
            "transaction_id": "PW-202603-002",
            "transaction_type": "PAWN",
            "product_id": "PROD-002",
            "product": "iPhone 15 Pro Max 256GB",
            "customer_name": "นภา รุ่งเรือง",
            "phone_number": "0898765432",
            "channel": "FB",
            "current_status": "EXPIRED",
            "closed": "NO",
            "note": "เกินกำหนดชำระแล้ว",
            "client_id": user["client_id"],
            "created_at": "2026-02-15T14:30:00Z",
            "updated_at": "2026-02-15T14:30:00Z",
            "created_by_line_id": "U444455556666",
            "created_by_name": "แอดมินเมย์",
            "updated_by_line_id": "U444455556666",
            "updated_by_name": "แอดมินเมย์",
            "chat_link": "https://m.me/demo.shop",
            "transaction_pawn": [{
                "transaction_id": "PW-202603-002",
                "interest_per_month": 840.00,
                "payment_date": None,
                "next_due_date": "2026-03-15",
                "input_status": "ค้างชำระ",
                "client_id": user["client_id"],
                "total_paid_amount": 0.0,
                "created_at": "2026-02-15T14:30:00Z",
                "updated_at": "2026-02-15T14:30:00Z"
            }]
        }
    ]


@app.post('/api/pawn-transactions')
def add_pawn_transaction(
    payload: dict = Body(...), 
    token: Optional[str] = Query(None), 
    authorization: Optional[str] = Header(None)
):
    verify_access_and_token(token, authorization)
    raise HTTPException(status_code=400, detail="[Demo Mode] ไม่สามารถเพิ่มข้อมูลจำนำได้ในโหมดทดลอง")


@app.put('/api/pawn-transactions/{transaction_id}')
def update_pawn_transaction(
    transaction_id: str, 
    payload: dict = Body(...), 
    token: Optional[str] = Query(None), 
    authorization: Optional[str] = Header(None)
):
    verify_access_and_token(token, authorization)
    raise HTTPException(status_code=400, detail="[Demo Mode] ไม่สามารถแก้ไขข้อมูลจำนำได้ในโหมดทดลอง")


# ==========================================
# 2. INSTALLMENT (ผ่อนชำระ)
# ==========================================
class InstallmentTransactionIn(BaseModel):
    product: Optional[str] = ''
    product_id: Optional[str] = None
    customer_name: str
    phone_number: Optional[str] = ''
    channel: str  # LINE, FB, IG, OTHER
    note: Optional[str] = ''
    installment_amount: float
    total_periods: int
    current_period: int
    monthly_due_day: int
    due_date: Optional[str] = None
    payment_date: Optional[str] = None
    total_paid_amount: Optional[float] = 0.0
    input_status: Optional[str] = ''
    created_by_line_id: Optional[str] = 'Unknown'
    created_by_name: Optional[str] = 'Unknown'
    chat_link: Optional[str] = None


@app.get('/api/installment-transactions/{tx_id}')
def get_single_installment_transaction(
    tx_id: str, 
    token: Optional[str] = Query(None), 
    authorization: Optional[str] = Header(None)
):
    user = verify_access_and_token(token, authorization)
    return {
        "transaction_id": tx_id,
        "transaction_type": "INSTALLMENT",
        "product_id": "PROD-003",
        "product": "iPad Air 5 64GB Wi-Fi",
        "customer_name": "วิชัย มีสุข",
        "phone_number": "0821112233",
        "channel": "OTHER",
        "current_status": "IN_PROGRESS",
        "closed": "NO",
        "note": "จ่ายตรงเวลาทุกงวด",
        "client_id": user["client_id"],
        "created_at": "2026-01-10T11:20:00Z",
        "updated_at": "2026-01-10T11:20:00Z",
        "created_by_line_id": "U444455556666",
        "created_by_name": "แอดมินเมย์",
        "updated_by_line_id": "U444455556666",
        "updated_by_name": "แอดมินเมย์",
        "chat_link": None,
        "transaction_installment": [{
            "transaction_id": tx_id,
            "installment_amount": 2000.00,
            "total_periods": 10,
            "current_period": 3,
            "monthly_due_day": 10,
            "payment_date": "2026-03-10",
            "total_paid_amount": 6000.0,
            "due_date": "2026-04-10",
            "input_status": "กำลังผ่อน",
            "client_id": user["client_id"],
            "created_at": "2026-01-10T11:20:00Z",
            "updated_at": "2026-01-10T11:20:00Z"
        }]
    }


@app.get('/api/installment-transactions')
def get_installment_transactions(
    token: Optional[str] = Query(None), 
    authorization: Optional[str] = Header(None)
):
    user = verify_access_and_token(token, authorization)
    return [
        {
            "transaction_id": "INS-202601-001",
            "transaction_type": "INSTALLMENT",
            "product_id": "PROD-003",
            "product": "iPad Air 5 64GB Wi-Fi",
            "customer_name": "วิชัย มีสุข",
            "phone_number": "0821112233",
            "channel": "OTHER",
            "current_status": "IN_PROGRESS",
            "closed": "NO",
            "note": "ขอโอนจ่ายทุกวันที่ 10 ของเดือน",
            "client_id": user["client_id"],
            "created_at": "2026-01-10T11:20:00Z",
            "updated_at": "2026-01-10T11:20:00Z",
            "created_by_line_id": "U444455556666",
            "created_by_name": "แอดมินเมย์",
            "updated_by_line_id": "U444455556666",
            "updated_by_name": "แอดมินเมย์",
            "chat_link": None,
            "transaction_installment": [{
                "transaction_id": "INS-202601-001",
                "installment_amount": 2000.00,
                "total_periods": 10,
                "current_period": 3,
                "monthly_due_day": 10,
                "payment_date": "2026-03-10",
                "total_paid_amount": 6000.0,
                "due_date": "2026-04-10",
                "input_status": "กำลังผ่อน",
                "client_id": user["client_id"],
                "created_at": "2026-01-10T11:20:00Z",
                "updated_at": "2026-01-10T11:20:00Z"
            }]
        }
    ]


@app.post('/api/installment-transactions')
def create_installment_transactions(
    data: InstallmentTransactionIn, 
    token: Optional[str] = Query(None), 
    authorization: Optional[str] = Header(None)
):
    verify_access_and_token(token, authorization)
    raise HTTPException(status_code=400, detail="[Demo Mode] ไม่สามารถสร้างสัญญาผ่อนชำระได้ในโหมดทดลอง")


@app.put('/api/installment-transactions/{tx_id}')
def update_installment_payment(
    tx_id: str, 
    payload: dict = Body(...), 
    token: Optional[str] = Query(None), 
    authorization: Optional[str] = Header(None)
):
    verify_access_and_token(token, authorization)
    raise HTTPException(status_code=400, detail="[Demo Mode] ไม่สามารถบันทึกค่างวดได้ในโหมดทดลอง")


# ==========================================
# 3. DEPOSIT (มัดจำ)
# ==========================================
class DepositTransactionIn(BaseModel):
    product: Optional[str] = ''            
    product_id: Optional[str] = None          
    customer_name: str
    phone_number: Optional[str] = ''
    channel: str  # LINE, FB, IG, OTHER                 
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


@app.get('/api/deposit-transactions')
def get_deposit_transactions(
    token: Optional[str] = Query(None), 
    authorization: Optional[str] = Header(None)
):
    user = verify_access_and_token(token, authorization)
    return [
        {
            "transaction_id": "DEP-202603-001",
            "transaction_type": "DEPOSIT",
            "product_id": "PROD-004",
            "product": "กระเป๋า Brandname Chanel Classic 10\"",
            "customer_name": "อนันต์ รักดี",
            "phone_number": "0839998877",
            "channel": "FB",
            "current_status": "WAITING_PAYMENT",
            "closed": "NO",
            "note": "วางมัดจำไว้ก่อน นัดมารับของหน้าร้านวันที่ 20",
            "client_id": user["client_id"],
            "created_at": "2026-03-05T13:15:00Z",
            "updated_at": "2026-03-05T13:15:00Z",
            "created_by_line_id": "U777788889999",
            "created_by_name": "แอดมินนิว",
            "updated_by_line_id": "U777788889999",
            "updated_by_name": "แอดมินนิว",
            "chat_link": "https://m.me/demo.shop",
            "transaction_deposit": [{
                "transaction_id": "DEP-202603-001",
                "deposit_amount": 5000.00,
                "remaining_balance": 45000.00,
                "due_date": "2026-03-20",
                "payment_date": None,
                "deposit_date": "2026-03-05",
                "total_paid_amount": 5000.00,
                "input_status": "รอมารับสินค้า",
                "client_id": user["client_id"],
                "created_at": "2026-03-05T13:15:00Z",
                "updated_at": "2026-03-05T13:15:00Z"
            }]
        }
    ]


@app.post('/api/deposit-transactions')
def add_deposit_transaction(
    data: DepositTransactionIn, 
    token: Optional[str] = Query(None), 
    authorization: Optional[str] = Header(None)
):
    verify_access_and_token(token, authorization)
    raise HTTPException(status_code=400, detail="[Demo Mode] ไม่สามารถบันทึกข้อมูลมัดจำได้ในโหมดทดลอง")


@app.put('/api/deposit-transactions/{transaction_id}')
def update_deposit_transaction(
    transaction_id: str, 
    data: DepositTransactionIn, 
    token: Optional[str] = Query(None), 
    authorization: Optional[str] = Header(None)
):
    verify_access_and_token(token, authorization)
    raise HTTPException(status_code=400, detail="[Demo Mode] ไม่สามารถอัปเดตข้อมูลมัดจำได้ในโหมดทดลอง")


# ==========================================
# 4. REPAIR (งานซ่อม)
# ==========================================
class RepairTransactionIn(BaseModel):
    product: Optional[str] = ''             
    product_id: Optional[str] = None          
    customer_name: str                      
    phone_number: Optional[str] = ''        
    channel: str  # LINE, FB, IG, OTHER                      
    received_date: Optional[str] = None     
    repaired_date: Optional[str] = None     
    delivery_date: Optional[str] = None     
    closed: str = 'NO'                      
    note: Optional[str] = ''                
    input_status: Optional[str] = ''        
    created_by_line_id: Optional[str] = 'Unknown'
    created_by_name: Optional[str] = 'Unknown'
    chat_link: Optional[str] = None


@app.get('/api/repair-transactions')
def get_repair_transactions(
    token: Optional[str] = Query(None), 
    authorization: Optional[str] = Header(None)
):
    user = verify_access_and_token(token, authorization)
    return [
        {
            "transaction_id": "REP-202603-001",
            "transaction_type": "REPAIR",
            "product_id": "PROD-005",
            "product": "MacBook Pro M1 - อาการเปิดไม่ติด",
            "customer_name": "ธนกฤต แสงทอง",
            "phone_number": "0853332211",
            "channel": "LINE",
            "current_status": "IN_PROGRESS",
            "closed": "NO",
            "note": "อาการเปิดไม่ติด ช่างกำลังเช็คไอซีระบบไฟ",
            "client_id": user["client_id"],
            "created_at": "2026-03-06T11:00:00Z",
            "updated_at": "2026-03-06T11:00:00Z",
            "created_by_line_id": "U111122223333",
            "created_by_name": "แอดมินเจมส์",
            "updated_by_line_id": "U111122223333",
            "updated_by_name": "แอดมินเจมส์",
            "chat_link": "https://line.me/R/oaMessage/@demo/?thanakrit",
            "transaction_repair": [{
                "transaction_id": "REP-202603-001",
                "received_date": "2026-03-06",
                "repaired_date": None,
                "delivery_date": None,
                "input_status": "รออะไหล่เมนบอร์ด",
                "client_id": user["client_id"],
                "created_at": "2026-03-06T11:00:00Z",
                "updated_at": "2026-03-06T11:00:00Z"
            }]
        }
    ]


@app.post('/api/repair-transactions')
def add_repair_transaction(
    data: RepairTransactionIn, 
    token: Optional[str] = Query(None), 
    authorization: Optional[str] = Header(None)
):
    verify_access_and_token(token, authorization)
    raise HTTPException(status_code=400, detail="[Demo Mode] ไม่สามารถบันทึกงานซ่อมได้ในโหมดทดลอง")


@app.put('/api/repair-transactions/{transaction_id}')
def update_repair_transaction(
    transaction_id: str, 
    data: RepairTransactionIn, 
    token: Optional[str] = Query(None), 
    authorization: Optional[str] = Header(None)
):
    verify_access_and_token(token, authorization)
    raise HTTPException(status_code=400, detail="[Demo Mode] ไม่สามารถอัปเดตงานซ่อมได้ในโหมดทดลอง")


# ==========================================
# 5. TRACKING (พัสดุ)
# ==========================================
class TrackingTransactionIn(BaseModel):
    product: Optional[str] = ''              
    customer_name: str                       
    phone_number: Optional[str] = ''         
    channel: str  # LINE, FB, IG, OTHER                           
    chat_link: Optional[str] = None          
    tracking_number: str                     
    direction: str = 'INBOUND'               
    shipping_date: Optional[str] = None      
    expected_date: Optional[str] = None      
    created_by_line_id: Optional[str] = 'Unknown'
    created_by_name: Optional[str] = 'Unknown'


@app.get('/api/tracking-transactions')
def get_tracking_transactions(
    token: Optional[str] = Query(None), 
    authorization: Optional[str] = Header(None)
):
    user = verify_access_and_token(token, authorization)
    return [
        {
            "transaction_id": "TRK-202603-001",
            "transaction_type": "TRACKING",
            "product_id": None,
            "product": "ส่งสินค้าคืนลูกค้า - แหวนเพชร",
            "customer_name": "กิตติศักดิ์ มั่นคง",
            "phone_number": "0842221100",
            "channel": "LINE",
            "current_status": "IN_TRANSIT",
            "closed": "NO",
            "note": "ส่งคืนสินค้าหลังไถ่ถอน ห่อกันกระแทกอย่างดี",
            "client_id": user["client_id"],
            "created_at": "2026-03-08T15:00:00Z",
            "updated_at": "2026-03-08T15:00:00Z",
            "created_by_line_id": "U111122223333",
            "created_by_name": "แอดมินเจมส์",
            "updated_by_line_id": "U111122223333",
            "updated_by_name": "แอดมินเจมส์",
            "chat_link": "https://line.me/R/oaMessage/@demo/?kittisak",
            "transaction_tracking": [{
                "transaction_id": "TRK-202603-001",
                "tracking_number": "EF123456789TH",
                "direction": "OUTBOUND",
                "shipping_date": "2026-03-08",
                "expected_date": "2026-03-10",
                "thailand_post_status": "อยู่ระหว่างการขนส่ง",
                "client_id": str(user["client_id"]),
                "created_at": "2026-03-08T15:00:00Z",
                "updated_at": "2026-03-08T15:00:00Z"
            }]
        }
    ]


@app.post('/api/tracking-transactions')
def add_tracking_transaction(
    data: TrackingTransactionIn, 
    token: Optional[str] = Query(None), 
    authorization: Optional[str] = Header(None)
):
    verify_access_and_token(token, authorization)
    raise HTTPException(status_code=400, detail="[Demo Mode] ไม่สามารถบันทึกข้อมูลพัสดุได้ในโหมดทดลอง")


@app.put('/api/tracking-transactions/{transaction_id}')
def update_tracking_transaction(
    transaction_id: str, 
    data: TrackingTransactionIn, 
    token: Optional[str] = Query(None), 
    authorization: Optional[str] = Header(None)
):
    verify_access_and_token(token, authorization)
    raise HTTPException(status_code=400, detail="[Demo Mode] ไม่สามารถอัปเดตพัสดุได้ในโหมดทดลอง")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "index:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
