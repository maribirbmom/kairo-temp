/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'page-bg': '#EBE8E3',
        'card-bg': '#FAF9F6',
        'text-main': '#292524',
        'text-muted': '#78716C',
        'primary': '#E06F4F',
        'primary-hover': '#C95D3F',
        'dark-accent': '#1C1917',
        'ui-element': '#E5E0DC',
        'success': '#4A7C59',
        'warning': '#D97706',
        'danger': '#DC2626',
      },
      fontFamily: {
        'display': ['Manrope', 'sans-serif'],
      },
      borderRadius: {
        'DEFAULT': '0.5rem',
        'lg': '1rem',
        'xl': '1.25rem',
        '2xl': '2rem',
        '3xl': '2.5rem',
      },
      boxShadow: {
        'soft': '0 20px 40px -12px rgba(44, 39, 36, 0.06)',
        'inner-light': 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.6)',
        'floating': '0 10px 30px -5px rgba(28, 25, 23, 0.15)',
        'sidebar': '0 4px 20px rgba(0,0,0,0.05)',
      },
    },
  },
  plugins: [],
}
