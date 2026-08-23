import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom'
import { hasOnboarded, useDeviceStore } from '@/entities/device'
import { DashboardPage } from '@/pages/dashboard'
import { LibraryPage } from '@/pages/library'
import { OnboardingPage } from '@/pages/onboarding'
import { SessionPage } from '@/pages/session'
import { SettingsPage } from '@/pages/settings'
import { AppShell } from './app-shell'

function Layout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

/**
 * A first-time visitor meets the setup flow rather than an empty dashboard
 * (§12). Only this route redirects — every other URL stays directly reachable,
 * so a shared link never drops someone into onboarding.
 */
function HomeRoute() {
  const onboarded = useDeviceStore(hasOnboarded)
  return onboarded ? <DashboardPage /> : <Navigate to="/onboarding" replace />
}

/**
 * Routes from §12. The basename comes from Vite's `BASE_URL`, so the same
 * build works at the domain root and under the GitHub Pages project path.
 */
const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      // A bad URL is not worth a crash screen — send them home.
      errorElement: <Navigate to="/" replace />,
      children: [
        { index: true, element: <HomeRoute /> },
        { path: 'onboarding', element: <OnboardingPage /> },
        { path: 'library', element: <LibraryPage /> },
        { path: 'session', element: <SessionPage /> },
        { path: 'session/:drillId', element: <SessionPage /> },
        { path: 'settings', element: <SettingsPage /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
)

export function AppRouter() {
  return <RouterProvider router={router} />
}
