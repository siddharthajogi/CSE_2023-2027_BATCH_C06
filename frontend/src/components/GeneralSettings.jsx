import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  User,
  Shield,
  Monitor,
  Lock,
  KeyRound,
  Bell,
  Users,
  ClipboardList,
  BarChart2,
  ShieldCheck,
  Landmark,
  Building,
  ExternalLink,
  ChevronRight,
  FileText,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { authApi, adminApi } from '../api';
import { usePageRefresh } from '../context/RefreshContext';

export default function GeneralSettings(props) {
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};

  // Resolve initial user from props or outlet context
  const currentUser = props.currentUser || outletContext.currentUser;

  // 1. Synchronized Administrator Account State (single source of truth: Admin My Profile)
  const [adminProfile, setAdminProfile] = useState({
    name: currentUser?.name || '',
    userId: currentUser?.userId || '0001',
    email: currentUser?.email || '',
    profilePhoto: currentUser?.profilePhoto || ''
  });
  const [fetchingProfile, setFetchingProfile] = useState(true);

  // 2. Notification Preferences State (Exactly 5 settings)
  const [notifications, setNotifications] = useState({
    inApp: true,
    accountActivity: true,
    academicRecords: true,
    riskAlerts: true,
    securityAlerts: true
  });
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState('');
  const [prefsError, setPrefsError] = useState('');

  // 3. Change Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // ==========================================================
  // Synchronize Administrator Profile (Single Source of Truth)
  // ==========================================================
  const syncAdminProfile = useCallback(async () => {
    try {
      setFetchingProfile(true);
      // Fetch latest saved profile from the admin profile API
      const res = await adminApi.getAdminProfile();
      if (res && res.success && res.profile) {
        setAdminProfile({
          name: res.profile.name || '',
          userId: res.profile.userId || currentUser?.userId || '0001',
          email: res.profile.email || '',
          profilePhoto: res.profile.profilePhoto || ''
        });
        return;
      }

      // Fallback: fetch session user if profile endpoint did not return
      const meRes = await authApi.getMe();
      if (meRes && meRes.success && meRes.user) {
        setAdminProfile(prev => ({
          ...prev,
          name: meRes.user.name || prev.name || 'Administrator',
          userId: meRes.user.userId || prev.userId || '0001',
          email: meRes.user.email || prev.email || ''
        }));
      }
    } catch (err) {
      console.warn('Could not sync admin profile in settings:', err);
      if (currentUser) {
        setAdminProfile({
          name: currentUser.name || 'Administrator',
          userId: currentUser.userId || '0001',
          email: currentUser.email || '',
          profilePhoto: currentUser.profilePhoto || ''
        });
      }
    } finally {
      setFetchingProfile(false);
    }
  }, [currentUser]);

  // ==========================================================
  // Fetch Notification Preferences from MongoDB
  // ==========================================================
  const fetchPreferences = useCallback(async () => {
    try {
      setLoadingPrefs(true);
      const res = await adminApi.getPreferences();
      const savedSecPref = localStorage.getItem('classpulse_pref_securityAlerts');

      if (res && res.success && res.preferences?.notifications) {
        const backendPrefs = res.preferences.notifications;
        setNotifications({
          inApp: backendPrefs.inApp ?? true,
          accountActivity: backendPrefs.accountActivity ?? true,
          academicRecords: backendPrefs.academicRecords ?? true,
          riskAlerts: backendPrefs.riskAlerts ?? true,
          securityAlerts: savedSecPref !== null ? savedSecPref === 'true' : (backendPrefs.securityAlerts ?? true)
        });
      } else if (savedSecPref !== null) {
        setNotifications(prev => ({
          ...prev,
          securityAlerts: savedSecPref === 'true'
        }));
      }
    } catch (err) {
      console.warn('Could not load preferences from backend:', err);
    } finally {
      setLoadingPrefs(false);
    }
  }, []);

  // Combined data loader for initial mount and page refresh
  const loadData = useCallback(async () => {
    await Promise.all([syncAdminProfile(), fetchPreferences()]);
  }, [syncAdminProfile, fetchPreferences]);

  // Hook into application global header refresh button
  usePageRefresh(loadData);

  // Initial load on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh profile when navigating back to Settings or when browser tab becomes active
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncAdminProfile();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('admin-profile-updated', handleVisibilityOrFocus);
    window.addEventListener('storage', handleVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('admin-profile-updated', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleVisibilityOrFocus);
    };
  }, [syncAdminProfile]);

  // Close password modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showPasswordModal) {
        setShowPasswordModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPasswordModal]);

  // ==========================================================
  // Toggle Switch Handler
  // ==========================================================
  const handleToggle = (key) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    setPrefsSuccess('');
    setPrefsError('');
  };

  // ==========================================================
  // Save Notification Preferences Handler
  // ==========================================================
  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setSavingPrefs(true);
    setPrefsSuccess('');
    setPrefsError('');

    try {
      localStorage.setItem('classpulse_pref_securityAlerts', String(notifications.securityAlerts));

      const payload = {
        notifications: {
          inApp: notifications.inApp,
          accountActivity: notifications.accountActivity,
          academicRecords: notifications.academicRecords,
          riskAlerts: notifications.riskAlerts,
          securityAlerts: notifications.securityAlerts
        }
      };

      const res = await adminApi.updatePreferences(payload);
      if (res && res.success) {
        setPrefsSuccess('Notification preferences saved successfully.');
        if (res.preferences?.notifications) {
          setNotifications(prev => ({
            ...prev,
            inApp: res.preferences.notifications.inApp ?? prev.inApp,
            accountActivity: res.preferences.notifications.accountActivity ?? prev.accountActivity,
            academicRecords: res.preferences.notifications.academicRecords ?? prev.academicRecords,
            riskAlerts: res.preferences.notifications.riskAlerts ?? prev.riskAlerts
          }));
        }
        setTimeout(() => setPrefsSuccess(''), 4000);
      } else {
        setPrefsError(res?.error || 'Failed to save notification preferences.');
      }
    } catch (err) {
      setPrefsError(err.response?.data?.error || err.message || 'Failed to save notification preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  // ==========================================================
  // Change Password Handler
  // ==========================================================
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (!currentPassword) {
      setPwError('Please enter your current password.');
      return;
    }
    if (!newPassword) {
      setPwError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters long.');
      return;
    }
    if (!/(?=.*[a-zA-Z])(?=.*[0-9!@#$%^&*])/.test(newPassword)) {
      setPwError('New password must contain letters and at least one number or symbol.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setPwError('New password cannot be the same as current password.');
      return;
    }

    setPwLoading(true);
    try {
      const res = await authApi.changePassword(currentPassword, newPassword, confirmPassword);
      if (res && res.success) {
        setPwSuccess('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setShowPasswordModal(false);
          setPwSuccess('');
        }, 1500);
      }
    } catch (err) {
      setPwError(err.response?.data?.error || err.message || 'Failed to update password.');
    } finally {
      setPwLoading(false);
    }
  };

  // Exactly five notification settings matching reference icons
  const notificationSettings = [
    {
      key: 'inApp',
      name: 'In-App Notifications',
      icon: Bell
    },
    {
      key: 'accountActivity',
      name: 'Student & Teacher Updates',
      icon: Users
    },
    {
      key: 'academicRecords',
      name: 'Academic & Assessment Updates',
      icon: ClipboardList
    },
    {
      key: 'riskAlerts',
      name: 'Student Risk Alerts',
      icon: BarChart2
    },
    {
      key: 'securityAlerts',
      name: 'Security Alerts',
      icon: ShieldCheck
    }
  ];

  return (
    <div className="space-y-6 pb-12 transition-colors duration-200">
      {/* =======================================================
          MAIN SETTINGS GRID (EXACTLY FOUR SECTIONS)
      ======================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* =======================================================
            ROW 1 - LEFT: ACCOUNT CARD
        ======================================================= */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-[#1e2738] p-6 flex flex-col justify-between transition-colors">
          <div>
            {/* Account Card Heading */}
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Account</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Administrator account details</p>
              </div>
            </div>

            {fetchingProfile ? (
              <div className="py-6 flex items-center justify-center text-slate-400 gap-2 text-sm">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400" />
                <span>Loading account details...</span>
              </div>
            ) : (
              <div className="flex items-center gap-4 mb-6">
                {/* Profile Photo / Avatar */}
                {adminProfile.profilePhoto ? (
                  <img
                    src={adminProfile.profilePhoto}
                    alt={adminProfile.name || 'Administrator'}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-indigo-200 dark:border-indigo-800 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-xs border-2 border-indigo-200/50 dark:border-indigo-800/50">
                    <User className="w-8 h-8 text-white/90" />
                  </div>
                )}

                {/* Name & Login ID (NO Administrator badge) */}
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white truncate">
                    {adminProfile.name || 'Administrator'}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Login ID : {adminProfile.userId || '0001'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action: Open My Profile */}
          <div className="pt-2">
            <Link
              to="/admin/profile"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-600/60 dark:border-indigo-500/70 hover:border-indigo-600 dark:hover:border-indigo-400 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-semibold text-sm transition-colors cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>Open My Profile</span>
              <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80" />
            </Link>
          </div>
        </div>

        {/* =======================================================
            ROW 1 - RIGHT: SECURITY CARD
        ======================================================= */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-[#1e2738] p-6 flex flex-col justify-between transition-colors">
          <div>
            {/* Security Card Heading */}
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Security</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Account security options</p>
              </div>
            </div>

            {/* Security Rows */}
            <div className="space-y-3">
              {/* Current Session */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161d2f] border border-slate-200 dark:border-[#1e2738] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Monitor className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Current Session
                  </span>
                </div>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-[#063326] text-emerald-700 dark:text-[#34d399] border border-emerald-200 dark:border-[#059669]/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-[#10b981]"></span>
                  Active
                </span>
              </div>

              {/* Change Password Action */}
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(true);
                  setPwError('');
                  setPwSuccess('');
                }}
                className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#161d2f] border border-slate-200 dark:border-[#1e2738] hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-colors flex items-center justify-between cursor-pointer text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-white transition-colors">
                    Change Password
                  </span>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          </div>
        </div>

        {/* =======================================================
            ROW 2 - FULL WIDTH: NOTIFICATION PREFERENCES CARD
        ======================================================= */}
        <div className="col-span-1 lg:col-span-2 bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-[#1e2738] p-6 transition-colors">
          {/* Card Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Notification Preferences</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Choose the updates you want to receive
              </p>
            </div>
          </div>

          {/* Feedback Messages */}
          {prefsSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{prefsSuccess}</span>
            </div>
          )}

          {prefsError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{prefsError}</span>
            </div>
          )}

          {/* 5 Notification Toggle Rows */}
          <form onSubmit={handleSavePreferences}>
            <div className="divide-y divide-slate-100 dark:divide-[#1e2738] border-t border-b border-slate-100 dark:border-[#1e2738]">
              {notificationSettings.map((item) => {
                const IconComponent = item.icon;
                const isChecked = Boolean(notifications[item.key]);

                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between py-3.5 px-1 sm:px-2 hover:bg-slate-50/50 dark:hover:bg-[#161d2f]/40 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {item.name}
                      </span>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isChecked}
                      aria-label={`Toggle ${item.name}`}
                      onClick={() => handleToggle(item.key)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        isChecked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-[#242e42]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          isChecked ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Bottom-right Save Button */}
            <div className="mt-5 flex items-center justify-end">
              <button
                type="submit"
                disabled={savingPrefs || loadingPrefs}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {savingPrefs ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Preferences...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Preferences</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* =======================================================
            ROW 3 - FULL WIDTH: INSTITUTION CARD
        ======================================================= */}
        <div className="col-span-1 lg:col-span-2 bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-[#1e2738] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Institution</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Manage college profile and academic configuration
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <Link
              to="/admin/college-settings"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-600/60 dark:border-indigo-500/70 hover:border-indigo-600 dark:hover:border-indigo-400 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-semibold text-sm transition-colors cursor-pointer"
            >
              <Building className="w-4 h-4" />
              <span>College Settings</span>
              <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80" />
            </Link>
          </div>
        </div>
      </div>

      {/* =======================================================
          CHANGE PASSWORD MODAL
      ======================================================= */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111726] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#1e2738] max-w-md w-full p-6 text-left transition-all">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#1e2738] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 rounded-lg">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Change Password</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Update your administrator account password</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pwError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pwError}</span>
              </div>
            )}

            {pwSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{pwSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-[#1e2738] bg-white dark:bg-[#161d2f] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters with letters & numbers"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-[#1e2738] bg-white dark:bg-[#161d2f] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <span className="text-[11px] text-slate-400 dark:text-slate-400 mt-1 block">
                  Must be 8+ characters and contain letters and at least one number or symbol.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-[#1e2738] bg-white dark:bg-[#161d2f] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 mt-4 border-t border-slate-200 dark:border-[#1e2738] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={pwLoading}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {pwLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
