# Story: MT-3 - Authentification

**Epic**: 6 - Multi-tenant & Auth
**Points**: 3 SP
**Priorite**: P0

## En tant que

Utilisateur inscrit

## Je veux

Me connecter et me deconnecter de la plateforme

## Afin de

Acceder a mes tours et donnees de maniere securisee

## Criteres d'acceptation

- [ ] AC1: Page `/login` accessible sans authentification
- [ ] AC2: Formulaire login avec email et password
- [ ] AC3: Bouton "Mot de passe oublie" fonctionnel
- [ ] AC4: Redirection vers dashboard apres login reussi
- [ ] AC5: Message d'erreur clair si identifiants incorrects
- [ ] AC6: Session persistante (refresh token)
- [ ] AC7: Bouton logout visible dans le header
- [ ] AC8: Logout redirige vers page login
- [ ] AC9: Protection des routes authentifiees (middleware)
- [ ] AC10: Chargement du user_profile dans le contexte apres login

## Taches techniques

- [ ] Task 1: Creer page `src/app/auth/login/page.tsx`
- [ ] Task 2: Creer composant `LoginForm.tsx`
- [ ] Task 3: Creer page `src/app/auth/forgot-password/page.tsx`
- [ ] Task 4: Implementer AuthContext avec user + profile
- [ ] Task 5: Creer middleware de protection des routes
- [ ] Task 6: Ajouter bouton logout dans Header
- [ ] Task 7: Gerer le refresh token automatique
- [ ] Task 8: Tests E2E login/logout

## Notes techniques

### AuthContext

```typescript
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  entity: Entity | null;
  agency: Agency | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entity, setEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ecouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Charger le profil complet
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*, entity:entities(*), agency:agencies(*)')
            .eq('user_id', session.user.id)
            .single();

          setUser(session.user);
          setProfile(profile);
          setEntity(profile?.entity);
        } else {
          setUser(null);
          setProfile(null);
          setEntity(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ...
}
```

### Middleware protection

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  // Routes protegees
  if (req.nextUrl.pathname.startsWith('/dashboard') ||
      req.nextUrl.pathname.startsWith('/tours')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // Routes auth (redirect si deja connecte)
  if (req.nextUrl.pathname.startsWith('/login') ||
      req.nextUrl.pathname.startsWith('/signup')) {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/tours/:path*', '/login', '/signup']
};
```

### Supabase Auth config

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);
```

## Dependencies

- MT-1: Structure multi-tenant (table user_profiles)

## Definition of Done

- [ ] Code complete
- [ ] Tests E2E login/logout passants
- [ ] Middleware fonctionnel
- [ ] Code review fait
- [ ] Documentation mise a jour
