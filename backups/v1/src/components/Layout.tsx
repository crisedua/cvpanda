import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LogOut, Upload, FileText, Sparkles, Briefcase, 
  GraduationCap, Menu, X, UserCircle, Home, Crown,
  Globe 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { createComponentLogger } from '../lib/logger';
import Logo from './Logo';

const logger = createComponentLogger('Layout');

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, i18n } = useTranslation();
  const { user, isAdmin, signOut, avatarUrl } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignOut = async () => {
    logger.log('Sign out clicked');
    try {
      await signOut();
      logger.log('Sign out successful, redirecting to auth');
      navigate('/auth');
    } catch (error) {
      logger.error('Sign out failed', error);
    }
  };

  const handleNavigation = (path: string) => {
    logger.log('Navigation clicked', { path, currentPath: location.pathname });
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'es' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('preferredLanguage', newLang);
  };

  const menuItems = [
    { path: '/', label: t('nav.home'), icon: Home },
    { path: '/import', label: t('nav.import'), icon: Upload },
    { path: '/edit', label: t('nav.edit'), icon: FileText },
    { path: '/improve', label: t('nav.improve'), icon: Sparkles },
    { path: '/development', label: t('nav.development'), icon: GraduationCap },
  ];

  if (!user) {
    logger.log('No user, rendering without navigation');
    return <>{children}</>;
  }

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        isScrolled ? 'bg-white shadow-md' : 'bg-white/80 backdrop-blur-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Logo
                  size="md"
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => handleNavigation('/')}
                />
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNavigation(item.path)}
                      className={`${
                        isActive(item.path)
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      } px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.label}
                    </button>
                  );
                })}
                {isAdmin && (
                  <button
                    onClick={() => handleNavigation('/admin')}
                    className={`${
                      isActive('/admin')
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    } px-3 py-2 rounded-md text-sm font-medium transition-colors`}
                  >
                    {t('nav.admin')}
                  </button>
                )}
              </div>
            </div>
            
            {/* Mobile menu button */}
            <div className="sm:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>

            {/* User menu */}
            <div className="hidden sm:flex sm:items-center sm:space-x-4">
              {/* Language Toggle */}
              <button
                onClick={toggleLanguage}
                className="flex items-center px-3 py-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors"
                aria-label="Toggle Language"
              >
                <Globe className="h-5 w-5 text-indigo-600" />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  {i18n.language === 'en' ? t('language.spanish') : t('language.english')}
                </span>
              </button>

              <button
                onClick={() => handleNavigation('/profile')}
                className="inline-flex items-center px-3 py-2 text-sm leading-4 font-medium rounded-md text-gray-600 hover:text-gray-900 focus:outline-none transition group"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={t('profile.photo.alt')}
                    className="h-8 w-8 rounded-full object-cover ring-2 ring-white"
                  />
                ) : (
                  <UserCircle className="h-8 w-8 text-gray-400 group-hover:text-gray-600" />
                )}
                <span className="ml-2 max-w-[150px] truncate">
                  {user?.email}
                </span>
              </button>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-600 hover:text-gray-900 focus:outline-none transition"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t('nav.signout')}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="sm:hidden absolute top-16 inset-x-0 bg-white border-b border-gray-200">
            <div className="pt-2 pb-3 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigation(item.path)}
                    className={`${
                      isActive(item.path)
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                    } block pl-3 pr-4 py-2 border-l-4 text-base font-medium w-full text-left`}
                  >
                    <div className="flex items-center">
                      <Icon className="h-5 w-5 mr-3" />
                      {item.label}
                    </div>
                  </button>
                );
              })}
              {isAdmin && (
                <button
                  onClick={() => handleNavigation('/admin')}
                  className={`${
                    isActive('/admin')
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                  } block pl-3 pr-4 py-2 border-l-4 text-base font-medium w-full text-left`}
                >
                  {t('nav.admin')}
                </button>
              )}
              <button
                onClick={() => handleNavigation('/profile')}
                className="block w-full text-left pl-3 pr-4 py-2 border-l-4 border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 text-base font-medium"
              >
                <div className="flex items-center">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={t('profile.photo.alt')}
                      className="h-8 w-8 rounded-full object-cover ring-2 ring-white mr-3"
                    />
                  ) : (
                    <UserCircle className="h-8 w-8 text-gray-400 mr-3" />
                  )}
                  {t('nav.profile')}
                </div>
              </button>
              <button
                onClick={handleSignOut}
                className="block w-full text-left pl-3 pr-4 py-2 border-l-4 border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 text-base font-medium"
              >
                <div className="flex items-center">
                  <LogOut className="h-5 w-5 mr-3" />
                  {t('nav.signout')}
                </div>
              </button>

              {/* Language Toggle for Mobile */}
              <button
                onClick={toggleLanguage}
                className="block w-full text-left pl-3 pr-4 py-2 border-l-4 border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 text-base font-medium"
              >
                <div className="flex items-center">
                  <Globe className="h-5 w-5 mr-3 text-indigo-600" />
                  {i18n.language === 'en' ? t('language.spanish') : t('language.english')}
                </div>
              </button>
            </div>
          </div>
        )}
      </nav>

      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;