import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
import ProfileOptimizer from './components/ProfileOptimizer';
import ProfileEnhancer from './components/ProfileEnhancer';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoadingScreen from './components/LoadingScreen';
import JobSearch from './components/JobSearch';
import DebugInfo from './components/DebugInfo.jsx';
import './i18n';

const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) => {
  const { user, isAdmin } = useAuth();
  
  if (!user) return <Navigate to="/auth" />;
  if (adminOnly && !isAdmin) return <Navigate to="/" />;
  
  return <>{children}</>;
};

function AppContent() {
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
          <AppRoutes />
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}

const AppRoutes = () => {
  const navigate = useNavigate();
  
  // Handler for successful CV upload
  const handleCvUploadSuccess = (data: any) => {
    console.log('CV Upload Successful in App:', data);
    // Navigate to the edit page after successful upload
    navigate('/edit'); 
  };
  
  return (
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
              <CVUpload onUploadSuccess={handleCvUploadSuccess} />
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
        path="/profile-optimizer"
        element={
          <ProtectedRoute>
            <React.Suspense fallback={<LoadingScreen />}>
              <ProfileOptimizer />
            </React.Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile-enhancer"
        element={
          <ProtectedRoute>
            <React.Suspense fallback={<LoadingScreen />}>
              <ProfileEnhancer />
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
      <Route
        path="/job-search"
        element={
          <ProtectedRoute>
            <React.Suspense fallback={<LoadingScreen />}>
              <JobSearch />
            </React.Suspense>
          </ProtectedRoute>
        }
      />
      <Route path="/debug" element={<DebugInfo />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppContent;