import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Auth from './components/Auth';
import Home from './components/Home';
import CVUpload from './components/CVUpload';
import CVEdit from './components/CVEdit';
import CVImprovement from './components/CVImprovement';
import JobApplication from './components/JobApplication';
import ProfessionalDevelopment from './components/ProfessionalDevelopment';
import AdminDashboard from './components/AdminDashboard';
import UserProfile from './components/UserProfile';
import SkillGapAnalyzer from './components/SkillGapAnalyzer';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoadingScreen from './components/LoadingScreen';
import './i18n';

const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) => {
  const { user, isAdmin } = useAuth();
  
  if (!user) return <Navigate to="/auth" />;
  if (adminOnly && !isAdmin) return <Navigate to="/" />;
  
  return <>{children}</>;
};

function App() {
  const { i18n } = useTranslation();
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // Clear any stale cache
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    
    // Clear session storage
    sessionStorage.clear();
    
    // Initialize app
    const init = async () => {
      try {
        await i18n.loadNamespaces(['translation']);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setIsLoading(false);
      }
    };

    init();
  }, [i18n]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route 
              path="/" 
              element={
                <React.Suspense fallback={<LoadingScreen />}>
                  <Home />
                </React.Suspense>
              } 
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <React.Suspense fallback={<LoadingScreen />}>
                    <UserProfile />
                  </React.Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/import"
              element={
                <ProtectedRoute>
                  <React.Suspense fallback={<LoadingScreen />}>
                    <CVUpload />
                  </React.Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit"
              element={
                <ProtectedRoute>
                  <React.Suspense fallback={<LoadingScreen />}>
                    <CVEdit />
                  </React.Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/improve"
              element={
                <ProtectedRoute>
                  <React.Suspense fallback={<LoadingScreen />}>
                    <CVImprovement />
                  </React.Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs"
              element={
                <ProtectedRoute>
                  <React.Suspense fallback={<LoadingScreen />}>
                    <JobApplication />
                  </React.Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/development"
              element={
                <ProtectedRoute>
                  <React.Suspense fallback={<LoadingScreen />}>
                    <ProfessionalDevelopment />
                  </React.Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/skillgap"
              element={
                <ProtectedRoute>
                  <React.Suspense fallback={<LoadingScreen />}>
                    <SkillGapAnalyzer />
                  </React.Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly>
                  <React.Suspense fallback={<LoadingScreen />}>
                    <AdminDashboard />
                  </React.Suspense>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;