function envLooksPlaceholder(value?: string) {
  if (!value) return true;
  return value.includes('your-') || value.includes('placeholder');
}

export const isDemoMode = envLooksPlaceholder(import.meta.env.VITE_FIREBASE_API_KEY)
  || envLooksPlaceholder(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)
  || import.meta.env.VITE_DEMO_MODE === 'true';
