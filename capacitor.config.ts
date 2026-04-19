import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.f2e1e4c78c354f30aa3eabb0d367d8a8',
  appName: 'CDPNT Planning',
  webDir: 'dist',
  server: {
    url: 'https://f2e1e4c7-8c35-4f30-aa3e-abb0d367d8a8.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#C8102E',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
