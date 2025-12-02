import { useEffect, useState } from 'react';

type Props = {
  children: React.ReactNode;
};

export const InstallGate = ({ children }: Props) => {
  const [isStandalone, setIsStandalone] = useState(window.matchMedia('(display-mode: standalone)').matches);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const mm = window.matchMedia('(display-mode: standalone)');
    const listener = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    mm.addEventListener('change', listener);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      mm.removeEventListener('change', listener);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  if (isStandalone) return <>{children}</>;

  return (
    <div className="fixed inset-0 bg-surface-base flex flex-col items-center justify-center gap-6 text-center px-6">
      <h1 className="text-3xl font-semibold">Install BitBeats to continue</h1>
      <p className="text-white/70 max-w-md">
        BitBeats uses advanced PWA features (Service Workers, OPFS) that require an installed experience.
        Install the app to unlock offline vault and background playback.
      </p>
      <button
        onClick={install}
        className="px-6 py-3 rounded-full bg-brand text-black font-semibold disabled:opacity-50"
        disabled={!deferredPrompt}
      >
        {deferredPrompt ? 'Install BitBeats' : 'Installing…'}
      </button>
    </div>
  );
};
