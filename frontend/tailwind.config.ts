import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#FF6B35',
                    50: '#FFF3EE',
                    100: '#FFE4D9',
                    200: '#FFC7B3',
                    300: '#FFA98C',
                    400: '#FF8A5F',
                    500: '#FF6B35',
                    600: '#E85A27',
                    700: '#C44A1D',
                    800: '#9F3B16',
                    900: '#7A2D11',
                },
                secondary: {
                    DEFAULT: '#2EC4B6',
                    50: '#E8FAF8',
                    100: '#D1F5F1',
                    200: '#A3EBE3',
                    300: '#75E1D5',
                    400: '#47D7C7',
                    500: '#2EC4B6',
                    600: '#25A094',
                    700: '#1C7C72',
                    800: '#135850',
                    900: '#0A342E',
                },
                dark: {
                    bg: '#1A1A2E',
                    surface: '#16213E',
                    card: '#1F2A48',
                    border: '#2D3A5C',
                },
                text: {
                    primary: '#FFFFFF',
                    secondary: '#94A3B8',
                    muted: '#64748B',
                },
            },
            fontFamily: {
                sans: ['Inter', 'Nunito', 'system-ui', 'sans-serif'],
            },
            lineHeight: {
                relaxed: '1.6',
            },
            minHeight: {
                touch: '44px',
            },
            minWidth: {
                touch: '44px',
            },
        },
    },
    plugins: [],
};

export default config;
