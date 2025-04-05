import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  User, Settings, Key, CreditCard, Bell, Shield,
  Check, X, Loader2, UserCircle, Camera, Upload
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import ErrorMessage from './ErrorMessage';
import { motion, AnimatePresence } from 'framer-motion';
import ImageCropper from './ImageCropper';

interface SubscriptionPlan {
  name: string;
  features: string[];
  current: boolean;
}

const UserProfile = () => {
  const { t } = useTranslation();
  const { user, avatarUrl: contextAvatarUrl, updateAvatar } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'subscription' | 'notifications'>('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isImageHovered, setIsImageHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Profile State
  const [displayName, setDisplayName] = useState(user?.email?.split('@')[0] || '');
  const [bio, setBio] = useState('');
  
  // Security State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Notification Preferences
  const [notifications, setNotifications] = useState({
    email: true,
    desktop: false,
    updates: true,
    marketing: false
  });

  // Subscription Plans
  const subscriptionPlans: SubscriptionPlan[] = [
    {
      name: 'Free',
      features: [
        'Basic CV Analysis',
        '1 CV Storage',
        'Standard Templates'
      ],
      current: true
    },
    {
      name: 'Pro',
      features: [
        'Advanced CV Analysis',
        'Unlimited CV Storage',
        'Premium Templates',
        'AI-Powered Suggestions',
        'Priority Support'
      ],
      current: false
    },
    {
      name: 'Enterprise',
      features: [
        'Everything in Pro',
        'Custom Templates',
        'Team Management',
        'API Access',
        'Dedicated Support'
      ],
      current: false
    }
  ];

  useEffect(() => {
    loadUserProfile();
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, bio, avatar_url, notification_preferences')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setDisplayName(data.display_name || user.email?.split('@')[0] || '');
        setBio(data.bio || '');
        if (data.avatar_url) {
          updateAvatar(data.avatar_url);
        }
        setNotifications(data.notification_preferences || notifications);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('Image size should be less than 5MB');
      }

      // Create a preview for cropping
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image');
    }
  };

  const handleCroppedImage = async (croppedImage: string) => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      setUploadProgress(0);

      // Convert base64 to blob
      const response = await fetch(croppedImage);
      const blob = await response.blob();
      
      const fileExt = 'jpg';
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload with progress tracking
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { 
          upsert: true,
          contentType: 'image/jpeg',
          onUploadProgress: (progress) => {
            const percentage = (progress.loaded / progress.total) * 100;
            setUploadProgress(Math.round(percentage));
          }
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update avatar in context
      updateAvatar(publicUrl);
      setSuccess('Profile picture updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setLoading(false);
      setUploadProgress(0);
      setCropImage(null);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const updateProfile = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          bio,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;
      
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError('Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const updateNotifications = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);

      const { error } = await supabase
        .from('profiles')
        .update({
          notification_preferences: notifications,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      setSuccess('Notification preferences updated');
    } catch (err) {
      setError('Failed to update notification preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Profile Header */}
        <div className="relative h-48 bg-gradient-to-r from-indigo-500 to-purple-600">
          <div className="absolute -bottom-16 left-8">
            <div 
              className="relative group cursor-pointer"
              onMouseEnter={() => setIsImageHovered(true)}
              onMouseLeave={() => setIsImageHovered(false)}
              onClick={handleImageClick}
            >
              <div className="w-32 h-32 rounded-full bg-white p-1 shadow-xl transition-transform duration-200 ease-in-out group-hover:scale-105">
                {contextAvatarUrl ? (
                  <img
                    src={contextAvatarUrl}
                    alt="Profile"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center">
                    <UserCircle className="w-16 h-16 text-gray-400" />
                  </div>
                )}
                
                <AnimatePresence>
                  {isImageHovered && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center"
                    >
                      <Upload className="w-8 h-8 text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {loading && uploadProgress > 0 && (
                  <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="text-white text-sm font-medium">
                      {uploadProgress}%
                    </div>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="pt-16 px-8">
          <h2 className="text-2xl font-bold text-gray-900">{displayName}</h2>
          <p className="text-gray-600">{user?.email}</p>
        </div>

        {/* Navigation Tabs */}
        <div className="px-8 mt-6 border-b">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('profile')}
              className={`pb-4 px-1 ${
                activeTab === 'profile'
                  ? 'border-b-2 border-indigo-500 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <User className="w-5 h-5 inline-block mr-2" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`pb-4 px-1 ${
                activeTab === 'security'
                  ? 'border-b-2 border-indigo-500 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Shield className="w-5 h-5 inline-block mr-2" />
              Security
            </button>
            <button
              onClick={() => setActiveTab('subscription')}
              className={`pb-4 px-1 ${
                activeTab === 'subscription'
                  ? 'border-b-2 border-indigo-500 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CreditCard className="w-5 h-5 inline-block mr-2" />
              Subscription
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`pb-4 px-1 ${
                activeTab === 'notifications'
                  ? 'border-b-2 border-indigo-500 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Bell className="w-5 h-5 inline-block mr-2" />
              Notifications
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-8">
          {error && (
            <ErrorMessage
              message={error}
              type="error"
              className="mb-6"
              onDismiss={() => setError(null)}
            />
          )}
          
          {success && (
            <ErrorMessage
              message={success}
              type="success"
              className="mb-6"
              onDismiss={() => setSuccess(null)}
            />
          )}

          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <button
                  onClick={updateProfile}
                  disabled={loading}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <button
                  onClick={updatePassword}
                  disabled={loading}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Update Password'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Subscription Settings */}
          {activeTab === 'subscription' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {subscriptionPlans.map((plan) => (
                  <div
                    key={plan.name}
                    className={`border-2 rounded-lg p-6 ${
                      plan.current
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <h3 className="text-lg font-medium text-gray-900">
                      {plan.name}
                    </h3>
                    <ul className="mt-4 space-y-2">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start"
                        >
                          <Check className="h-5 w-5 text-green-500 mr-2" />
                          <span className="text-sm text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      className={`mt-6 w-full inline-flex justify-center py-2 px-4 border ${
                        plan.current
                          ? 'border-transparent bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      } shadow-sm text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                    >
                      {plan.current ? 'Current Plan' : 'Upgrade'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Email Notifications
                    </h3>
                    <p className="text-sm text-gray-500">
                      Receive updates and alerts via email
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setNotifications({
                        ...notifications,
                        email: !notifications.email,
                      })
                    }
                    className={`${
                      notifications.email
                        ? 'bg-indigo-600'
                        : 'bg-gray-200'
                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                  >
                    <span
                      className={`${
                        notifications.email
                          ? 'translate-x-5'
                          : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Desktop Notifications
                    </h3>
                    <p className="text-sm text-gray-500">
                      Show notifications in your browser
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setNotifications({
                        ...notifications,
                        desktop: !notifications.desktop,
                      })
                    }
                    className={`${
                      notifications.desktop
                        ? 'bg-indigo-600'
                        : 'bg-gray-200'
                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                  >
                    <span
                      className={`${
                        notifications.desktop
                          ? 'translate-x-5'
                          : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Product Updates
                    </h3>
                    <p className="text-sm text-gray-500">
                      Receive updates about new features
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setNotifications({
                        ...notifications,
                        updates: !notifications.updates,
                      })
                    }
                    className={`${
                      notifications.updates
                        ? 'bg-indigo-600'
                        : 'bg-gray-200'
                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                  >
                    <span
                      className={`${
                        notifications.updates
                          ? 'translate-x-5'
                          : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Marketing Emails
                    </h3>
                    <p className="text-sm text-gray-500">
                      Receive marketing and promotional emails
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setNotifications({
                        ...notifications,
                        marketing: !notifications.marketing,
                      })
                    }
                    className={`${
                      notifications.marketing
                        ? 'bg-indigo-600'
                        : 'bg-gray-200'
                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                  >
                    <span
                      className={`${
                        notifications.marketing
                          ? 'translate-x-5'
                          : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </button>
                </div>
              </div>

              <div>
                <button
                  onClick={updateNotifications}
                  disabled={loading}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Save Preferences'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add the ImageCropper component */}
      {cropImage && (
        <ImageCropper
          image={cropImage}
          onCrop={handleCroppedImage}
          onCancel={() => setCropImage(null)}
          aspectRatio={1}
        />
      )}
    </div>
  );
};

export default UserProfile;