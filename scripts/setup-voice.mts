// Configura Telnyx + cloudnumbering para recibir llamadas. Uso: APP_URL=https://novaphone.lat tsx --conditions=react-server scripts/setup-voice.mts [app-only]
import { config } from "dotenv";
config({ path: ".env.local", override: false });
const { ensureTelnyxApp, ensureVoiceRouting } = await import("../src/lib/voice.ts");
console.log(process.argv[2] === "app-only" ? { appId: await ensureTelnyxApp() } : await ensureVoiceRouting());
