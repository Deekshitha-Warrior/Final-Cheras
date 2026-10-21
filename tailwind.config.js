/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgMain:    '#FFFFFF', // Clean white background per confirmed theme
        cardBg:    '#FFFFFF', // Crisp white card
        'brand-blue': {
          DEFAULT: '#171717', // Header & Primary maroon
          nav:     '#171717',
          primary: '#171717',
          hover:   '#303030', // Deeper maroon
          light:   '#F5F5F5',
          surface: '#EEEEEE',
        },
        'brand-gold': {
          DEFAULT: '#B8B8B8', // Button & Accent gold
          rich:    '#B8B8B8',
          hover:   '#A3A3A3',
          deep:    '#737373', // Deep Metallic Gold (Text & Borders)
          glow:    '#F5F5F5', // Soft Gold Highlight / Glow
        },
        brand: {
          primary:    '#171717',
          accent:     '#B8B8B8',
          maroon:     '#171717',
          blue:       '#171717',
          blueHover:  '#303030',
          blueLight:  '#F5F5F5',
          gold:       '#B8B8B8',
          goldHover:  '#A3A3A3',
          goldDeep:   '#737373',
          goldLight:  '#F5F5F5',
          goldBorder: '#B8B8B8',
          black:      '#222222', // Main text
          dark:       '#111111',
        },
        gold: {
          DEFAULT: '#B8B8B8',
          dark:    '#737373',
          light:   '#F5F5F5',
          border:  '#D4D4D4',
        },
        maroon: {
          DEFAULT: '#171717',
          dark:    '#303030',
          light:   '#F5F5F5',
          hover:   '#303030',
        },
        textMain:  '#222222', // Confirmed Main text
        textMuted: '#666666', // Slate/neutral 600
        borderLight: '#F3F4F6', // Card borders
      },
      fontFamily: {
        sans:      ['"DM Sans"', '"Outfit"', '"Noto Sans Tamil"', 'system-ui', '-apple-system', 'sans-serif'],
        dmsans:    ['"DM Sans"', 'sans-serif'],
        'dm-sans': ['"DM Sans"', 'sans-serif'],
        outfit:    ['"Outfit"', 'sans-serif'],
        brand:     ['"Cinzel"', '"DM Sans"', '"Outfit"', '"Noto Sans Tamil"', 'serif'],
        headline:  ['"DM Sans"', '"Outfit"', '"Noto Sans Tamil"', 'sans-serif'],
      },
      boxShadow: {
        soft:   '0 1px 3px rgba(0,0,0,0.05)',
        gold:   '0 4px 20px -2px rgba(163, 163, 163, 0.25)',
      },
      borderRadius: {
        'card': '12px',
        'btn': '10px',
        'input': '10px',
        'table': '12px',
      },
      animation: {
        'float': 'float 4s ease-in-out infinite',
        'floatDelay': 'float 4s ease-in-out 1.5s infinite',
        'slideUp': 'slideUp 0.6s ease forwards',
        'fadeIn': 'fadeIn 0.5s ease forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
