import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div>
      <PageHeader title="Page introuvable" />
      <EmptyState
        icon={<SearchX className="h-5 w-5" />}
        title="Cette page n'existe pas"
        description="L'adresse demandée est introuvable ou vous n'avez pas les droits d'accès."
        action={
          <Button asChild>
            <Link to="/dashboard">Retour au tableau de bord</Link>
          </Button>
        }
      />
    </div>
  );
}
