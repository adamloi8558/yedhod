API สำหรับสร้างและจัดการ QR Code รับเงินผ่านระบบ Anypay

POST
/api/v1/anypay/create
สร้าง Transaction ใหม่พร้อม QR Code สำหรับรับเงินผ่าน Anypay
Request Body
amount
number
จำนวนเงิน (บาท)
bankNumber
string
เลขบัญชีธนาคาร (ตัวเลขเท่านั้น)
webhookUrl
string
URL สำหรับรับแจ้งเตือน events
cURL Example
curl -X POST "https://diamond.shengzhipay.com/api/v1/anypay/create" \
  -H "Authorization: Basic cGdkdWtlOmEwMzc4ZTg4LWJlNmEtNDU3ZC05OWE3LTg5Mzc3ZWEyN2UzNA==" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "bankNumber": "4011999145",
    "webhookUrl": "https://your-website.com/webhook"
  }'

Response (Success - 200)
{
  "success": true,
  "message": "Transaction created",
  "result": {
    "ref": "20241206143000123456",
    "amount": 100,
    "qrText": "...",
    "qrImage": "BASE64_OR_URL",
    "expiresAt": "2024-12-06T15:30:00.000Z"
  }
}

Response (Error)
401
Unauthorized
{ "success": false, "message": "Unauthorized" }

400
Validation Error
{ "success": false, "message": "Validation error", "error": [{ "path": ["bankNumber"], "message": "bankNumber must be digits only" }] }

404
Channel Not Available
{ "success": false, "message": "Anypay channel not available" }

POST
/api/v1/anypay/withdraw
สร้างรายการถอนเงินผ่าน Anypay (โอนเข้าบัญชีธนาคาร)
Request Body
amount
number
จำนวนเงิน (ขั้นต่ำ 100 บาท)
bankNumber
string
เลขบัญชีปลายทาง (ตัวเลขเท่านั้น)
bankCode
string
รหัสธนาคาร เช่น 004 (กสิกร), 014 (ไทยพาณิชย์)
webhookUrl
string (optional)
URL สำหรับรับแจ้งเตือนสถานะการถอนเงิน
Bank Codes
002 - ธนาคารกรุงเทพ (BBL)
004 - ธนาคารกสิกรไทย (KBANK)
006 - ธนาคารกรุงไทย (KTB)
011 - ธนาคารทหารไทยธนชาต (TTB)
014 - ธนาคารไทยพาณิชย์ (SCB)
025 - ธนาคารกรุงศรีอยุธยา (BAY)
030 - ธนาคารออมสิน (GSB)
034 - ธนาคารเพื่อการเกษตร (BAAC)
cURL Example
curl -X POST "https://diamond.shengzhipay.com/api/v1/anypay/withdraw" \
  -H "Authorization: Basic cGdkdWtlOmEwMzc4ZTg4LWJlNmEtNDU3ZC05OWE3LTg5Mzc3ZWEyN2UzNA==" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "bankNumber": "4011999145",
    "bankCode": "004"
  }'

Response (Success - 200)
{
  "success": true,
  "message": "Withdrawal submitted",
  "result": {
    "id": "...",
    "amount": 100,
    "status": "pending",
    "referenceNo": "WDR20240206123456"
  }
}

หมายเหตุ: สถานะจะเป็น pending เสมอหลังส่งคำขอ ระบบจะอัพเดทเป็น completed หรือ rejected เมื่อได้รับการยืนยันจากธนาคาร

Response (Error)
400
Insufficient Balance
{ "success": false, "message": "Insufficient balance" }

400
Validation Error
{ "success": false, "message": "Validation error", "error": [{ "path": ["amount"], "message": "Minimum amount is 100" }] }

GET
/api/v1/anypay/{ref}
ดึงข้อมูล Transaction ตาม Reference ID
Path Parameters
ref
string
Reference ID ของ Transaction
cURL Example
curl -X GET "https://diamond.shengzhipay.com/api/v1/anypay/20241206143000123456" \
  -H "Authorization: Basic cGdkdWtlOmEwMzc4ZTg4LWJlNmEtNDU3ZC05OWE3LTg5Mzc3ZWEyN2UzNA=="

Response (Success - 200)
{
  "success": true,
  "message": "Transaction found",
  "result": {
    "ref": "20241206143000123456",
    "amount": 100,
    "status": "pending",
    "paidAt": null,
    "expiredAt": "2024-12-06T15:30:00.000Z",
    "createdAt": "2024-12-06T14:30:00.000Z",
    "anypayMetadata": {
      "referenceNo": "TRN20240206123456",
      "qrText": "...",
      "qrImage": "BASE64_OR_URL",
      "expiresAt": "2024-12-06T15:30:00.000Z"
    },
    "channel": {
      "id": "...",
      "name": "Anypay",
      "type": "anypay"
    }
  }
}

Withdrawal Webhook
เมื่อระบุ webhookUrl ตอนสร้างรายการถอนเงิน ระบบจะส่ง HTTP POST ไปยัง URL ที่ระบุเมื่อสถานะเปลี่ยน
Webhook Events
completed
ถอนเงินสำเร็จ เงินโอนเข้าบัญชีปลายทางแล้ว
rejected
ถอนเงินล้มเหลว ยอดเงินจะถูกคืนเข้า balance
Request Body
{
  "event": "completed",
  "type": "withdrawal",
  "id": "withdrawal-uuid",
  "amount": 100,
  "status": "completed",
  "method": "bank_transfer",
  "bankCode": "004",
  "bankNumber": "4011999145",
  "processed_at": "2024-12-06T14:35:00.000Z",
  "signature": "sha256hash..."
}

Webhook Fields
event
string
completed หรือ rejected
type
string
ค่าคงที่ "withdrawal"
id
string
Withdrawal ID
amount
number
จำนวนเงิน
status
string
สถานะ (completed / rejected)
method
string
วิธีถอน (bank_transfer)
bankCode
string
รหัสธนาคาร
bankNumber
string
เลขบัญชีปลายทาง
processed_at
string | null
เวลาดำเนินการ (ISO 8601)
signature
string
SHA256(id + ":" + apiKey)
Signature Verification
# signature = SHA256(id + ":" + apiKey)
echo -n "withdrawal-uuid:a0378e88-be6a-457d-99a7-89377ea27e34" | sha256sum