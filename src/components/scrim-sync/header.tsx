import { Trophy } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center gap-3">
        <Trophy className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">
          ScrimSync
        </h1>
      </div>
    </header>
  );
}
