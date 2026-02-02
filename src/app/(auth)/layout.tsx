import { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white">
          EDL <span className="text-blue-500">LIDAR</span>
        </h1>
        <p className="text-gray-400 mt-2">Visites virtuelles intelligentes</p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md">
        <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-8">
          {children}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-gray-500 text-sm">
        &copy; {new Date().getFullYear()} EDL LIDAR. Tous droits reserves.
      </p>
    </div>
  )
}
