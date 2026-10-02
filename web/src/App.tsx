import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { PublicOnly, RequireBuyer, RequireRealtor, RequireSession, RequireSuperAdmin } from '@/components/RouteGuards'
import { AdminPage } from '@/pages/AdminPage'
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage } from '@/pages/auth/AuthPages'
import { OnboardingPage } from '@/pages/auth/OnboardingPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ClientsPage } from '@/pages/clients/ClientsPage'
import { ClientFormPage } from '@/pages/clients/ClientFormPage'
import { ClientProfilePage } from '@/pages/clients/ClientProfilePage'
import { PropertiesPage } from '@/pages/properties/PropertiesPage'
import { PropertyFormPage } from '@/pages/properties/PropertyFormPage'
import { PropertyProfilePage } from '@/pages/properties/PropertyProfilePage'
import { ToursPage } from '@/pages/tours/ToursPage'
import { TourFormPage } from '@/pages/tours/TourFormPage'
import { TourDetailPage } from '@/pages/tours/TourDetailPage'
import { ShowingModePage } from '@/pages/showings/ShowingModePage'
import { ShowingCompletePage } from '@/pages/showings/ShowingCompletePage'
import { TasksPage } from '@/pages/TasksPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { BillingPage } from '@/pages/BillingPage'
import { TeamPage } from '@/pages/TeamPage'
import { PrivacyPage, TermsPage } from '@/pages/LegalPages'
import { JoinTeamPage } from '@/pages/auth/JoinTeamPage'
import { ComingSoonPage } from '@/pages/ComingSoonPage'
import { PortalJoinPage } from '@/pages/portal/PortalJoinPage'
import { PortalLayout } from '@/pages/portal/PortalLayout'
import { PortalCompare, PortalHome, PortalMessages, PortalProperties, PortalTours } from '@/pages/portal/PortalPages'
import { PortalPropertyPage } from '@/pages/portal/PortalPropertyPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ComparePage } from '@/pages/ComparePage'
import { MessagesPage } from '@/pages/MessagesPage'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/portal/join" element={<PortalJoinPage />} />
      <Route path="/join" element={<JoinTeamPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route element={<RequireSession />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Route>
      <Route element={<RequireBuyer />}>
        <Route path="/portal" element={<PortalLayout />}>
          <Route index element={<PortalHome />} />
          <Route path="properties" element={<PortalProperties />} />
          <Route path="properties/:id" element={<PortalPropertyPage />} />
          <Route path="tours" element={<PortalTours />} />
          <Route path="compare" element={<PortalCompare />} />
          <Route path="messages" element={<PortalMessages />} />
        </Route>
      </Route>

      <Route element={<RequireRealtor />}>
        {/* Showing Mode is full-screen, outside the shell */}
        <Route path="/showings/:id" element={<ShowingModePage />} />
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/new" element={<ClientFormPage />} />
          <Route path="clients/:id" element={<ClientProfilePage />} />
          <Route path="clients/:id/edit" element={<ClientFormPage />} />
          <Route path="properties" element={<PropertiesPage />} />
          <Route path="properties/new" element={<PropertyFormPage />} />
          <Route path="properties/:id" element={<PropertyProfilePage />} />
          <Route path="properties/:id/edit" element={<PropertyFormPage />} />
          <Route path="tours" element={<ToursPage />} />
          <Route path="tours/new" element={<TourFormPage />} />
          <Route path="tours/:id" element={<TourDetailPage />} />
          <Route path="showings/:id/complete" element={<ShowingCompletePage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/billing" element={<BillingPage />} />
          <Route path="settings/team" element={<TeamPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="offers" element={<ComingSoonPage feature="offers" />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="reports" element={<ComingSoonPage feature="reports" />} />
          <Route path="integrations" element={<ComingSoonPage feature="integrations" />} />
          <Route element={<RequireSuperAdmin />}>
            <Route path="admin" element={<AdminPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
