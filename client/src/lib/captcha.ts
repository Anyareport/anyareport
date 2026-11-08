declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

// Resolves to null when reCAPTCHA isn't configured, matching the server, which skips the check then.
export async function getCaptchaToken(action: string): Promise<string | null> {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (!siteKey || siteKey.includes('your-recaptcha')) return null;

  const run = () =>
    new Promise<string>((resolve, reject) => {
      window.grecaptcha!.ready(() => {
        window.grecaptcha!.execute(siteKey, { action }).then(resolve, reject);
      });
    });

  if (window.grecaptcha) return run();

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the spam check. Please try again.'));
    document.head.appendChild(script);
  });
  return run();
}