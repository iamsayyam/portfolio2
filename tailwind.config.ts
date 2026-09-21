import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#24211D',
        paper: '#EFEBDD',
        sand: '#B9AF92',
        sun: '#F2E320',
        gold: '#DCAE1F',
        charcoal: '#2B2724',
        pill: '#F3F0E8',
      },
      fontFamily: {
        display: ['"Outfit Variable"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
