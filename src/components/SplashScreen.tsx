import logo from '@/assets/logo.jpeg';

const SplashScreen = () => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-500">
        <img
          src={logo}
          alt="CDPNT"
          className="h-32 w-32 rounded-2xl object-contain shadow-md"
        />
        <p className="text-sm text-muted-foreground animate-pulse">Chargement…</p>
      </div>
    </div>
  );
};

export default SplashScreen;
