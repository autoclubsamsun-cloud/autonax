import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.autoclubsamsun.autonax',
  appName: 'AUTONAX',
  webDir: 'public',
  server: {
    url: 'https://autonax.com.tr',
    cleartext: true,
    allowNavigation: ['autonax.com.tr', '*.autonax.com.tr']
  }
};

export default config;
