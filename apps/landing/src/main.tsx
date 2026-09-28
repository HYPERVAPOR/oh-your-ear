import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'

import './i18n'
import './index.css'

import { ThemeProvider } from '@oh-your-ear/shared/theme'
import App from './App.tsx'

// The console is where the people who write a good bug report live, so the address is
// here too. English: this line is aimed at whoever opens the console, not at the reader
// of the page (PRD 7.5 keeps the machine-facing layer in one language).
console.log(
  '%cOh Your Ear%c  bugs and feature requests → me@hypervapor.org',
  'font:600 13px monospace',
  'font:12px monospace',
)

// Hydrated, not created: the page in `dist/index.html` was rendered at build time, and
// `createRoot` would throw that markup away and draw it again (PRD 7.5). What is written
// here has to match what `entry-server.tsx` renders, or React tears the tree down.
hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
