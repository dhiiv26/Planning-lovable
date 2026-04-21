import { AlertCircle, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface UpdateDialogProps {
  open: boolean;
  currentVersion: string;
  latestVersion: string;
  apkUrl: string;
}

const UpdateDialog = ({ open, currentVersion, latestVersion, apkUrl }: UpdateDialogProps) => {
  return (
    <Dialog open={open}>
      <DialogContent
        className="[&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <AlertCircle className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Mise à jour disponible</DialogTitle>
          <DialogDescription className="text-center">
            Une nouvelle version de l'application est disponible.
            <br />
            <span className="text-xs">
              Version actuelle : <strong>{currentVersion}</strong> — Nouvelle version :{' '}
              <strong>{latestVersion}</strong>
            </span>
          </DialogDescription>
        </DialogHeader>
        <Button asChild className="w-full" size="lg">
          <a href={apkUrl} target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4" />
            Télécharger la mise à jour
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateDialog;
