import React, { useState, useEffect, useCallback, Component } from 'react';
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
  CheckSquare,
  CalendarCheck,
  ShieldCheck,
  Building2,
  Briefcase,
  Mail,
  Hash,
  ExternalLink,
  ChevronRight,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw
} from 'lucide-react';
import { authApi, teacherApi } from '../api';
import { usePageRefresh } from '../context/RefreshContext';

// ==========================================================
// Robust Error Boundary to guarantee zero blank pages
// ==========================================================
class SettingsErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[TeacherSettings Error Boundary Caught]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#111726] border border-rose-200 dark:border-rose-900/50 text-slate-800 dark:text-slate-200 space-y-4 max-w-2xl mx-auto shadow-sm my-6">
          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <h3 className="text-base sm:text-lg font-bold">Unable to render Teacher Settings</h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {this.state.error?.message || 'An unexpected rendering error occurred while loading this page.'}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Loading Settings</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Helper to generate initials from full name or teacher ID safely
const getInitials = (name, fallbackId = 'TC') => {
  const safeName = typeof name === 'string' ? name.trim() : '';
  const safeId = typeof fallbackId === 'string' ? fallbackId.trim() : String(fallbackId || 'TC');
  if (!safeName) return safeId.slice(0, 2).toUpperCase() || 'TC';
  const parts = safeName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return safeId.slice(0, 2).toUpperCase() || 'TC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

function TeacherSettingsContent(props) {
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};

  // Resolve initial user from props or outlet context safely
  const currentUser = props.currentUser || outletContext.currentUser;

  // 1. Synchronized Teacher Profile State
  const [teacherProfile, setTeacherProfile] = useState({
    name: typeof currentUser?.name === 'string' ? currentUser.name : '',
    teacherId: String(currentUser?.userId || currentUser?.teacherId || ''),
    email: typeof currentUser?.email === 'string' ? currentUser.email : '',
    department: typeof currentUser?.department === 'string' ? currentUser.department : '',
    designation: typeof currentUser?.designation === 'string' ? currentUser.designation : '',
    profilePhoto: typeof currentUser?.profilePhoto === 'string' ? currentUser.profilePhoto : ''
  });
  const [fetchingProfile, setFetchingProfile] = useState(true);

  // 2. Notification Preferences State (Exactly 7 Teacher Settings)
  const [notifications, setNotifications] = useState({
    inApp: true,
    studentUpdates: true,
    academicRecords: true,
    riskAlerts: true,
    interventions: true,
    assignmentsAttendance: true,
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
  // Synchronize Teacher Profile (Latest Saved Profile)
  // ==========================================================
  const syncTeacherProfile = useCallback(async () => {
    try {
      setFetchingProfile(true);
      const res = await teacherApi.getTeacherProfile().catch(() => null);
      if (res && res.success && res.profile) {
        const p = res.profile;
        setTeacherProfile({
          name: typeof p.name === 'string' ? p.name : (currentUser?.name || 'Faculty'),
          teacherId: String(p.teacherId || p.userId || currentUser?.userId || 'TC'),
          email: typeof p.email === 'string' ? p.email : (currentUser?.email || ''),
          department: typeof p.department === 'string' ? p.department : (p.departmentRef?.name || currentUser?.department || 'General'),
          designation: typeof p.designation === 'string' ? p.designation : (currentUser?.designation || 'Faculty'),
          profilePhoto: typeof p.profilePhoto === 'string' ? p.profilePhoto : ''
        });
        return;
      }

      // Fallback: fetch session user if profile endpoint didn't respond
      const meRes = await authApi.getMe().catch(() => null);
      if (meRes && meRes.success && meRes.user) {
        const u = meRes.user;
        setTeacherProfile(prev => ({
          ...prev,
          name: typeof u.name === 'string' ? u.name : (prev.name || 'Faculty'),
          teacherId: String(u.userId || prev.teacherId || 'TC'),
          email: typeof u.email === 'string' ? u.email : (prev.email || ''),
          department: typeof u.department === 'string' ? u.department : (prev.department || ''),
          designation: typeof u.designation === 'string' ? u.designation : (prev.designation || 'Faculty'),
          profilePhoto: typeof u.profilePhoto === 'string' ? u.profilePhoto : (prev.profilePhoto || '')
        }));
      }
    } catch (err) {
      console.warn('Could not sync teacher profile in settings:', err);
      if (currentUser) {
        setTeacherProfile({
          name: typeof currentUser.name === 'string' ? currentUser.name : 'Faculty',
          teacherId: String(currentUser.userId || 'TC'),
          email: typeof currentUser.email === 'string' ? currentUser.email : '',
          department: typeof currentUser.department === 'string' ? currentUser.department : '',
          designation: typeof currentUser.designation === 'string' ? currentUser.designation : 'Faculty',
          profilePhoto: typeof currentUser.profilePhoto === 'string' ? currentUser.profilePhoto : ''
        });
      }
    } finally {
      setFetchingProfile(false);
    }
  }, [currentUser]);

  // ==========================================================
  // Fetch Notification Preferences
  // ==========================================================
  const fetchPreferences = useCallback(async () => {
    try {
      setLoadingPrefs(true);
      const prefRes = await teacherApi.getPreferences().catch((err) => {
        console.warn('teacherApi.getPreferences error:', err);
        return null;
      });

      // Load persistent preferences fallback from localStorage
      let localPrefs = null;
      try {
        const stored = localStorage.getItem('classpulse_teacher_prefs');
        if (stored) localPrefs = JSON.parse(stored);
      } catch (_) {}

      if (prefRes && prefRes.success && prefRes.preferences?.notifications) {
        const bNotifs = prefRes.preferences.notifications;
        setNotifications({
          inApp: bNotifs.inApp ?? localPrefs?.notifications?.inApp ?? true,
          studentUpdates: bNotifs.studentUpdates ?? bNotifs.accountActivity ?? localPrefs?.notifications?.studentUpdates ?? true,
          academicRecords: bNotifs.academicRecords ?? localPrefs?.notifications?.academicRecords ?? true,
          riskAlerts: bNotifs.riskAlerts ?? localPrefs?.notifications?.riskAlerts ?? true,
          interventions: bNotifs.interventions ?? localPrefs?.notifications?.interventions ?? true,
          assignmentsAttendance: bNotifs.assignmentsAttendance ?? localPrefs?.notifications?.assignmentsAttendance ?? true,
          securityAlerts: bNotifs.securityAlerts ?? localPrefs?.notifications?.securityAlerts ?? true
        });
      } else if (localPrefs?.notifications) {
        setNotifications(prev => ({ ...prev, ...localPrefs.notifications }));
      }
    } catch (err) {
      console.warn('Could not load teacher preferences:', err);
    } finally {
      setLoadingPrefs(false);
    }
  }, []);

  // Combined data loader for initial mount and page refresh
  const loadData = useCallback(async () => {
    await Promise.all([syncTeacherProfile(), fetchPreferences()]);
  }, [syncTeacherProfile, fetchPreferences]);

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
        syncTeacherProfile();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('teacher-profile-updated', handleVisibilityOrFocus);
    window.addEventListener('storage', handleVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('teacher-profile-updated', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleVisibilityOrFocus);
    };
  }, [syncTeacherProfile]);

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
      const payload = {
        notifications: {
          inApp: notifications.inApp,
          studentUpdates: notifications.studentUpdates,
          academicRecords: notifications.academicRecords,
          riskAlerts: notifications.riskAlerts,
          interventions: notifications.interventions,
          assignmentsAttendance: notifications.assignmentsAttendance,
          securityAlerts: notifications.securityAlerts
        }
      };

      // Persist in localStorage for instant restore
      try {
        localStorage.setItem('classpulse_teacher_prefs', JSON.stringify(payload));
      } catch (_) {}

      // Persist to backend database
      const res = await teacherApi.updatePreferences(payload);
      if (res && res.success) {
        setPrefsSuccess('Notification preferences saved successfully.');
        setTimeout(() => setPrefsSuccess(''), 4000);
      } else {
        setPrefsError(res?.error || 'Failed to save preferences.');
      }
    } catch (err) {
      setPrefsError(err.response?.data?.error || err.message || 'Failed to save preferences.');
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

  // Exactly seven teacher notification settings in clean compact presentation
  const notificationSettings = [
    {
      key: 'inApp',
      name: 'In-App Notifications',
      icon: Bell
    },
    {
      key: 'studentUpdates',
      name: 'Student Updates',
      icon: Users
    },
    {
      key: 'academicRecords',
      name: 'Academic and Assessment Updates',
      icon: ClipboardList
    },
    {
      key: 'riskAlerts',
      name: 'Student Risk Alerts',
      icon: BarChart2
    },
    {
      key: 'interventions',
      name: 'Intervention Review Notifications',
      icon: CheckSquare
    },
    {
      key: 'assignmentsAttendance',
      name: 'Assignment and Attendance Updates',
      icon: CalendarCheck
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
          MAIN SETTINGS GRID (ACCOUNT, SECURITY, NOTIFICATIONS)
      ======================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* =======================================================
            ROW 1 - LEFT: ACCOUNT INFORMATION CARD
        ======================================================= */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-[#1e2738] p-6 flex flex-col justify-between transition-colors shadow-2xs">
          <div>
            {/* Account Card Heading */}
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Account Information</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Faculty identity and departmental details</p>
              </div>
            </div>

            {fetchingProfile ? (
              <div className="py-8 flex items-center justify-center text-slate-400 gap-2 text-sm">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
                <span>Loading teacher account details...</span>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-4">
                  {/* Profile Photo / Avatar */}
                  {teacherProfile.profilePhoto ? (
                    <img
                      src={teacherProfile.profilePhoto}
                      alt={typeof teacherProfile.name === 'string' ? teacherProfile.name : 'Faculty'}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-emerald-200 dark:border-emerald-800 shrink-0 shadow-xs"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-700 text-white flex items-center justify-center font-bold text-lg sm:text-xl shrink-0 shadow-xs border-2 border-emerald-200/60 dark:border-emerald-800/60 select-none">
                      {getInitials(teacherProfile.name, teacherProfile.teacherId)}
                    </div>
                  )}

                  {/* Name, ID, Designation */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                      {typeof teacherProfile.name === 'string' && teacherProfile.name.trim() ? teacherProfile.name : 'Faculty Member'}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Teacher ID : <strong className="font-semibold text-slate-700 dark:text-slate-300">{String(teacherProfile.teacherId || 'TC')}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{typeof teacherProfile.designation === 'string' && teacherProfile.designation.trim() ? teacherProfile.designation : 'Faculty'}</span>
                    </div>
                  </div>
                </div>

                {/* Additional Read-Only Profile Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-slate-100 dark:border-[#1e2738]/80 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161d2f] border border-slate-200/80 dark:border-[#1e2738] flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Department</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {typeof teacherProfile.department === 'string' && teacherProfile.department.trim()
                          ? teacherProfile.department
                          : (teacherProfile.department?.name || 'Not Assigned')}
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161d2f] border border-slate-200/80 dark:border-[#1e2738] flex items-center gap-2">
                    <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Official Email</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {typeof teacherProfile.email === 'string' && teacherProfile.email.trim() ? teacherProfile.email : 'Not Specified'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action: Open My Profile */}
          <div className="pt-2">
            <Link
              to="/teacher/profile"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-600/60 dark:border-emerald-500/70 hover:border-emerald-600 dark:hover:border-emerald-400 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-semibold text-sm transition-colors cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>Open My Profile</span>
              <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80" />
            </Link>
          </div>
        </div>

        {/* =======================================================
            ROW 1 - RIGHT: SECURITY SETTINGS CARD
        ======================================================= */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-[#1e2738] p-6 flex flex-col justify-between transition-colors shadow-2xs">
          <div>
            {/* Security Card Heading */}
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Security Settings</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Account authentication and session security</p>
              </div>
            </div>

            {/* Security Rows */}
            <div className="space-y-3">
              {/* Current Session */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161d2f] border border-slate-200 dark:border-[#1e2738] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Monitor className="w-4 h-4 text-slate-400" />
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block">
                      Current Session
                    </span>
                    <span className="text-xs text-slate-400">Authenticated via Secure Session Cookie</span>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-[#063326] text-emerald-700 dark:text-[#34d399] border border-emerald-200 dark:border-[#059669]/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-[#10b981] animate-pulse"></span>
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
                className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#161d2f] border border-slate-200 dark:border-[#1e2738] hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-colors flex items-center justify-between cursor-pointer text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-white transition-colors block">
                      Change Password
                    </span>
                    <span className="text-xs text-slate-400">Update your faculty account password</span>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          </div>
        </div>

        {/* =======================================================
            ROW 2 - FULL WIDTH: SIMPLIFIED NOTIFICATION PREFERENCES
        ======================================================= */}
        <div className="col-span-1 lg:col-span-2 bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-[#1e2738] p-6 transition-colors shadow-2xs">
          {/* Card Header (Clean & prominent, without unnecessary subtext) */}
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Notification Preferences</h2>
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

          {/* 7 Simplified Compact Notification Toggle Rows */}
          <form onSubmit={handleSavePreferences}>
            <div className="divide-y divide-slate-100 dark:divide-[#1e2738] border-t border-b border-slate-100 dark:border-[#1e2738]">
              {notificationSettings.map((item) => {
                const IconComponent = item.icon;
                const isChecked = Boolean(notifications[item.key]);

                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between py-3 px-1 sm:px-2 hover:bg-slate-50/50 dark:hover:bg-[#161d2f]/40 rounded-lg transition-colors gap-3"
                  >
                    {/* Notification Name on Left */}
                    <div className="flex items-center gap-3 min-w-0">
                      <IconComponent className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {item.name}
                      </span>
                    </div>

                    {/* Toggle Switch on Right */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isChecked}
                      aria-label={`Toggle ${item.name}`}
                      onClick={() => handleToggle(item.key)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        isChecked ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-[#242e42]'
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

            {/* Bottom-Right Save Preferences Button */}
            <div className="mt-5 flex items-center justify-end">
              <button
                type="submit"
                disabled={savingPrefs || loadingPrefs}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
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
      </div>

      {/* =======================================================
          CHANGE PASSWORD MODAL
      ======================================================= */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111726] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#1e2738] max-w-md w-full p-6 text-left transition-all">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#1e2738] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 rounded-lg">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Change Password</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Update your faculty account password</p>
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
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-[#1e2738] bg-white dark:bg-[#161d2f] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-[#1e2738] bg-white dark:bg-[#161d2f] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-[#1e2738] bg-white dark:bg-[#161d2f] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
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

export default function TeacherSettings(props) {
  return (
    <SettingsErrorBoundary>
      <TeacherSettingsContent {...props} />
    </SettingsErrorBoundary>
  );
}
