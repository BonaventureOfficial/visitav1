import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.visita.android",
  appName: "Visita",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
};

export default config;
