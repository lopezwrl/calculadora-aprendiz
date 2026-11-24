/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        azul: {
          DEFAULT: '#002893',
          escuro: '#001B66',
          profundo: '#061030',
          claro: '#E6EEFC',
        },
        laranja: {
          DEFAULT: '#FD701C',
          hover: '#E55F0E',
          suave: '#FFF2EA',
        },
        branco: '#FFFFFF',
        tinta: '#08122E',
        bg: 'var(--bg-page)',
        surface: 'var(--bg-surface)',
        'surface-subtle': 'var(--bg-surface-subtle)',
        'input-bg': 'var(--bg-input)',
        border: 'var(--border-default)',
        'border-strong': 'var(--border-strong)',
        'border-input': 'var(--border-input)',
        fg: 'var(--text-primary)',
        'fg-muted': 'var(--text-secondary)',
        'fg-subtle': 'var(--text-muted)',
        brand: 'var(--brand-primary)',
        'brand-hover': 'var(--brand-hover)',
        status: {
          success: 'var(--status-success)',
          'success-bg': 'var(--status-success-bg)',
          warning: 'var(--status-warning)',
          'warning-bg': 'var(--status-warning-bg)',
          error: 'var(--status-error)',
          'error-bg': 'var(--status-error-bg)',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"DM Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['12px', { lineHeight: '18px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['20px', { lineHeight: '28px' }],
        xl: ['28px', { lineHeight: '34px' }],
        '2xl': ['38px', { lineHeight: '44px' }],
      },
      maxWidth: {
        layout: '1200px',
      },
    },
  },
  plugins: [],
};
