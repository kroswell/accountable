import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()], server: { port: Number(process.env.ACCOUNTABLE_WEB_PORT ?? 5173), proxy: { "/api": "http://127.0.0.1:" + (process.env.ACCOUNTABLE_API_PORT ?? 8000) } } });
