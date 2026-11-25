import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = { appId: 'com.paluwagan.app', appName: 'Paluwagan', webDir: 'dist', server: { androidScheme: 'https' }, plugins: { CapacitorUpdater: { autoUpdate: false, appReadyTimeout: 15000, resetWhenUpdate: true } } };
export default config;
