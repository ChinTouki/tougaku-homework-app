/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#ffb400" }, // 之后可以当作品牌色用
      },
    },
  },
  plugins: [],
};
