/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // 🌟 เพิ่มบรรทัดนี้ เพื่อให้ Tailwind วิ่งไปอ่านโค้ด React ทุกตัวในโฟลเดอร์ src
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    
    // เก็บของเดิมไว้เผื่อมีการขยับขยาย
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
