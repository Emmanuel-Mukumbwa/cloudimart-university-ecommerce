/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/pages/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#2563EB',     // bright trust blue
          darkBlue: '#1E40AF', // darker blue for accents
          orange: '#F97316',   // primary CTA orange
        },
      },
      borderRadius: {
        '3xl': '1.5rem',
      },
      boxShadow: {
        'soft-lg': '0 10px 30px rgba(2,6,23,0.08)',
      },
    },
  },
  plugins: [],
};
