import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      visibleToasts={4}
      toastOptions={{ classNames: { toast: 'font-sans text-sm' } }}
    />
  );
}
