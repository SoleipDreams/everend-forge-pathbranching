import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    // 5173/5174 are reserved on the Windows development machine by an
    // excluded TCP range. Keep the standalone default aligned with Tauri.
    port: Number(process.env.PORT) || 5374,
    strictPort: true,
    watch: {
      // Rust changes are rebuilt and reloaded by `tauri dev`, not Vite.
      ignored: ["**/src-tauri/**"],
    },
  },
});
