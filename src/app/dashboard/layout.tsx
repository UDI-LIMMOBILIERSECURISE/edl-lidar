'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { getSupabase } from '@/lib/supabase'
import {
  LayoutDashboard,
  Video,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Building2,
  Users,
  BarChart3
} from 'lucide-react'
import UsageAlert from '@/components/UsageAlert'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  requiredRoles?: string[]
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Mes visites',
    href: '/dashboard/tours',
    icon: <Video className="w-5 h-5" />,
  },
  {
    label: 'Equipe',
    href: '/dashboard/team',
    icon: <Users className="w-5 h-5" />,
    requiredRoles: ['entity_admin', 'agency_manager'],
  },
  {
    label: 'Agences',
    href: '/dashboard/agencies',
    icon: <Building2 className="w-5 h-5" />,
    requiredRoles: ['entity_admin'],
  },
  {
    label: 'Usage',
    href: '/dashboard/usage',
    icon: <BarChart3 className="w-5 h-5" />,
    requiredRoles: ['entity_admin'],
  },
  {
    label: 'Parametres',
    href: '/dashboard/settings',
    icon: <Settings className="w-5 h-5" />,
  },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  // Fetch user profile to get role
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return

      try {
        const supabase = getSupabase()
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile) {
          setUserRole(profile.role)
        }
      } catch (err) {
        console.error('Error fetching user profile:', err)
      }
    }

    fetchUserProfile()
  }, [user])

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter(item => {
    if (item.requiredRoles && item.requiredRoles.length > 0) {
      return userRole && item.requiredRoles.includes(userRole)
    }
    return true
  })

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-gray-800 border-r border-gray-700
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">EDL LIDAR</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors
                  ${isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }
                `}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            )
          })}
        </nav>

        {/* User section at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-white font-medium">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.email || 'Utilisateur'}
              </p>
              <p className="text-xs text-gray-400 truncate">
                Connecte
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Deconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-gray-800/80 backdrop-blur-sm border-b border-gray-700">
          <div className="h-full px-4 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex-1 lg:flex-none" />

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-400 hidden sm:block">
                {user?.email}
              </span>
              <button
                onClick={handleSignOut}
                className="hidden lg:flex items-center space-x-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Deconnexion</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {/* Usage Alert - visible uniquement pour les admins */}
          {userRole === 'entity_admin' && <UsageAlert />}
          {children}
        </main>
      </div>
    </div>
  )
}
