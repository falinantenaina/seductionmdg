import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ROLE_LABELS } from '@/lib/constants';
import logo from '@/assets/logo.jpg';
import type { Role } from '@/types';

const loginSchema = z.object({
  email: z.email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

type LoginValues = z.infer<typeof loginSchema>;

const DEMO_ACCOUNTS: Array<{ role: Role; email: string }> = [
  { role: 'ADMIN', email: 'admin@seduction.cd' },
  { role: 'COMMERCIAL', email: 'commercial@seduction.cd' },
  { role: 'FACTURIER', email: 'facturier@seduction.cd' },
  { role: 'MAGASINIER', email: 'magasinier@seduction.cd' },
  { role: 'DISPATCHER', email: 'dispatcher@seduction.cd' },
  { role: 'LIVREUR', email: 'livreur@seduction.cd' },
];

export function LoginPage() {
  const token = useAuthStore((state) => state.token);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: LoginValues) => login(values.email, values.password),
    onSuccess: (user) => {
      toast.success(`Bienvenue ${user.firstName} !`);
      navigate(from, { replace: true });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (token) return <Navigate to={from} replace />;

  const onSubmit = (values: LoginValues) => mutation.mutate(values);

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0a4a57] via-[#0e6e7d] to-[#0f7d8f] p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#c9a227]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-12 h-64 w-64 rounded-full bg-white/5 blur-3xl" />

        <div className="relative w-64 rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-white/40">
          <img
            src={logo}
            alt="Séduction MdG — Votre destination Fashion"
            className="w-full rounded-xl"
            width={960}
            height={781}
          />
        </div>

        <div className="relative space-y-5">
          <h1 className="text-3xl font-semibold leading-tight">
            Gestion commerciale, stock,
            <br />
            facturation et livraison.
          </h1>
          <p className="max-w-md text-sm text-white/75">
            Un seul système pour les commerciaux, le facturier, le magasin, le dispatch et les livreurs — avec un
            stock physique et virtuel toujours cohérent.
          </p>
          <div className="h-px w-24 bg-gradient-to-r from-[#c9a227] to-transparent" />
        </div>

        <p className="relative text-xs text-white/60">Espace sécurisé — veuillez saisir vos identifiants.</p>
      </div>

      <div className="flex w-full flex-col items-center justify-center gap-6 p-6 lg:w-1/2">
          <div className="flex w-full justify-center lg:hidden">
            <img
              src={logo}
              alt="Séduction MdG — Votre destination Fashion"
              className="w-56 rounded-2xl border bg-white shadow-sm"
              width={960}
              height={781}
            />
          </div>

        <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-xl">Connexion</CardTitle>
              <CardDescription>Accédez à votre espace de travail</CardDescription>
            </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="vous@entreprise.mg"
                  {...register('email')}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Mot de passe</Label>
                <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>

              <Button type="submit" className="w-full" loading={mutation.isPending}>
                <LogIn className="h-4 w-4" />
                Se connecter
              </Button>
            </form>

            <div className="mt-6">
              <div className="relative mb-3">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Comptes de démonstration
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {DEMO_ACCOUNTS.map((account) => (
                  <Button
                    key={account.email}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 justify-start text-xs"
                    onClick={() => {
                      setValue('email', account.email, { shouldValidate: true });
                      setValue('password', 'Demo1234!', { shouldValidate: true });
                    }}
                  >
                    {ROLE_LABELS[account.role]}
                  </Button>
                ))}
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">Mot de passe : Demo1234!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
