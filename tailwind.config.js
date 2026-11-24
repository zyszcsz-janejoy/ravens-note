/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F7F4EE',
        card: '#FFFFFF',
        ink: '#2E2A24',
        sub: '#8B8377',
        line: '#E9E3D7',
        pine: {
          DEFAULT: '#2F4B43',
          soft: '#E7EFEA',
          deep: '#243A34',
        },
        clay: {
          DEFAULT: '#BE7057',
          soft: '#F7E9E2',
        },
        sky: {
          DEFAULT: '#54798C',
          soft: '#E9F0F3',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(43,38,32,0.04), 0 10px 28px -18px rgba(43,38,32,0.28)',
      },
      borderRadius: {
        xl2: '18px',
      },
    },
  },
  plugins: [],
}
