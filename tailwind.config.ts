import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        nathai: {
          blue: '#1466FF',
          cyan: '#00C6F0',
          ink: '#0B1830',
          paper: '#F5F7FB',
          mist: '#E4EAF5',
          signal: '#22D3A5',
          amber: '#F5A623',
        },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-technical)'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #1466FF 0%, #00C6F0 100%)',
      },
      boxShadow: {
        button: '0 4px 14px 0 rgba(20, 102, 255, 0.25)',
        'button-hover': '0 6px 20px 0 rgba(20, 102, 255, 0.35)',
        card: '0 1px 3px 0 rgba(11, 24, 48, 0.06), 0 1px 2px -1px rgba(11, 24, 48, 0.06)',
        'card-hover': '0 12px 30px -12px rgba(20, 102, 255, 0.3)',
      },
    },
  },
  plugins: [],
};

export default config;
