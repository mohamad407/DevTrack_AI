import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';

import DashboardLayout from './components/layout/DashboardLayout.jsx';
import DashboardHome from './pages/dashboard/DashboardHome.jsx';
import ProjectsPage from './pages/dashboard/ProjectsPage.jsx';
import BacklogPage from './pages/dashboard/BacklogPage.jsx';
import SprintsPage from './pages/dashboard/SprintsPage.jsx';
import KanbanPage from './pages/dashboard/KanbanPage.jsx';
import AnalyticsPage from './pages/dashboard/AnalyticsPage.jsx';
import DevOpsPage from './pages/dashboard/DevOpsPage.jsx';
import TeamPage from './pages/dashboard/TeamPage.jsx';
import AIAssistantPage from './pages/dashboard/AIAssistantPage.jsx';
import ProfilePage from './pages/dashboard/ProfilePage.jsx';
import AdminPage from './pages/dashboard/AdminPage.jsx';

import LoadingScreen from './components/common/LoadingScreen.jsx';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId/backlog" element={<BacklogPage />} />
        <Route path="projects/:projectId/sprints" element={<SprintsPage />} />
        <Route path="projects/:projectId/board" element={<KanbanPage />} />
        <Route path="projects/:projectId/analytics" element={<AnalyticsPage />} />
        <Route path="projects/:projectId/devops" element={<DevOpsPage />} />
        <Route path="projects/:projectId/team" element={<TeamPage />} />
        <Route path="ai-assistant" element={<AIAssistantPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
