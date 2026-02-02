import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // Routes publiques - pas de protection
  const publicPaths = [
    '/',
    '/login',
    '/signup',
    '/forgot-password',
  ]

  // Prefixes publics
  const publicPrefixes = [
    '/v/',      // Visites publiques
    '/api/',    // API routes
    '/_next/',  // Next.js assets
  ]

  const isPublicPath = publicPaths.includes(pathname)
  const isPublicPrefix = publicPrefixes.some(prefix => pathname.startsWith(prefix))

  // Si route publique, laisser passer
  if (isPublicPath || isPublicPrefix) {
    return response
  }

  // Routes protegees - rediriger vers login si non authentifie
  const protectedPrefixes = [
    '/tours',
    '/dashboard',
  ]

  const isProtectedPath = protectedPrefixes.some(prefix => pathname.startsWith(prefix))

  if (isProtectedPath && !session) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Si authentifie et sur page login/signup, rediriger vers dashboard
  if (session && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
