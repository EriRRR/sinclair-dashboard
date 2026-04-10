import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/sinclair-dashboard/', // DEBE ser el nombre exacto de tu repositorio
})