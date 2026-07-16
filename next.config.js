/** @type {import('next').NextConfig} */
const nextConfig = {
  // เปิดใช้งาน Strict Mode สำหรับช่วยเช็คบั๊กใน React
  reactStrictMode: true,

  // ตั้งค่าเปลี่ยนเส้นทาง (Rewrites) สำหรับการรันบนเครื่องตัวเอง (Local Development)
  async rewrites() {
    return [
      {
        // เมื่อพิมพ์ URL ขึ้นต้นด้วย /api ให้ยิงไปที่ FastAPI หลังบ้าน
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'development'
          ? 'http://127.0.0.1:8000/api/:path*' // รัน Local ให้ชี้ไปที่พอร์ตของ FastAPI
          : '/api/:path*', // บน Vercel ปล่อยให้ระบบของ Vercel คุมผ่าน vercel.json ตามปกติ
      },
    ];
  },
};

module.exports = nextConfig;
