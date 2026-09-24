import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
