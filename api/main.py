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
    # ปลดล็อกระบบ Token validation เพื่อให้ Demo UI ใช้งานได้โดยไม่ต้องมี Token จริง
    return {"client_id": 1}


@app.get("/api/config/liff-id")
def get_liff_config():
    return {"liff_id": os.environ.get("LIFF_ID", "1234567890-DEMO")}


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
    decoded_tx_id = urllib.parse.unquote(tx_id)
    return [{
        "transaction_id": decoded_tx_id,
        "transaction_type": "PAWN",
        "client_id": 1,
        "customer_name": "สมชาย ใจดี",
        "phone_number": "081-234-5678",
        "channel": "LINE",
        "current_status": "ACTIVE",
        "closed": "NO",
        "note": "ต่อดอกเบี้ยเรียบร้อยแล้วรอบที่ 2",
        "created_at": "2026-03-01T10:00:00Z",
        "created_by_line_id": "U111122223333",
        "created_by_name": "แอดมินเจมส์",
        "chat_link": "https://line.me/R/oaMessage/@demo/?somchai",
        "product": "ทองคำแท่ง 1 บาท",
        "products": {"product_detail": "ทองคำแท่ง 96.5% น้ำหนัก 15.16 กรัม"},
        "transaction_pawn": [{
            "pawn_amount": 35000.0,
            "interest_per_month": 1050.0,
            "next_due_date": "2026-04-01",
            "last_paid_date": "2026-03-01",
            "input_status": "ต่อดอกแล้ว"
        }]
    }]


@app.get('/api/pawn-transactions')
def get_pawn_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    return [
        {
            "transaction_id": "PW-202603-001",
            "transaction_type": "PAWN",
            "client_id": 1,
            "customer_name": "สมชาย ใจดี",
            "phone_number": "081-234-5678",
            "channel": "LINE",
            "current_status": "ACTIVE",
            "closed": "NO",
            "note": "ลูกค้าแจ้งต่อดอกทุกวันที่ 1 ของเดือน",
            "created_at": "2026-03-01T10:00:00Z",
            "created_by_line_id": "U111122223333",
            "created_by_name": "แอดมินเจมส์",
            "chat_link": "https://line.me/R/oaMessage/@demo/?somchai",
            "product": "ทองคำแท่ง 1 บาท",
            "products": {"product_detail": "ทองคำแท่ง 96.5% น้ำหนัก 15.16 กรัม"},
            "transaction_pawn": [{
                "pawn_amount": 35000.0,
                "interest_per_month": 1050.0,
                "next_due_date": "2026-04-01",
                "input_status": "ปกติ"
            }]
        },
        {
            "transaction_id": "PW-202603-002",
            "transaction_type": "PAWN",
            "client_id": 1,
            "customer_name": "นภา รุ่งเรือง",
            "phone_number": "089-876-5432",
            "channel": "Facebook",
            "current_status": "EXPIRED",
            "closed": "NO",
            "note": "เกินกำหนดชำระแล้ว อยู่ระหว่างส่ง LINE ตาม",
            "created_at": "2026-02-15T14:30:00Z",
            "created_by_line_id": "U444455556666",
            "created_by_name": "แอดมินเมย์",
            "chat_link": "https://m.me/demo.shop",
            "product": "iPhone 15 Pro Max 256GB",
            "products": {"product_detail": "iPhone 15 Pro Max สี Natural Titanium สภาพ 95%"},
            "transaction_pawn": [{
                "pawn_amount": 28000.0,
                "interest_per_month": 840.0,
                "next_due_date": "2026-03-15",
                "input_status": "ค้างชำระ"
            }]
        },
        {
            "transaction_id": "PW-202602-008",
            "transaction_type": "PAWN",
            "client_id": 1,
            "customer_name": "ณรงค์เดช โชคดี",
            "phone_number": "086-111-2244",
            "channel": "หน้าร้าน",
            "current_status": "REDEEMED",
            "closed": "YES",
            "note": "ไถ่ถอนคืนสินค้าเรียบร้อยแล้ว จ่ายเงินสด",
            "created_at": "2026-02-01T11:00:00Z",
            "created_by_line_id": "U111122223333",
            "created_by_name": "แอดมินเจมส์",
            "chat_link": None,
            "product": "MacBook Air M2",
            "products": {"product_detail": "MacBook Air M2 Space Gray RAM 8GB SSD 256GB"},
            "transaction_pawn": [{
                "pawn_amount": 18000.0,
                "interest_per_month": 540.0,
                "next_due_date": "2026-03-01",
                "input_status": "ไถ่ถอนแล้ว"
            }]
        }
    ]


@app.post('/api/pawn-transactions')
def add_pawn_transaction(payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถเพิ่มข้อมูลจำนำได้ในโหมดนี้"
    )


@app.put('/api/pawn-transactions/{transaction_id}')
def update_pawn_transaction(transaction_id: str, payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถแก้ไขข้อมูลจำนำได้ในโหมดนี้"
    )


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


@app.get('/api/installment-transactions/{tx_id}')
def get_single_transaction(tx_id: str, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    return {
        "transaction_id": tx_id,
        "transaction_type": "INSTALLMENT",
        "client_id": 1,
        "customer_name": "วิชัย มีสุข",
        "phone_number": "082-111-2233",
        "channel": "หน้าร้าน",
        "current_status": "IN_PROGRESS",
        "closed": "NO",
        "note": "จ่ายตรงเวลาทุกงวด",
        "created_at": "2026-01-10T11:20:00Z",
        "created_by_line_id": "U444455556666",
        "created_by_name": "แอดมินเมย์",
        "chat_link": None,
        "product": "iPad Air 5 64GB Wi-Fi",
        "products": {"product_detail": "iPad Air 5 64GB Wi-Fi"},
        "transaction_installment": [{
            "total_amount": 20000.0,
            "installment_amount": 2000.0,
            "total_periods": 10,
            "current_period": 3,
            "next_due_date": "2026-04-10",
            "input_status": "กำลังผ่อน"
        }]
    }


@app.get('/api/installment-transactions')
def get_installment_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    return [
        {
            "transaction_id": "INS-202601-001",
            "transaction_type": "INSTALLMENT",
            "client_id": 1,
            "customer_name": "วิชัย มีสุข",
            "phone_number": "082-111-2233",
            "channel": "หน้าร้าน",
            "current_status": "IN_PROGRESS",
            "closed": "NO",
            "note": "ขอโอนจ่ายทุกวันที่ 10 ของเดือน",
            "created_at": "2026-01-10T11:20:00Z",
            "created_by_line_id": "U444455556666",
            "created_by_name": "แอดมินเมย์",
            "chat_link": None,
            "product": "iPad Air 5 64GB Wi-Fi",
            "products": {"product_detail": "iPad Air 5 64GB Wi-Fi สี Space Gray"},
            "transaction_installment": [{
                "total_amount": 20000.0,
                "installment_amount": 2000.0,
                "total_periods": 10,
                "current_period": 3,
                "next_due_date": "2026-04-10",
                "input_status": "กำลังผ่อน"
            }]
        },
        {
            "transaction_id": "INS-202511-005",
            "transaction_type": "INSTALLMENT",
            "client_id": 1,
            "customer_name": "กมลวรรณ สุขสันต์",
            "phone_number": "086-555-4433",
            "channel": "LINE",
            "current_status": "COMPLETED",
            "closed": "YES",
            "note": "ผ่อนครบแล้ว ส่งมอบเครื่องเรียบร้อย",
            "created_at": "2025-11-01T09:00:00Z",
            "created_by_line_id": "U111122223333",
            "created_by_name": "แอดมินเจมส์",
            "chat_link": "https://line.me/R/oaMessage/@demo/?kamonwan",
            "product": "Samsung Galaxy S24 Ultra",
            "products": {"product_detail": "Samsung S24 Ultra 512GB"},
            "transaction_installment": [{
                "total_amount": 42000.0,
                "installment_amount": 7000.0,
                "total_periods": 6,
                "current_period": 6,
                "next_due_date": "2026-04-01",
                "input_status": "ผ่อนครบแล้ว"
            }]
        },
        {
            "transaction_id": "INS-202602-012",
            "transaction_type": "INSTALLMENT",
            "client_id": 1,
            "customer_name": "ธีรภาพ ใจมั่น",
            "phone_number": "089-333-7788",
            "channel": "Instagram",
            "current_status": "OVERDUE",
            "closed": "NO",
            "note": "ค่างวดที่ 2 ช้าไป 5 วัน แอดมินทักไลน์ตามแล้ว",
            "created_at": "2026-02-05T14:00:00Z",
            "created_by_line_id": "U777788889999",
            "created_by_name": "แอดมินนิว",
            "chat_link": "https://ig.me/m/demo.shop",
            "product": "Apple Watch Ultra 2",
            "products": {"product_detail": "Apple Watch Ultra 2 สาย Titanium"},
            "transaction_installment": [{
                "total_amount": 29000.0,
                "installment_amount": 2900.0,
                "total_periods": 10,
                "current_period": 1,
                "next_due_date": "2026-03-05",
                "input_status": "ค้างชำระ"
            }]
        }
    ]


@app.post('/api/installment-transactions')
def create_installment_transactions(data: InstallmentTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถสร้างสัญญาผ่อนชำระได้ในโหมดนี้"
    )


@app.put('/api/installment-transactions/{tx_id}')
def update_installment_payment(tx_id: str, payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถบันทึกค่างวดได้ในโหมดนี้"
    )


@app.post('/api/installment-transactions/{tx_id}/void')
def void_entire_contract(tx_id: str, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถยกเลิกสัญญาได้ในโหมดนี้"
    )


@app.post('/api/installment-transactions/{tx_id}/payoff')
def payoff_entire_contract(tx_id: str, payload: dict = Body(...), token: Optional[str] = None, admin_line_id: Optional[str] = None):
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถปิดยอดสัญญาก่อนกำหนดได้ในโหมดนี้"
    )


# API มัดจำ
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


@app.get('/api/deposit-transactions')
def get_deposit_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    return [
        {
            "transaction_id": "DEP-202603-001",
            "transaction_type": "DEPOSIT",
            "client_id": 1,
            "customer_name": "อนันต์ รักดี",
            "phone_number": "083-999-8877",
            "channel": "Facebook",
            "current_status": "WAITING_PAYMENT",
            "closed": "NO",
            "note": "วางมัดจำไว้ก่อน นัดมารับของหน้าร้านวันที่ 20",
            "created_at": "2026-03-05T13:15:00Z",
            "created_by_line_id": "U777788889999",
            "created_by_name": "แอดมินนิว",
            "chat_link": "https://m.me/demo.shop",
            "product": "กระเป๋า Brandname Chanel Classic 10\"",
            "transaction_deposit": [{
                "deposit_amount": 5000.0,
                "remaining_balance": 45000.0,
                "due_date": "2026-03-20",
                "closed": "NO",
                "input_status": "รอมารับสินค้า"
            }]
        },
        {
            "transaction_id": "DEP-202603-002",
            "transaction_type": "DEPOSIT",
            "client_id": 1,
            "customer_name": "ปิยะดา สวยงาม",
            "phone_number": "087-444-1122",
            "channel": "Instagram",
            "current_status": "CLOSED",
            "closed": "YES",
            "note": "ชำระส่วนที่เหลือเรียบร้อย จัดส่งพัสดุแล้ว",
            "created_at": "2026-03-02T16:00:00Z",
            "created_by_line_id": "U111122223333",
            "created_by_name": "แอดมินเจมส์",
            "chat_link": "https://ig.me/m/demo.shop",
            "product": "นาฬิกา Rolex Datejust 36mm",
            "transaction_deposit": [{
                "deposit_amount": 20000.0,
                "remaining_balance": 0.0,
                "due_date": "2026-03-08",
                "closed": "YES",
                "input_status": "จ่ายครบแล้ว"
            }]
        },
        {
            "transaction_id": "DEP-202602-005",
            "transaction_type": "DEPOSIT",
            "client_id": 1,
            "customer_name": "ศรัณย์ เปรมปรีดิ์",
            "phone_number": "085-222-3311",
            "channel": "LINE",
            "current_status": "CANCELLED",
            "closed": "YES",
            "note": "ยิบบริบเงินมัดจำ เนื่องจากเกินกำหนดนัดชำระ 14 วัน",
            "created_at": "2026-02-10T10:00:00Z",
            "created_by_line_id": "U444455556666",
            "created_by_name": "แอดมินเมย์",
            "chat_link": "https://line.me/R/oaMessage/@demo/?saran",
            "product": "PlayStation 5 Slim Digital",
            "transaction_deposit": [{
                "deposit_amount": 2000.0,
                "remaining_balance": 12000.0,
                "due_date": "2026-02-24",
                "closed": "YES",
                "input_status": "ยกเลิก/หลุดมัดจำ"
            }]
        }
    ]


@app.post('/api/deposit-transactions')
def add_deposit_transaction(data: DepositTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถบันทึกข้อมูลมัดจำได้ในโหมดนี้"
    )


@app.put('/api/deposit-transactions/{transaction_id}')
def update_deposit_transaction(transaction_id: str, data: DepositTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถอัปเดตข้อมูลมัดจำได้ในโหมดนี้"
    )


# API งานซ่อม
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


@app.get('/api/repair-transactions')
def get_repair_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    return [
        {
            "transaction_id": "REP-202603-001",
            "transaction_type": "REPAIR",
            "client_id": 1,
            "customer_name": "ธนกฤต แสงทอง",
            "phone_number": "085-333-2211",
            "channel": "LINE",
            "current_status": "IN_PROGRESS",
            "closed": "NO",
            "note": "อาการเปิดไม่ติด ช่างกำลังเช็คไอซีระบบไฟ",
            "created_at": "2026-03-06T11:00:00Z",
            "created_by_line_id": "U111122223333",
            "created_by_name": "แอดมินเจมส์",
            "chat_link": "https://line.me/R/oaMessage/@demo/?thanakrit",
            "product": "MacBook Pro M1 - อาการเปิดไม่ติด",
            "transaction_repair": [{
                "received_date": "2026-03-06",
                "repaired_date": None,
                "delivery_date": None,
                "input_status": "รออะไหล่เมนบอร์ด",
                "closed": "NO"
            }]
        },
        {
            "transaction_id": "REP-202603-002",
            "transaction_type": "REPAIR",
            "client_id": 1,
            "customer_name": "พิมพ์มาดา สุขใจ",
            "phone_number": "088-777-6655",
            "channel": "หน้าร้าน",
            "current_status": "COMPLETED",
            "closed": "YES",
            "note": "เปลี่ยนจอแท้ศูนย์ ประกันงานซ่อม 90 วัน",
            "created_at": "2026-03-01T09:30:00Z",
            "created_by_line_id": "U444455556666",
            "created_by_name": "แอดมินเมย์",
            "chat_link": None,
            "product": "เปลี่ยนหน้าจอ iPhone 13 Pro",
            "transaction_repair": [{
                "received_date": "2026-03-01",
                "repaired_date": "2026-03-02",
                "delivery_date": "2026-03-03",
                "input_status": "ซ่อมเสร็จส่งคืนลูกค้าแล้ว",
                "closed": "YES"
            }]
        },
        {
            "transaction_id": "REP-202602-009",
            "transaction_type": "REPAIR",
            "client_id": 1,
            "customer_name": "ชยพล เจริญสุข",
            "phone_number": "081-666-5544",
            "channel": "Facebook",
            "current_status": "TESTING",
            "closed": "NO",
            "note": "ซ่อมบอร์ดเสร็จแล้ว อยู่ระหว่างการทดสอบ QC 24 ชม.",
            "created_at": "2026-02-28T15:20:00Z",
            "created_by_line_id": "U777788889999",
            "created_by_name": "แอดมินนิว",
            "chat_link": "https://m.me/demo.shop",
            "product": "iPad Pro 11\" โดนน้ำ ล้างบอร์ด",
            "transaction_repair": [{
                "received_date": "2026-02-28",
                "repaired_date": "2026-03-08",
                "delivery_date": None,
                "input_status": "กำลัง QC เครื่อง",
                "closed": "NO"
            }]
        }
    ]


@app.post('/api/repair-transactions')
def add_repair_transaction(data: RepairTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถบันทึกงานซ่อมได้ในโหมดนี้"
    )


@app.put('/api/repair-transactions/{transaction_id}')
def update_repair_transaction(transaction_id: str, data: RepairTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถอัปเดตงานซ่อมได้ในโหมดนี้"
    )


# API Tracking
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


@app.get('/api/tracking-transactions')
def get_tracking_transactions(token: Optional[str] = None, admin_line_id: Optional[str] = None):
    return [
        {
            "transaction_id": "TRK-202603-001",
            "transaction_type": "TRACKING",
            "client_id": 1,
            "customer_name": "กิตติศักดิ์ มั่นคง",
            "phone_number": "084-222-1100",
            "channel": "LINE",
            "closed": "NO",
            "note": "ส่งคืนสินค้าหลังไถ่ถอน ห่อกันกระแทกอย่างดี",
            "created_at": "2026-03-08T15:00:00Z",
            "created_by_line_id": "U111122223333",
            "created_by_name": "แอดมินเจมส์",
            "chat_link": "https://line.me/R/oaMessage/@demo/?kittisak",
            "product": "ส่งสินค้าคืนลูกค้า - แหวนเพชร",
            "thailand_post_view": [{
                "tracking_number": "EF123456789TH",
                "direction": "OUTBOUND",
                "shipping_date": "2026-03-08",
                "expected_date": "2026-03-10",
                "is_delivered": "NO",
                "status_description": "อยู่ระหว่างการขนส่ง"
            }]
        },
        {
            "transaction_id": "TRK-202603-002",
            "transaction_type": "TRACKING",
            "client_id": 1,
            "customer_name": "ศิริพร บุญส่ง",
            "phone_number": "081-999-0011",
            "channel": "Facebook",
            "closed": "YES",
            "note": "พัสดุถึงร้านแล้ว ตรวจสอบสภาพเครื่องสมบูรณ์ดี",
            "created_at": "2026-03-04T10:00:00Z",
            "created_by_line_id": "U444455556666",
            "created_by_name": "แอดมินเมย์",
            "chat_link": "https://m.me/demo.shop",
            "product": "ลูกค้านำเครื่องส่งมาจำนำ",
            "thailand_post_view": [{
                "tracking_number": "ED987654321TH",
                "direction": "INBOUND",
                "shipping_date": "2026-03-04",
                "expected_date": "2026-03-06",
                "is_delivered": "YES",
                "status_description": "นำจ่ายสำเร็จ"
            }]
        },
        {
            "transaction_id": "TRK-202603-003",
            "transaction_type": "TRACKING",
            "client_id": 1,
            "customer_name": "วรวุฒิ สุวรรณ",
            "phone_number": "089-111-9988",
            "channel": "Instagram",
            "closed": "NO",
            "note": "จัดส่งอะไหล่จอไปให้ลูกค้าต่างจังหวัด",
            "created_at": "2026-03-07T12:00:00Z",
            "created_by_line_id": "U777788889999",
            "created_by_name": "แอดมินนิว",
            "chat_link": "https://ig.me/m/demo.shop",
            "product": "จัดส่งสินค้าผ่อนชำระ - iPad Gen 10",
            "thailand_post_view": [{
                "tracking_number": "TH0123456789A",
                "direction": "OUTBOUND",
                "shipping_date": "2026-03-07",
                "expected_date": "2026-03-09",
                "is_delivered": "NO",
                "status_description": "เตรียมการนำจ่าย"
            }]
        }
    ]


@app.post('/api/tracking-transactions')
def add_tracking_transaction(data: TrackingTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
    raise HTTPException(
        status_code=400, 
        detail="[Demo Mode] ระบบทดลองใช้งาน: ไม่สามารถบันทึกข้อมูลพัสดุได้ในโหมดนี้"
    )


@app.put('/api/tracking-transactions/{transaction_id}')
def update_tracking_transaction(transaction_id: str, data: TrackingTransactionIn, token: Optional[str] = None, admin_line_id: Optional[str] = None):
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
