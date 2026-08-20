'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { apiFetch, readJson, errorMessage } from '@/lib/apiClient';
import { useStore } from '@/store/useStore';
import { 
  Users, Clock, Flame, Search, 
  Trash2, Settings, Activity, Calendar, 
  Building2, LogOut, X, FileText, RefreshCw, Eye, AlertTriangle, ExternalLink, Download, Plus, Sun, Moon
} from 'lucide-react';
import { getPlatformDisplay } from '@/lib/courseUtils';
import { isAdminEmail } from '@/lib/admin';
import { COHORTS, SHARED_RESOURCE_TAG, shortCohortLabel, type Cohort } from '@/lib/cohorts';
import { drivePreviewUrl } from '@/lib/driveLinks';
import { REPEAT_RULES, REPEAT_LABEL, type RepeatRule } from '@/lib/recurrence';
import { formatDate, formatDateTime } from '@/lib/dateFormat';
import CertificateGroups, { type InspectedCertificate } from '@/components/CertificateGroups';
import {
  CERTIFICATE_CATEGORIES, CATEGORY_ADMIN_ACCENT, resolveCategory,
  type CertificateCategory,
} from '@/lib/certificateCategories';

interface TelemetryUser {
  id: string;
  updated_at: string;
  state: {
    user?: {
      name?: string;
      email?: string;
      streakCount?: number;
      totalStudyHours?: number;
      isOnboarded?: boolean;
      freeBlocks?: { id: string; start: string; end: string; label?: string }[];
    };
    subjects?: { id: string; name: string; code: string; credits: number; difficulty: string; priority: string }[];
    tasks?: { id: string; title: string; status: string; deadline: string; estimatedMinutes: number; actualMinutesSpent: number; subjectName?: string }[];
    timetable?: { id: string; day: number; start: string; end: string; title: string; type: string; subjectCode?: string; completed?: boolean }[];
    courses?: { id: string; name: string; platform: string; progress: number; weeklyGoal: number; deadline: string }[];
    websites?: { id: string; name: string; url: string; timeSpentGoal: number }[];
  };
}

interface GlobalResource {
  id: string;
  name: string;
  url: string;
  type?: string;
  year?: string;
  uploadedBy: string;
  uploaderName?: string;
  createdAt?: string;
}

/** The admin console's sections, in the order they appear. */
const ADMIN_SECTIONS = [
  { key: 'nodes' as const, label: '📁 Student Nodes' },
  { key: 'leaderboard' as const, label: '🏆 Activity Leaderboard' },
  { key: 'library' as const, label: '📚 Shared Library' },
  { key: 'certificates' as const, label: '🎓 Certificates' },
  { key: 'resumes' as const, label: '📄 Resumes' },
  { key: 'events' as const, label: '🗓 Events' },
];

interface StaffEvent {
  id: string;
  title: string;
  description: string | null;
  /** The first occurrence; a repeating entry is stored once. */
  eventDate: string;
  repeat?: RepeatRule | null;
  repeatUntil?: string | null;
  audience: string;
  creatorName: string | null;
  isStaff: boolean;
}

interface ResumeEntry {
  userId: string;
  name: string;
  email: string;
  url: string;
  fileName: string | null;
  uploadedAt: string | null;
}

interface CertificateUploader {
  userId: string;
  name: string;
  email: string;
  count: number;
  /** Always carries all three keys — a category with none reads 0, not blank. */
  byCategory?: Record<CertificateCategory, number>;
  latestAt: string | null;
}

const sortByNewest = (list: GlobalResource[]): GlobalResource[] =>
  list.slice().sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

export default function AdminPage() {
  const router = useRouter();
  const { isLoaded: isUserLoaded, user } = useUser();
  const { isLoaded: isAuthLoaded, isSignedIn, signOut } = useAuth();

  // Signing out is destructive enough to be worth a confirmation step.
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [showSyncTip, setShowSyncTip] = useState(false);

  // The console keeps its own light/dark preference, separate from a student's.
  const consoleTheme = useStore((state) => state.themeMode);
  const setConsoleTheme = useStore((state) => state.setThemeMode);

  const adminName = user?.fullName || user?.firstName || 'Administrator';
  const adminEmail = user?.primaryEmailAddress?.emailAddress || '';
  const adminAvatar = user?.imageUrl || '';
  const adminInitial = (adminName || adminEmail || 'A').charAt(0).toUpperCase();

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      useStore.getState().logout();
      await signOut();
      router.replace('/login');
    } catch (err) {
      console.error('Sign out failed:', err);
      setIsSigningOut(false);
      setShowSignOutConfirm(false);
    }
  };
  
  const [authorized, setAuthorized] = useState(false);
  const [usersList, setUsersList] = useState<TelemetryUser[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<TelemetryUser | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'subjects' | 'tasks' | 'courses' | 'timetable' | 'certificates'>('profile');
  const [inspectedCerts, setInspectedCerts] = useState<InspectedCertificate[]>([]);
  const [loadingInspectedCerts, setLoadingInspectedCerts] = useState(false);
  const [activeCertPreview, setActiveCertPreview] = useState<any | null>(null);
  const [editStreak, setEditStreak] = useState<number>(0);
  const [editHours, setEditHours] = useState<number>(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSyncingSystem, setIsSyncingSystem] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);

  /**
   * The console shows exactly one academic year at a time. Every panel below
   * reads this, and every request carries it, so a 2nd-year view can never
   * contain a 3rd-year row.
   */
  const [selectedCohort, setSelectedCohort] = useState<Cohort>('2nd Year');

  // Shared Library (global resources) moderation
  const [globalResources, setGlobalResources] = useState<GlobalResource[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [removingResourceId, setRemovingResourceId] = useState<string | null>(null);

  const fetchGlobalResources = async () => {
    setLoadingLibrary(true);
    setLibraryError('');
    try {
      const data = await readJson<{ resources?: GlobalResource[] }>(
        await apiFetch(`/api/resources/global?cohort=${encodeURIComponent(selectedCohort)}`)
      );
      setGlobalResources(sortByNewest(data.resources || []));
    } catch (err) {
      console.error(err);
      setLibraryError(errorMessage(err, 'Could not load the shared library.'));
    } finally {
      setLoadingLibrary(false);
    }
  };

  // Admins are locked out of the student workspace, so this is the only way a
  // department-wide ("Others") resource can be published.
  const [showShareForm, setShowShareForm] = useState(false);
  const [shareName, setShareName] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [shareAudience, setShareAudience] = useState<'cohort' | 'everyone'>('cohort');
  const [isSharing, setIsSharing] = useState(false);

  const resetShareForm = () => {
    setShareName('');
    setShareUrl('');
    setShareAudience('cohort');
    setShowShareForm(false);
  };

  const handleShareResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareName.trim() || !shareUrl.trim()) return;

    setIsSharing(true);
    setLibraryError('');
    try {
      const detected = shareUrl.split('?')[0].split('/').pop()?.split('.').pop()?.toLowerCase() || 'link';
      const type = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'].includes(detected) ? detected : 'link';

      const res = await apiFetch(`/api/resources/global?cohort=${encodeURIComponent(selectedCohort)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: shareName.trim(),
          url: shareUrl.trim(),
          type,
          year: shareAudience === 'everyone' ? SHARED_RESOURCE_TAG : selectedCohort,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to share the resource.');
      }

      const data = await res.json();
      setGlobalResources(sortByNewest(data.resources || []));
      resetShareForm();
    } catch (err) {
      console.error(err);
      setLibraryError(err instanceof Error ? err.message : 'Failed to share the resource.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleRemoveResource = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from the shared library? Students will no longer see it.`)) return;
    setRemovingResourceId(id);
    setLibraryError('');
    try {
      const res = await apiFetch(
        `/api/resources/global?id=${encodeURIComponent(id)}&cohort=${encodeURIComponent(selectedCohort)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to remove the resource.');
      }
      const data = await res.json();
      setGlobalResources(sortByNewest(data.resources || []));
    } catch (err) {
      console.error(err);
      setLibraryError(err instanceof Error ? err.message : 'Failed to remove the resource.');
    } finally {
      setRemovingResourceId(null);
    }
  };

  // Department calendar — events staff publish to a year or to everyone
  const [staffEvents, setStaffEvents] = useState<StaffEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState('');
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventRepeat, setEventRepeat] = useState<RepeatRule>('none');
  const [eventRepeatUntil, setEventRepeatUntil] = useState('');
  const [eventAudience, setEventAudience] = useState<'cohort' | 'everyone'>('cohort');
  const [savingEvent, setSavingEvent] = useState(false);

  const fetchStaffEvents = async () => {
    setLoadingEvents(true);
    setEventsError('');
    try {
      const data = await readJson<{ events?: StaffEvent[] }>(
        await apiFetch(`/api/admin/events?cohort=${encodeURIComponent(selectedCohort)}`)
      );
      setStaffEvents(data.events || []);
    } catch (err) {
      console.error(err);
      setEventsError(errorMessage(err, 'Could not load the department calendar.'));
    } finally {
      setLoadingEvents(false);
    }
  };

  const resetEventForm = () => {
    setEventTitle('');
    setEventDesc('');
    setEventDate('');
    setEventRepeat('none');
    setEventRepeatUntil('');
    setEventAudience('cohort');
    setShowEventForm(false);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventDate) return;

    setSavingEvent(true);
    setEventsError('');
    try {
      await readJson(
        await apiFetch('/api/admin/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: eventTitle,
            description: eventDesc,
            eventDate,
            repeat: eventRepeat,
            repeatUntil: eventRepeat === 'none' ? null : eventRepeatUntil || null,
            audience: eventAudience === 'everyone' ? 'Everyone' : selectedCohort,
          }),
        })
      );
      resetEventForm();
      await fetchStaffEvents();
    } catch (err) {
      console.error(err);
      setEventsError(errorMessage(err, 'Could not publish the event.'));
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDeleteEvent = async (id: string, title: string) => {
    if (!confirm(`Remove "${title}" from the calendar? Students will no longer see it.`)) return;
    setEventsError('');
    try {
      await readJson(await apiFetch(`/api/admin/events?id=${encodeURIComponent(id)}`, { method: 'DELETE' }));
      setStaffEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error(err);
      setEventsError(errorMessage(err, 'Could not remove the event.'));
    }
  };

  // Resumes roll call — who in this year has uploaded a CV
  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [resumesError, setResumesError] = useState('');
  const [activeResume, setActiveResume] = useState<ResumeEntry | null>(null);

  const fetchResumes = async () => {
    setLoadingResumes(true);
    setResumesError('');
    try {
      const data = await readJson<{ resumes?: ResumeEntry[] }>(
        await apiFetch(`/api/admin/resumes?cohort=${encodeURIComponent(selectedCohort)}`)
      );
      setResumes(data.resumes || []);
    } catch (err) {
      console.error(err);
      setResumesError(errorMessage(err, 'Could not load resumes.'));
    } finally {
      setLoadingResumes(false);
    }
  };

  // Certificates roll call — who in this year has uploaded, and how many
  const [certUploaders, setCertUploaders] = useState<CertificateUploader[]>([]);
  const [loadingCertUploaders, setLoadingCertUploaders] = useState(false);
  const [certUploadersError, setCertUploadersError] = useState('');
  const [selectedCertUser, setSelectedCertUser] = useState<CertificateUploader | null>(null);

  const fetchCertUploaders = async () => {
    setLoadingCertUploaders(true);
    setCertUploadersError('');
    try {
      const data = await readJson<{ uploaders?: CertificateUploader[] }>(
        await apiFetch(`/api/admin/certificates/overview?cohort=${encodeURIComponent(selectedCohort)}`)
      );
      setCertUploaders(data.uploaders || []);
    } catch (err) {
      console.error(err);
      setCertUploadersError(errorMessage(err, 'Could not load certificate uploads.'));
    } finally {
      setLoadingCertUploaders(false);
    }
  };

  // Leaderboard States & Handlers
  const [adminView, setAdminView] = useState<'nodes' | 'leaderboard' | 'library' | 'certificates' | 'resumes' | 'events'>('nodes');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardRange, setLeaderboardRange] = useState<'today' | 'week' | 'all'>('all');
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState('');
  const [selectedLeaderboardUser, setSelectedLeaderboardUser] = useState<any | null>(null);

  const fetchLeaderboard = async (range: 'today' | 'week' | 'all') => {
    setLoadingLeaderboard(true);
    setLeaderboardError('');
    try {
      const res = await apiFetch(
        `/api/admin/leaderboard?range=${range}&cohort=${encodeURIComponent(selectedCohort)}`
      );
      const data = await readJson<{ leaderboard?: any[] }>(res);
      setLeaderboard(data.leaderboard || []);
    } catch (err: any) {
      console.error(err);
      setLeaderboardError(errorMessage(err, 'Could not load leaderboard data.'));
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const handleSystemSync = async () => {
    setIsSyncingSystem(true);
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/admin/sync-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        throw new Error('System sync request failed');
      }
      const data = await res.json();
      if (data.success) {
        alert('Global activity sync completed successfully!');
        await Promise.all([
          fetchTelemetry(),
          fetchLeaderboard(leaderboardRange)
        ]);
      } else {
        throw new Error(data.error || 'Failed to trigger global sync');
      }
    } catch (err: any) {
      console.error("Global sync failed:", err);
      setErrorMsg(err.message || 'Failed to trigger global activity sync.');
    } finally {
      setIsSyncingSystem(false);
    }
  };

  const handleDownloadCsv = async () => {
    setIsDownloadingCsv(true);
    setErrorMsg('');
    try {
      const res = await apiFetch(`/api/admin/export-users?cohort=${encodeURIComponent(selectedCohort)}`);
      if (!res.ok) {
        throw new Error('Failed to fetch export data');
      }
      const data = await res.json();
      
      const csvHeaders = [
        'Name',
        'Email',
        'LinkedIn URL',
        'LeetCode URL',
        'GitHub URL',
        'CodeChef URL',
        'LeetCode Easy Solves',
        'LeetCode Medium Solves',
        'LeetCode Hard Solves',
        'LeetCode Total Solves',
        'CodeChef Solves',
        'GitHub Commits'
      ];

      const csvRows = data.map((user: any) => {
        const wrapLink = (url: string) => {
          if (!url) return '';
          return `=HYPERLINK("${url}", "${url}")`;
        };

        const leetcodeUrl = user.leetcodeUsername
          ? (user.leetcodeUsername.trim().startsWith('http')
              ? user.leetcodeUsername.trim()
              : `https://leetcode.com/u/${user.leetcodeUsername.trim()}`)
          : '';

        const githubUrl = user.githubUsername
          ? (user.githubUsername.trim().startsWith('http')
              ? user.githubUsername.trim()
              : `https://github.com/${user.githubUsername.trim()}`)
          : '';

        const codechefUrl = user.codechefUsername
          ? (user.codechefUsername.trim().startsWith('http')
              ? user.codechefUsername.trim()
              : `https://www.codechef.com/users/${user.codechefUsername.trim()}`)
          : '';

        return [
          user.name || '',
          user.email || '',
          wrapLink(user.linkedinUrl || ''),
          wrapLink(leetcodeUrl),
          wrapLink(githubUrl),
          wrapLink(codechefUrl),
          user.leetcodeEasyTotal || 0,
          user.leetcodeMediumTotal || 0,
          user.leetcodeHardTotal || 0,
          (user.leetcodeEasyTotal || 0) + (user.leetcodeMediumTotal || 0) + (user.leetcodeHardTotal || 0),
          user.codechefSolvedTotal || 0,
          user.githubContributions || 0
        ].map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(',');
      });

      const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const cohortSlug = selectedCohort.toLowerCase().replace(/\s+/g, '_');
      link.setAttribute(
        'download',
        `layora_${cohortSlug}_stats_${new Date().toISOString().split('T')[0]}.csv`
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("CSV Download failed:", err);
      setErrorMsg(err.message || 'Failed to generate and download CSV export.');
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  useEffect(() => {
    if (authorized && adminView === 'leaderboard') {
      fetchLeaderboard(leaderboardRange);
    }
  }, [authorized, adminView, leaderboardRange, selectedCohort]);

  useEffect(() => {
    if (authorized && adminView === 'library') {
      fetchGlobalResources();
    }
  }, [authorized, adminView, selectedCohort]);

  useEffect(() => {
    if (authorized && adminView === 'certificates') {
      fetchCertUploaders();
    }
  }, [authorized, adminView, selectedCohort]);

  useEffect(() => {
    if (authorized && adminView === 'resumes') {
      fetchResumes();
    }
  }, [authorized, adminView, selectedCohort]);

  useEffect(() => {
    if (authorized && adminView === 'events') {
      fetchStaffEvents();
    }
  }, [authorized, adminView, selectedCohort]);

  /**
   * Switching year clears everything drilled into under the previous one.
   * Without this, a student's detail panel could stay open over a list that no
   * longer contains them.
   */
  useEffect(() => {
    if (!authorized) return;
    setSelectedUser(null);
    setSelectedLeaderboardUser(null);
    setSelectedCertUser(null);
    setActiveResume(null);
    setResumes([]);
    setStaffEvents([]);
    resetEventForm();
    setInspectedCerts([]);
    setActiveCertPreview(null);
    setShowDeleteConfirm(null);
    setSearchQuery('');
    setLeaderboard([]);
    setGlobalResources([]);
    setCertUploaders([]);
    fetchTelemetry();
  }, [selectedCohort, authorized]);

  useEffect(() => {
    if (selectedUser) {
      setEditStreak(selectedUser.state.user?.streakCount || 0);
      setEditHours(selectedUser.state.user?.totalStudyHours || 0);
    }
  }, [selectedUser]);

  useEffect(() => {
    if (selectedUser && activeTab === 'certificates') {
      const fetchUserCerts = async () => {
        setLoadingInspectedCerts(true);
        try {
          const res = await apiFetch(`/api/admin/certificates?userId=${selectedUser.id}`);
          if (res.ok) {
            const data = await res.json();
            setInspectedCerts(data);
          } else {
            setInspectedCerts([]);
          }
        } catch (err) {
          console.error('Failed to load user certificates for admin:', err);
          setInspectedCerts([]);
        } finally {
          setLoadingInspectedCerts(false);
        }
      };
      fetchUserCerts();
    }
  }, [selectedUser, activeTab]);

  useEffect(() => {
    if (!selectedCertUser) return;

    const fetchCerts = async () => {
      setLoadingInspectedCerts(true);
      try {
        const res = await apiFetch(`/api/admin/certificates?userId=${selectedCertUser.userId}`);
        setInspectedCerts(res.ok ? await res.json() : []);
      } catch (err) {
        console.error('Failed to load certificates for admin:', err);
        setInspectedCerts([]);
      } finally {
        setLoadingInspectedCerts(false);
      }
    };

    fetchCerts();
  }, [selectedCertUser]);

  // Verify Admin Access
  useEffect(() => {
    if (!isUserLoaded || !isAuthLoaded) return;

    if (isSignedIn) {
      const email = user?.primaryEmailAddress?.emailAddress || '';
      if (isAdminEmail(email)) {
        setAuthorized(true);
        fetchTelemetry();
      } else {
        router.replace('/dashboard');
      }
    } else {
      router.replace('/login');
    }
  }, [isUserLoaded, isAuthLoaded, isSignedIn, user, router]);

  // Fetch Supabase user states
  const fetchTelemetry = async () => {
    if (!isSupabaseConfigured) {
      setIsLocalMode(true);
      setErrorMsg('');
      setLoadingData(true);
      try {
        const storeState = useStore.getState();
        const registeredUsers = storeState.registeredUsers || [];
        const fetched: TelemetryUser[] = registeredUsers.map((u: any) => ({
          id: u.email,
          updated_at: u.lastActiveDate ? new Date(u.lastActiveDate).toISOString() : new Date().toISOString(),
          state: {
            user: {
              name: u.name,
              email: u.email,
              streakCount: u.streakCount,
              totalStudyHours: u.totalStudyHours,
              isOnboarded: u.isOnboarded,
              freeBlocks: u.freeBlocks || []
            },
            subjects: u.subjects || [],
            tasks: u.tasks || [],
            timetable: u.timetable || [],
            courses: u.courses || [],
            websites: u.websites || []
          }
        }));

        // Sort by last active / updated time descending
        fetched.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        setUsersList(fetched);
      } catch (err: any) {
        console.error("Failed to load local telemetry:", err);
        setErrorMsg("Failed to load local storage telemetry data.");
      } finally {
        setLoadingData(false);
      }
      return;
    }

    try {
      setLoadingData(true);
      setIsLocalMode(false);
      setErrorMsg('');

      const res = await apiFetch(`/api/admin/users?cohort=${encodeURIComponent(selectedCohort)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }
      const data = await res.json();

      const fetched: TelemetryUser[] = (data || []).map((row: any) => ({
        id: row.id,
        state: row.state || {},
        updated_at: row.updated_at || '',
      }));

      // Sort by last active / updated time descending
      fetched.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setUsersList(fetched);
    } catch (err: any) {
      console.error("Failed to load telemetry:", err);
      setErrorMsg(err.message || "Failed to sync user database states from Supabase.");
    } finally {
      setLoadingData(false);
    }
  };

  // Delete User Sync Record
  const handleDeleteRecord = async (userId: string) => {
    setShowDeleteConfirm(null);
    try {
      setLoadingData(true);
      if (isSupabaseConfigured) {
        const res = await apiFetch(`/api/admin/users/${userId}`, {
          method: 'DELETE'
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP error ${res.status}`);
        }
      } else {
        // Local mode delete
        const registeredUsers = useStore.getState().registeredUsers || [];
        const updated = registeredUsers.filter((u) => u.email !== userId);
        useStore.getState().setFullState({ registeredUsers: updated });
      }

      setUsersList((prev) => prev.filter((u) => u.id !== userId));
      if (selectedUser?.id === userId) {
        setSelectedUser(null);
      }
    } catch (err: any) {
      console.error("Failed to delete user state:", err);
      alert("Error deleting user state: " + err.message);
      // Re-fetch telemetry to restore list consistency on failure
      fetchTelemetry();
    } finally {
      setLoadingData(false);
    }
  };

  // Update User Telemetry Stats (Streak & Hours override)
  const handleUpdateUserStats = async () => {
    if (!selectedUser) return;
    try {
      setIsSavingEdit(true);
      
      const updatedUser = {
        ...(selectedUser.state.user || {}),
        streakCount: Number(editStreak),
        totalStudyHours: Number(editHours)
      };

      const updatedState = {
        ...selectedUser.state,
        user: updatedUser
      };

      if (isSupabaseConfigured) {
        const res = await apiFetch(`/api/admin/users/${selectedUser.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: updatedState })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP error ${res.status}`);
        }
      } else {
        // Local mode update
        const registeredUsers = useStore.getState().registeredUsers || [];
        const updated = registeredUsers.map((u) => {
          if (u.email === selectedUser.id) {
            return {
              ...u,
              streakCount: Number(editStreak),
              totalStudyHours: Number(editHours)
            };
          }
          return u;
        });
        useStore.getState().setFullState({ registeredUsers: updated });
      }

      setSelectedUser({
        ...selectedUser,
        state: updatedState
      });
      setUsersList((prev) => prev.map((u) => {
        if (u.id === selectedUser.id) {
          return {
            ...u,
            state: updatedState
          };
        }
        return u;
      }));
      alert("User statistics updated successfully!");
    } catch (err: any) {
      console.error("Failed to update user stats:", err);
      alert("Failed to update user stats: " + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Compute overall metrics
  const totalUsers = usersList.length;

  // Filter user list by search query
  const filteredUsers = usersList.filter((u) => {
    const name = (u.state.user?.name || '').toLowerCase();
    const email = (u.state.user?.email || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || email.includes(query) || u.id.toLowerCase().includes(query);
  });

  const formatLastSync = (isoString: string) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return formatDateTime(date);
  };

  if (!authorized) {
    return (
      <main className="min-h-screen bg-background text-white flex flex-col items-center justify-center relative overflow-hidden">
        <div className="z-10 flex flex-col items-center gap-6">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border border-primary/30 animate-pulse"></div>
            <div className="absolute inset-2 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl tracking-tighter">🔒</span>
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-wider text-white">
              LAYORA BACKEND
            </h1>
            <p className="text-xs text-white/40 mt-1">
              Authenticating credentials & firewall rules...
            </p>
          </div>
          <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden relative">
            <div className="absolute left-0 top-0 h-full bg-primary w-1/3 rounded-full animate-[loading-bar_1.5s_infinite_ease-in-out]"></div>
          </div>
        </div>
        <style jsx global>{`
          @keyframes loading-bar {
            0% { left: -33%; width: 33%; }
            50% { width: 50%; }
            100% { left: 100%; width: 33%; }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-white p-4 md:p-8 relative overflow-x-hidden">

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* Header Terminal */}
        {/* ── UTILITY BAR ────────────────────────────────────────────────
            Who you are and how the console looks. Identity belongs at the
            top-right edge of the chrome, kept clear of the action buttons so
            "sign out" can never sit next to a destructive control. */}
        <div className="flex items-center justify-end gap-3 pb-4 border-b border-white/5">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
            {([
              { key: 'light' as const, label: 'Light', Icon: Sun },
              { key: 'dark' as const, label: 'Dark', Icon: Moon },
            ]).map(({ key, label, Icon }) => {
              const active = consoleTheme === key;
              return (
                <button
                  key={key}
                  onClick={() => setConsoleTheme(key)}
                  aria-pressed={active}
                  title={`${label} mode`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer ${
                    active ? 'bg-cyber-blue text-white' : 'text-white/45 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 pl-2 pr-2 py-1.5 rounded-xl bg-white/5 border border-white/10">
            {adminAvatar && !avatarFailed ? (
              <img
                src={adminAvatar}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-cyber-blue/15 border border-cyber-blue/25 flex items-center justify-center text-cyber-blue font-black text-sm shrink-0">
                {adminInitial}
              </div>
            )}
            <div className="min-w-0 leading-tight hidden sm:block">
              <div className="text-xs font-bold text-white truncate max-w-[180px]">{adminName}</div>
              <div className="text-[9px] font-mono text-white/40 truncate max-w-[180px]">{adminEmail}</div>
            </div>
            <button
              onClick={() => setShowSignOutConfirm(true)}
              title="Sign out"
              aria-label="Sign out"
              className="p-2 rounded-lg border border-white/10 hover:border-red-400/50 hover:bg-red-950/30 text-white/50 hover:text-red-400 transition cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-widest text-white">
              ADMIN CONTROL CENTER
            </h1>
            <p className="text-[11px] font-mono uppercase tracking-widest text-white/40">
              CSE Department &middot; viewing {selectedCohort}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <button
                onClick={handleSystemSync}
                disabled={isSyncingSystem}
                onMouseEnter={() => setShowSyncTip(true)}
                onMouseLeave={() => setShowSyncTip(false)}
                onFocus={() => setShowSyncTip(true)}
                onBlur={() => setShowSyncTip(false)}
                aria-describedby="sync-tip"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyber-purple/20 to-cyber-blue/20 hover:from-cyber-purple/30 hover:to-cyber-blue/30 border border-cyber-purple/30 hover:border-cyber-blue text-white/90 hover:text-cyber-blue transition cursor-pointer text-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSystem ? 'animate-spin' : ''}`} />
                TRIGGER GLOBAL SYNC
              </button>
              {showSyncTip && (
                <div
                  id="sync-tip"
                  role="tooltip"
                  className="absolute top-full left-0 mt-2 w-72 z-40 rounded-xl border border-cyber-blue/30 bg-[#1E2126] p-3 shadow-xl"
                >
                  <p className="text-[11px] leading-relaxed text-white/70">
                    Pulls fresh LeetCode, CodeChef and GitHub activity for every
                    student and recalculates the leaderboard from it. Takes a
                    moment for large batches.
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={handleDownloadCsv}
              disabled={isDownloadingCsv}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/30 hover:border-emerald-400 text-white/90 hover:text-emerald-400 transition cursor-pointer text-xs disabled:opacity-50"
            >
              <Download className={`w-3.5 h-3.5 ${isDownloadingCsv ? 'animate-pulse' : ''}`} />
              EXPORT USERS CSV
            </button>
            <button
              onClick={fetchTelemetry}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-cyber-blue text-white/70 hover:text-white transition cursor-pointer text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              RELOAD DATA
            </button>
          </div>
        </header>

        {/* ── YEAR SELECTOR ──────────────────────────────────────────────
            Everything below is scoped to exactly one academic year. There is
            no combined view: a 2nd-year screen never contains 3rd-year data. */}
        <section className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/40 shrink-0">
            Academic year
          </span>
          <div
            role="tablist"
            aria-label="Academic year"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-max"
          >
            {COHORTS.map((c) => {
              const active = selectedCohort === c;
              return (
                <button
                  key={c}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCohort(c)}
                  className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer ${
                    active
                      ? 'bg-cyber-blue text-white shadow-md'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {shortCohortLabel(c)}
                </button>
              );
            })}
          </div>
          <span className="text-[10px] font-mono text-white/25 leading-relaxed">
            Students are assigned to a year by the roster in{' '}
            <code className="text-white/40">src/lib/roster.ts</code>
          </span>
        </section>

        {isLocalMode && (
          <div className="p-4 rounded-xl border border-cyber-purple/35 bg-cyber-purple/5 text-cyber-purple text-xs flex items-center justify-between gap-3 shadow-lg shadow-cyber-purple/5 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-cyber-purple animate-pulse shadow-glow"></span>
              <span className="font-bold tracking-wide uppercase">LOCAL SYSTEM MODE: OFFLINE TELEMETRY ACTIVE</span>
              <span className="text-[10px] text-white/50 lowercase">({usersList.length} client storage nodes loaded)</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-cyber-purple/20 text-[10px] font-bold uppercase tracking-wider border border-cyber-purple/35">ZUSTAND SYNC</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-xl border border-red-500/25 bg-red-950/15 text-red-300 text-xs flex items-center gap-3 shadow-lg shadow-red-500/5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
            <span className="font-bold">SYSTEM FAILURE:</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Roll count for the selected year */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-5 border border-white/10 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
            <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Number of Students</div>
            <div className="text-3xl font-black text-cyber-purple mt-2 flex items-baseline gap-1">
              {totalUsers} <span className="text-xs text-white/40 font-normal">students</span>
            </div>
            <div className="text-[10px] text-white/50 mt-1 border-t border-white/5 pt-2 flex items-center gap-1.5">
              <Users className="w-3 h-3 text-cyber-purple" /> {selectedCohort} profiles synced
            </div>
          </div>
        </section>

        {/* Database Search & List Panel */}
        <section className="glass-panel border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* One definition, one accent, one shape. These used to be six
                hand-written buttons each with its own colour, so choosing a
                section repainted the row and the selected tab read as a
                different control. `whitespace-nowrap` plus a scrolling row
                keeps them on one line whatever sits beside them. */}
            <div className="flex items-center gap-2 overflow-x-auto max-w-full">
              {ADMIN_SECTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setAdminView(key)}
                  aria-pressed={adminView === key}
                  className={`shrink-0 whitespace-nowrap text-xs font-mono font-bold tracking-wider uppercase px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                    adminView === key
                      ? 'border-cyber-purple bg-cyber-purple/10 text-cyber-purple'
                      : 'border-white/10 text-white/50 hover:text-white hover:border-white/25'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {adminView === 'nodes' ? (
              /* Narrower than it was: at sm:max-w-xs the search crowded the tab
                 row and pushed the Events tab out of view. */
              <div className="relative w-full sm:w-56 shrink-0">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Query name, email or UUID..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyber-blue"
                />
              </div>
            ) : adminView === 'events' ? (
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">
                  {staffEvents.length} scheduled
                </span>
                <button
                  onClick={() => setShowEventForm((v) => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/30 hover:border-violet-400 text-violet-300 transition cursor-pointer text-[10px] uppercase font-bold tracking-wider"
                >
                  <Plus className="w-3 h-3" />
                  {showEventForm ? 'Cancel' : 'New event'}
                </button>
              </div>
            ) : adminView === 'resumes' ? (
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">
                  {resumes.length} CV{resumes.length === 1 ? '' : 's'} uploaded
                </span>
                <button
                  onClick={fetchResumes}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-sky-400 text-white/70 hover:text-white transition cursor-pointer text-[10px] uppercase font-bold tracking-wider"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingResumes ? 'animate-spin' : ''}`} />
                  Reload
                </button>
              </div>
            ) : adminView === 'certificates' ? (
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">
                  {certUploaders.length} student{certUploaders.length === 1 ? '' : 's'} with uploads
                </span>
                <button
                  onClick={fetchCertUploaders}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-amber-400 text-white/70 hover:text-white transition cursor-pointer text-[10px] uppercase font-bold tracking-wider"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingCertUploaders ? 'animate-spin' : ''}`} />
                  Reload
                </button>
              </div>
            ) : adminView === 'library' ? (
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">
                  {globalResources.length} shared file{globalResources.length === 1 ? '' : 's'}
                </span>
                <button
                  onClick={() => setShowShareForm(!showShareForm)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-400 text-emerald-400 transition cursor-pointer text-[10px] uppercase font-bold tracking-wider"
                >
                  <Plus className="w-3 h-3" />
                  {showShareForm ? 'Cancel' : 'Share a link'}
                </button>
                <button
                  onClick={fetchGlobalResources}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-emerald-400 text-white/70 hover:text-white transition cursor-pointer text-[10px] uppercase font-bold tracking-wider"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingLibrary ? 'animate-spin' : ''}`} />
                  Reload
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {(['today', 'week', 'all'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setLeaderboardRange(r)}
                    className={`px-3 py-1 rounded-lg border text-[10px] uppercase font-bold tracking-wider transition cursor-pointer ${
                      leaderboardRange === r
                        ? 'border-cyber-purple bg-cyber-purple/20 text-cyber-purple shadow-glow-purple'
                        : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    {r === 'week' ? '7 Days' : r}
                  </button>
                ))}
              </div>
            )}
          </div>

          {adminView === 'nodes' && (
            <>
              {loadingData ? (
                <div className="p-12 text-center text-white/40 text-xs flex flex-col items-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-cyber-blue" />
                  Fetching terminal data...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-12 text-center text-white/30 text-xs">
                  No matching database states found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/2 text-white/40 font-bold uppercase tracking-wider">
                        <th className="p-4 font-normal">Student Node</th>
                        <th className="p-4 font-normal">Status</th>
                        <th className="p-4 font-normal">Streak</th>
                        <th className="p-4 font-normal text-right">Study Time</th>
                        <th className="p-4 font-normal text-center">Subjects</th>
                        <th className="p-4 font-normal text-center">Tasks Done</th>
                        <th className="p-4 font-normal">Last Active Sync</th>
                        <th className="p-4 font-normal text-center">Diagnostics</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredUsers.map((u) => {
                        const uProfile = u.state.user || {};
                        const tasksList = u.state.tasks || [];
                        const completedTasks = tasksList.filter(t => t.status === 'completed').length;
                        
                        return (
                          <tr key={u.id} className="hover:bg-white/3 transition group">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm text-cyber-blue">
                                  {uProfile.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div>
                                  <div className="font-bold text-white group-hover:text-cyber-blue transition">{uProfile.name || 'Anonymous Student'}</div>
                                  <div className="text-[10px] text-white/40">{uProfile.email || 'No email synced'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              {uProfile.isOnboarded ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-semibold">ONBOARDED</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-semibold">ONBOARDING</span>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-1">
                                <Flame className="w-3.5 h-3.5 text-amber-500" />
                                <span className="font-bold text-white">{uProfile.streakCount || 0}d</span>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <div className="font-bold text-white">{uProfile.totalStudyHours?.toFixed(1) || '0.0'}h</div>
                            </td>
                            <td className="p-4 text-center">
                              <span className="px-2 py-0.5 bg-white/5 rounded border border-white/10 font-bold">
                                {u.state.subjects?.length || 0}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`px-2 py-0.5 rounded font-bold ${
                                tasksList.length > 0 && completedTasks === tasksList.length 
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                  : 'bg-white/5 border border-white/10 text-white/70'
                              }`}>
                                {completedTasks} / {tasksList.length}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="font-medium text-white/70">{formatLastSync(u.updated_at)}</div>
                              <div className="text-[9px] text-white/30 truncate max-w-[120px]">{u.id}</div>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setActiveTab('profile');
                                  }}
                                  className="p-1.5 rounded-lg border border-white/10 hover:border-cyber-blue text-white/60 hover:text-cyber-blue transition cursor-pointer"
                                  title="Inspect Details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(u.id)}
                                  className="p-1.5 rounded-full border border-rose-200 dark:border-rose-900/30 bg-white dark:bg-zinc-900 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:border-red-300 text-red-600 dark:text-red-400 transition cursor-pointer flex items-center justify-center"
                                  title="Purge Sync State"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {adminView === 'leaderboard' && (
            <div>
              {loadingLeaderboard ? (
                <div className="p-12 text-center text-white/40 text-xs flex flex-col items-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-cyber-purple" />
                  Compiling leaderboard ranks...
                </div>
              ) : leaderboardError ? (
                <div className="p-12 text-center text-rose-300 text-xs flex flex-col items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-rose-400" />
                  <span>{leaderboardError}</span>
                  <button
                    onClick={() => fetchLeaderboard(leaderboardRange)}
                    className="mt-3 px-3 py-1.5 bg-rose-950/30 border border-rose-500/25 hover:bg-rose-950/50 text-rose-300 rounded-lg text-[10px] font-bold transition cursor-pointer"
                  >
                    RETRY SYNC FETCH
                  </button>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="p-12 text-center text-white/30 text-xs">
                  No daily activity ledger entries registered yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/2 text-white/40 font-bold uppercase tracking-wider">
                        <th className="p-4 font-normal text-center w-16">Rank</th>
                        <th className="p-4 font-normal">Student</th>
                        <th className="p-4 font-normal">Linked Accounts</th>
                        <th className="p-4 font-normal text-right">LC Solves</th>
                        <th className="p-4 font-normal text-right">CC Solves</th>
                        <th className="p-4 font-normal text-right">GitHub Contributions</th>
                        <th className="p-4 font-normal text-right">Points Earned</th>
                        <th className="p-4 font-normal text-center">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {leaderboard.map((item, index) => {
                        const isTopThree = index < 3;
                        const rankColors = [
                          'text-yellow-400 border-yellow-500/30 bg-yellow-500/5',
                          'text-slate-300 border-slate-400/30 bg-slate-400/5',
                          'text-amber-600 border-amber-600/30 bg-amber-600/5'
                        ];
                        
                        return (
                          <tr key={item.userId} className="hover:bg-white/3 transition group">
                            <td className="p-4 text-center font-black text-sm">
                              {isTopThree ? (
                                <span className={`inline-flex w-7 h-7 rounded-full border items-center justify-center font-extrabold ${rankColors[index]}`}>
                                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                </span>
                              ) : (
                                <span className="text-white/40">#{index + 1}</span>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm text-cyber-purple">
                                  {item.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div>
                                  <div className="font-bold text-white group-hover:text-cyber-purple transition">{item.name || 'Anonymous Student'}</div>
                                  <div className="text-[9px] text-white/30 truncate max-w-[150px]">{item.userId}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1.5">
                                {item.leetcodeUsername ? (
                                  <a
                                    href={item.leetcodeUsername.trim().startsWith('http') ? item.leetcodeUsername.trim() : `https://leetcode.com/u/${item.leetcodeUsername.trim()}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/25 hover:border-yellow-500/40 text-[10px] text-yellow-500 font-bold transition duration-200 cursor-pointer w-fit"
                                  >
                                    💡 leetcode: <strong className="text-white hover:underline">{item.leetcodeUsername}</strong>
                                  </a>
                                ) : (
                                  <span className="text-[9px] text-white/20 font-mono italic">No LeetCode linked</span>
                                )}
                                {item.codechefUsername ? (
                                  <a
                                    href={item.codechefUsername.trim().startsWith('http') ? item.codechefUsername.trim() : `https://www.codechef.com/users/${item.codechefUsername.trim()}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/25 hover:border-orange-500/40 text-[10px] text-orange-500 font-bold transition duration-200 cursor-pointer w-fit"
                                  >
                                    🍳 codechef: <strong className="text-white hover:underline">{item.codechefUsername}</strong>
                                  </a>
                                ) : (
                                  <span className="text-[9px] text-white/20 font-mono italic">No CodeChef linked</span>
                                )}
                                {item.githubUsername ? (
                                  <a
                                    href={item.githubUsername.trim().startsWith('http') ? item.githubUsername.trim() : `https://github.com/${item.githubUsername.trim()}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyber-blue/10 hover:bg-cyber-blue/20 border border-cyber-blue/25 hover:border-cyber-blue/40 text-[10px] text-cyber-blue font-bold transition duration-200 cursor-pointer w-fit"
                                  >
                                    🐙 github: <strong className="text-white hover:underline">{item.githubUsername}</strong>
                                  </a>
                                ) : (
                                  <span className="text-[9px] text-white/20 font-mono italic">No GitHub linked</span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-right font-black text-white text-sm">
                              {item.totalLeetcodeSolved} <span className="text-[10px] font-normal text-white/40">solved</span>
                            </td>
                            <td className="p-4 text-right font-black text-white text-sm">
                              {item.totalCodechefSolved || 0} <span className="text-[10px] font-normal text-white/40">solved</span>
                            </td>
                            <td className="p-4 text-right font-black text-white text-sm">
                              {item.totalGithubContributions} <span className="text-[10px] font-normal text-white/40">contribs</span>
                            </td>
                            <td className="p-4 text-right">
                              <span className="px-3 py-1 bg-cyber-purple/10 border border-cyber-purple/20 text-cyber-purple rounded-lg font-black text-sm text-glow-purple">
                                {item.totalPoints} pts
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => setSelectedLeaderboardUser(item)}
                                className="p-1.5 rounded-lg border border-white/10 hover:border-cyber-blue text-white/60 hover:text-cyber-blue transition cursor-pointer"
                                title="Inspect Accounts"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {adminView === 'library' && (
            <div>
              {showShareForm && (
                <form
                  onSubmit={handleShareResource}
                  className="p-5 border-b border-white/10 bg-white/2 space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="share-name" className="block text-[10px] font-mono uppercase tracking-wider text-white/40">
                        Document name
                      </label>
                      <input
                        id="share-name"
                        value={shareName}
                        onChange={(e) => setShareName(e.target.value)}
                        placeholder="e.g. Semester 5 exam calendar"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="share-url" className="block text-[10px] font-mono uppercase tracking-wider text-white/40">
                        Link
                      </label>
                      <input
                        id="share-url"
                        value={shareUrl}
                        onChange={(e) => setShareUrl(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-[10px] font-mono uppercase tracking-wider text-white/40">
                      Who can see it
                    </span>
                    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
                      {([
                        { key: 'cohort' as const, label: `${selectedCohort} only` },
                        { key: 'everyone' as const, label: 'Every year' },
                      ]).map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setShareAudience(opt.key)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer ${
                            shareAudience === opt.key
                              ? 'bg-emerald-500 text-black'
                              : 'text-white/50 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isSharing || !shareName.trim() || !shareUrl.trim()}
                      className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase tracking-wider transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isSharing ? 'Sharing...' : 'Share'}
                    </button>
                    <button
                      type="button"
                      onClick={resetShareForm}
                      className="px-4 py-2 rounded-lg border border-white/10 hover:border-white/25 text-white/60 hover:text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {loadingLibrary ? (
                <div className="p-12 text-center text-white/40 text-xs flex flex-col items-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                  Loading the shared library...
                </div>
              ) : libraryError ? (
                <div className="p-12 text-center text-rose-300 text-xs flex flex-col items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-rose-400" />
                  <span>{libraryError}</span>
                  <button
                    onClick={fetchGlobalResources}
                    className="mt-3 px-3 py-1.5 bg-rose-950/30 border border-rose-500/25 hover:bg-rose-950/50 text-rose-300 rounded-lg text-[10px] font-bold transition cursor-pointer"
                  >
                    TRY AGAIN
                  </button>
                </div>
              ) : globalResources.length === 0 ? (
                <div className="p-12 text-center text-white/30 text-xs">
                  No files have been shared to the library yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/2 text-white/40 font-bold uppercase tracking-wider">
                        <th className="p-4 font-normal">File</th>
                        <th className="p-4 font-normal">Shared by</th>
                        <th className="p-4 font-normal">Year</th>
                        <th className="p-4 font-normal">Shared on</th>
                        <th className="p-4 font-normal text-center w-28">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {globalResources.map((res) => (
                        <tr key={res.id} className="hover:bg-white/3 transition group">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400">
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-white truncate max-w-[280px]">{res.name}</div>
                                <div className="text-[9px] text-white/30 uppercase tracking-wider">{res.type || 'file'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-semibold text-white/80">{res.uploaderName || '—'}</div>
                            <div className="text-[9px] text-white/30 truncate max-w-[180px]">{res.uploadedBy}</div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/60">
                              {res.year || 'Others'}
                            </span>
                          </td>
                          <td className="p-4 text-white/50 font-mono text-[10px]">
                            {formatDateTime(res.createdAt)}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg border border-white/10 hover:border-cyber-blue text-white/60 hover:text-cyber-blue transition cursor-pointer"
                                title="Open file"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => handleRemoveResource(res.id, res.name)}
                                disabled={removingResourceId === res.id}
                                className="p-1.5 rounded-lg border border-white/10 hover:border-rose-400 text-white/60 hover:text-rose-400 transition cursor-pointer disabled:opacity-40"
                                title="Remove from library"
                              >
                                <Trash2 className={`w-3.5 h-3.5 ${removingResourceId === res.id ? 'animate-pulse' : ''}`} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {adminView === 'events' && (
            <div>
              {showEventForm && (
                <form onSubmit={handleCreateEvent} className="p-5 border-b border-white/10 bg-white/2 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 space-y-1.5">
                      <label htmlFor="ev-title" className="block text-[10px] font-mono uppercase tracking-wider text-white/40">
                        Event
                      </label>
                      <input
                        id="ev-title"
                        value={eventTitle}
                        onChange={(e) => setEventTitle(e.target.value)}
                        maxLength={120}
                        placeholder="e.g. Internal assessment 2"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-violet-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="ev-date" className="block text-[10px] font-mono uppercase tracking-wider text-white/40">
                        Date
                      </label>
                      <input
                        id="ev-date"
                        type="date"
                        lang="en-GB"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400"
                      />
                      {/* Chrome renders the picker in the browser's own locale and
                          ignores lang=, so echo the chosen date unambiguously. */}
                      <p className="text-[10px] font-mono text-white/40">
                        {eventDate ? formatDate(eventDate) : 'dd/mm/yyyy'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="ev-desc" className="block text-[10px] font-mono uppercase tracking-wider text-white/40">
                      Details (optional)
                    </label>
                    <textarea
                      id="ev-desc"
                      value={eventDesc}
                      onChange={(e) => setEventDesc(e.target.value)}
                      rows={2}
                      maxLength={500}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-violet-400 resize-none"
                    />
                  </div>

                  {/* A weekly lab or a monthly review is one entry with a rule,
                      not one entry per week. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label htmlFor="ev-repeat" className="block text-[10px] font-mono uppercase tracking-wider text-white/40">
                        Repeat
                      </label>
                      <select
                        id="ev-repeat"
                        value={eventRepeat}
                        onChange={(e) => setEventRepeat(e.target.value as RepeatRule)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400 cursor-pointer"
                      >
                        {REPEAT_RULES.map((r) => (
                          <option key={r} value={r}>{REPEAT_LABEL[r]}</option>
                        ))}
                      </select>
                    </div>
                    {eventRepeat !== 'none' && (
                      <div className="space-y-1.5">
                        <label htmlFor="ev-repeat-until" className="block text-[10px] font-mono uppercase tracking-wider text-white/40">
                          Until (optional)
                        </label>
                        <input
                          id="ev-repeat-until"
                          type="date"
                          lang="en-GB"
                          value={eventRepeatUntil}
                          min={eventDate || undefined}
                          onChange={(e) => setEventRepeatUntil(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-[10px] font-mono uppercase tracking-wider text-white/40">
                      Who sees it
                    </span>
                    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
                      {([
                        { key: 'cohort' as const, label: `${selectedCohort} only` },
                        { key: 'everyone' as const, label: 'Every year' },
                      ]).map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setEventAudience(opt.key)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer ${
                            eventAudience === opt.key
                              ? 'bg-violet-500 text-white'
                              : 'text-white/50 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingEvent || !eventTitle.trim() || !eventDate}
                      className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {savingEvent ? 'Publishing...' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      onClick={resetEventForm}
                      className="px-4 py-2 rounded-lg border border-white/10 hover:border-white/25 text-white/60 hover:text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {loadingEvents ? (
                <div className="p-12 text-center text-white/40 text-xs flex flex-col items-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
                  Loading the calendar...
                </div>
              ) : eventsError ? (
                <div className="p-12 text-center text-rose-300 text-xs flex flex-col items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-rose-400" />
                  <span>{eventsError}</span>
                  <button
                    onClick={fetchStaffEvents}
                    className="mt-3 px-3 py-1.5 bg-rose-950/30 border border-rose-500/25 hover:bg-rose-950/50 text-rose-300 rounded-lg text-[10px] font-bold transition cursor-pointer"
                  >
                    TRY AGAIN
                  </button>
                </div>
              ) : staffEvents.length === 0 ? (
                <div className="p-12 text-center text-white/30 text-xs">
                  Nothing scheduled for {selectedCohort} yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/2 text-white/40 font-bold uppercase tracking-wider">
                        <th className="p-4 font-normal">Date</th>
                        <th className="p-4 font-normal">Event</th>
                        <th className="p-4 font-normal">Audience</th>
                        <th className="p-4 font-normal">Posted by</th>
                        <th className="p-4 font-normal text-center w-24">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {staffEvents.map((ev) => (
                        <tr key={ev.id} className="hover:bg-white/3 transition">
                          <td className="p-4 font-mono text-white/70 whitespace-nowrap">
                            {formatDate(ev.eventDate)}
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-white">{ev.title}</div>
                            {ev.description && (
                              <div className="text-[10px] text-white/40 mt-0.5 max-w-md">{ev.description}</div>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                              ev.audience === 'Everyone'
                                ? 'bg-violet-500/10 border-violet-500/30 text-violet-300'
                                : 'bg-white/5 border-white/10 text-white/60'
                            }`}>
                              {ev.audience}
                            </span>
                          </td>
                          <td className="p-4 text-white/50">{ev.creatorName || 'Staff'}</td>
                          <td className="p-4">
                            <div className="flex items-center justify-center">
                              <button
                                onClick={() => handleDeleteEvent(ev.id, ev.title)}
                                className="p-1.5 rounded-lg border border-white/10 hover:border-rose-400 text-white/60 hover:text-rose-400 transition cursor-pointer"
                                title="Remove from the calendar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {adminView === 'resumes' && (
            <div>
              {loadingResumes ? (
                <div className="p-12 text-center text-white/40 text-xs flex flex-col items-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
                  Loading resumes...
                </div>
              ) : resumesError ? (
                <div className="p-12 text-center text-rose-300 text-xs flex flex-col items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-rose-400" />
                  <span>{resumesError}</span>
                  <button
                    onClick={fetchResumes}
                    className="mt-3 px-3 py-1.5 bg-rose-950/30 border border-rose-500/25 hover:bg-rose-950/50 text-rose-300 rounded-lg text-[10px] font-bold transition cursor-pointer"
                  >
                    TRY AGAIN
                  </button>
                </div>
              ) : resumes.length === 0 ? (
                <div className="p-12 text-center text-white/30 text-xs">
                  No {selectedCohort} student has uploaded a CV yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/2 text-white/40 font-bold uppercase tracking-wider">
                        <th className="p-4 font-normal">Student</th>
                        <th className="p-4 font-normal">Email</th>
                        <th className="p-4 font-normal">File</th>
                        <th className="p-4 font-normal">Uploaded</th>
                        <th className="p-4 font-normal text-center w-36">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {resumes.map((r) => (
                        <tr
                          key={r.userId}
                          onClick={() => setActiveResume(r)}
                          className="hover:bg-white/3 transition group cursor-pointer"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sky-400">
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                              <span className="font-bold text-white group-hover:text-sky-400 transition">
                                {r.name}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-white/50 font-mono text-[10px] truncate max-w-[220px]">
                            {r.email}
                          </td>
                          <td className="p-4 text-white/60 truncate max-w-[200px]">
                            {r.fileName || 'Resume'}
                          </td>
                          <td className="p-4 text-white/50 font-mono text-[10px]">
                            {formatDateTime(r.uploadedAt)}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setActiveResume(r); }}
                                className="p-1.5 rounded-lg border border-white/10 hover:border-sky-400 text-white/60 hover:text-sky-400 transition cursor-pointer"
                                title={`View ${r.name}'s CV`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-emerald-400 text-white/60 hover:text-emerald-400 transition cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                                title="Open or download"
                              >
                                <Download className="w-3 h-3" />
                                Download
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {adminView === 'certificates' && (
            <div>
              {loadingCertUploaders ? (
                <div className="p-12 text-center text-white/40 text-xs flex flex-col items-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                  Loading certificate uploads...
                </div>
              ) : certUploadersError ? (
                <div className="p-12 text-center text-rose-300 text-xs flex flex-col items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-rose-400" />
                  <span>{certUploadersError}</span>
                  <button
                    onClick={fetchCertUploaders}
                    className="mt-3 px-3 py-1.5 bg-rose-950/30 border border-rose-500/25 hover:bg-rose-950/50 text-rose-300 rounded-lg text-[10px] font-bold transition cursor-pointer"
                  >
                    TRY AGAIN
                  </button>
                </div>
              ) : certUploaders.length === 0 ? (
                <div className="p-12 text-center text-white/30 text-xs">
                  No {selectedCohort} student has uploaded a certificate yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/2 text-white/40 font-bold uppercase tracking-wider">
                        <th className="p-4 font-normal">Student</th>
                        <th className="p-4 font-normal">Email</th>
                        {CERTIFICATE_CATEGORIES.map((c) => (
                          <th key={c} className="p-4 font-normal text-center">{c}</th>
                        ))}
                        <th className="p-4 font-normal text-right">Total</th>
                        <th className="p-4 font-normal">Latest upload</th>
                        <th className="p-4 font-normal text-center w-28">View</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {certUploaders.map((uploader) => (
                        <tr
                          key={uploader.userId}
                          onClick={() => setSelectedCertUser(uploader)}
                          className="hover:bg-white/3 transition group cursor-pointer"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm text-amber-400">
                                {uploader.name?.charAt(0).toUpperCase() || 'S'}
                              </div>
                              <span className="font-bold text-white group-hover:text-amber-400 transition">
                                {uploader.name}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-white/50 font-mono text-[10px] truncate max-w-[220px]">
                            {uploader.email}
                          </td>
                          {/* One column per category, so a year can be scanned
                              down a single bucket without opening anyone. */}
                          {CERTIFICATE_CATEGORIES.map((c) => {
                            const n = uploader.byCategory?.[c] ?? 0;
                            return (
                              <td key={c} className="p-4 text-center">
                                <span
                                  className={`inline-block min-w-[2rem] px-2 py-1 rounded-lg font-bold text-xs tabular-nums border ${
                                    n > 0 ? CATEGORY_ADMIN_ACCENT[c] : 'border-white/5 text-white/20'
                                  }`}
                                >
                                  {n}
                                </span>
                              </td>
                            );
                          })}
                          <td className="p-4 text-right">
                            <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg font-black text-sm tabular-nums">
                              {uploader.count}
                            </span>
                          </td>
                          <td className="p-4 text-white/50 font-mono text-[10px]">
                            {formatDateTime(uploader.latestAt)}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedCertUser(uploader); }}
                                className="p-1.5 rounded-lg border border-white/10 hover:border-amber-400 text-white/60 hover:text-amber-400 transition cursor-pointer"
                                title={`View ${uploader.name}'s certificates`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

      </div>

      {/* Sign-out confirmation */}
      <AnimatePresence>
        {showSignOutConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSigningOut && setShowSignOutConfirm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="signout-title"
              className="glass-panel border border-white/15 p-6 rounded-2xl max-w-sm w-full relative z-10 bg-[#1E2126]"
            >
              <div className="flex items-center gap-3 text-white">
                <LogOut className="w-5 h-5 text-cyber-blue" />
                <h3 id="signout-title" className="text-base font-black tracking-wider uppercase">Sign out</h3>
              </div>
              <p className="text-xs text-white/60 font-mono mt-3 leading-relaxed">
                You will be signed out of the admin console as{' '}
                <span className="text-cyber-blue font-semibold">{adminEmail || adminName}</span>.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  disabled={isSigningOut}
                  className="px-4 py-2 border border-white/10 hover:border-white/20 text-white/60 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition disabled:opacity-40"
                >
                  STAY SIGNED IN
                </button>
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="px-4 py-2 bg-red-950/45 hover:bg-red-900 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold cursor-pointer transition disabled:opacity-60"
                >
                  {isSigningOut ? 'SIGNING OUT...' : 'CONFIRM SIGN OUT'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Resume viewer: the CV inline, with a download beside it */}
      <AnimatePresence>
        {activeResume && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveResume(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-3xl bg-[#16181C] border-l border-white/10 z-50 flex flex-col"
            >
              <header className="p-5 border-b border-white/10 flex items-start justify-between gap-4 shrink-0">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-white truncate">{activeResume.name}</h2>
                  <p className="text-[10px] font-mono text-white/40 truncate mt-0.5">
                    {activeResume.email} &middot; {selectedCohort}
                    {activeResume.uploadedAt
                      ? ` · uploaded ${formatDate(activeResume.uploadedAt)}`
                      : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={activeResume.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-400 text-emerald-400 transition cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                  <button
                    onClick={() => setActiveResume(null)}
                    className="p-2 rounded-lg border border-white/10 hover:border-white/25 text-white/50 hover:text-white transition cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </header>

              <div className="flex-1 min-h-0 bg-black/30">
                {/* Drive share links render in an iframe via /preview; anything
                    else is embedded as-is and falls back to the link below. */}
                <iframe
                  src={activeResume.url.replace('/view?usp=drivesdk', '/preview').replace('/view', '/preview')}
                  title={`${activeResume.name} CV`}
                  className="w-full h-full border-0"
                />
              </div>

              <footer className="p-3 border-t border-white/10 text-center shrink-0">
                <a
                  href={activeResume.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono text-white/40 hover:text-sky-400 transition inline-flex items-center gap-1.5"
                >
                  Preview not loading? Open it directly <ExternalLink className="w-3 h-3" />
                </a>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Certificates drill-down: one student's uploads, from the roll call */}
      <AnimatePresence>
        {selectedCertUser && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCertUser(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-[#1E2126] border-l border-white/10 z-50 flex flex-col"
            >
              <header className="p-5 border-b border-white/10 flex items-start justify-between gap-4 shrink-0">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-white truncate">{selectedCertUser.name}</h2>
                  <p className="text-[10px] font-mono text-white/40 truncate mt-0.5">
                    {selectedCertUser.email} &middot; {selectedCohort}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCertUser(null)}
                  className="p-2 rounded-lg border border-white/10 hover:border-white/25 text-white/50 hover:text-white transition cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-5">
                {loadingInspectedCerts ? (
                  <div className="p-12 text-center text-white/40 text-xs flex flex-col items-center gap-3">
                    <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                    Fetching certificates...
                  </div>
                ) : inspectedCerts.length === 0 ? (
                  <div className="p-12 text-center text-white/30 text-xs">
                    No certificates found for this student.
                  </div>
                ) : (
                  <CertificateGroups
                    certificates={inspectedCerts}
                    onPreview={setActiveCertPreview}
                    accent="amber"
                  />
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Overlay */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel border border-red-500/30 p-6 rounded-2xl max-w-sm w-full relative z-10 bg-[#1E2126]"
            >
              <div className="flex items-center gap-3 text-red-400">
                <Trash2 className="w-6 h-6 animate-bounce" />
                <h3 className="text-base font-black tracking-wider uppercase">PURGE SYNC DATA</h3>
              </div>
              <p className="text-xs text-white/60 font-mono mt-3 leading-relaxed">
                This operations deletes document <span className="text-red-400 font-semibold">{showDeleteConfirm}</span> from Supabase. All database sync keys and chat history for this user will be deleted.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 border border-white/10 hover:border-white/20 text-white/60 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  ABORT
                </button>
                <button
                  onClick={() => handleDeleteRecord(showDeleteConfirm)}
                  className="px-4 py-2 bg-red-950/45 hover:bg-red-900 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  CONFIRM PURGE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Details Inspector Modal/Drawer */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl h-screen bg-[#1A1D22]/95 border-l border-white/10 flex flex-col z-10 shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-white/10 bg-white/2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyber-blue/10 border border-cyber-blue/30 flex items-center justify-center text-cyber-blue font-bold text-lg">
                    {selectedUser.state.user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">{selectedUser.state.user?.name || 'Anonymous Student'}</h3>
                    <p className="text-[10px] text-white/40">{selectedUser.state.user?.email || selectedUser.id}</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-1.5 rounded-lg border border-white/10 hover:border-white/30 text-white/50 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Navigation Tabs */}
              <div className="flex border-b border-white/5 bg-black/40 overflow-x-auto shrink-0 scrollbar-none">
                {(['profile', 'subjects', 'tasks', 'courses', 'timetable', 'certificates'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-3 text-[10px] font-bold tracking-wider uppercase border-b-2 whitespace-nowrap transition cursor-pointer ${
                      activeTab === tab
                        ? 'border-cyber-blue text-cyber-blue bg-white/2'
                        : 'border-transparent text-white/40 hover:text-white/80'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Drawer Content Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 1. Tab Profile */}
                {activeTab === 'profile' && (
                  <div className="space-y-6">
                    {/* The College Timings and Circadian Cycle cards used to sit here.
                        Students are no longer asked for wake/sleep/college hours — the
                        scheduler assumes a fixed day — so both read empty. */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/2 border border-white/5 rounded-xl p-4">
                        <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-cyber-purple" /> Free study slots
                        </div>
                        <div className="mt-2 text-xs font-bold text-white">
                          {selectedUser.state.user?.freeBlocks?.length || 0} blocks
                        </div>
                      </div>

                      <div className="bg-white/2 border border-white/5 rounded-xl p-4">
                        <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-cyber-blue" /> Onboarded
                        </div>
                        <div className="mt-2 text-xs font-bold text-white">
                          {selectedUser.state.user?.isOnboarded ? 'Yes' : 'Not yet'}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/2 border border-white/5 rounded-xl p-4 space-y-3">
                      <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-amber-500" /> Monitored Platforms
                      </div>
                      {selectedUser.state.websites && selectedUser.state.websites.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                          {selectedUser.state.websites.map((w) => (
                            <div key={w.name} className="p-2 border border-white/5 rounded-lg bg-black/40 flex items-center justify-between text-xs">
                              <span className="font-semibold text-white">{w.name}</span>
                              <span className="text-[10px] text-white/40">{w.timeSpentGoal}m goal</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-white/30 font-normal">No custom websites registered for monitoring.</p>
                      )}
                    </div>

                    <div className="bg-white/2 border border-white/5 rounded-xl p-4 space-y-3">
                      <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-cyber-blue" /> Scheduled Free Time Blocks
                      </div>
                      {selectedUser.state.user?.freeBlocks && selectedUser.state.user.freeBlocks.length > 0 ? (
                        <div className="space-y-1.5">
                          {selectedUser.state.user.freeBlocks.map((fb, idx) => (
                            <div key={idx} className="p-2.5 border border-white/5 rounded-lg bg-black/40 flex items-center justify-between text-xs">
                              <span className="font-bold text-white">{fb.label || `Free Block ${idx + 1}`}</span>
                              <span className="font-mono text-cyber-blue">{fb.start} - {fb.end}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-white/30 font-normal">No free time slots added to circadian planner.</p>
                      )}
                    </div>

                    {/* Administrative Override panel */}
                    <div className="bg-white/2 border border-cyber-purple/20 rounded-xl p-4 space-y-4">
                      <div className="text-[10px] text-cyber-purple font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Settings className="w-3.5 h-3.5" /> Administrative Telemetry Override
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-white/50 font-mono uppercase">Streak Count (days)</label>
                          <input
                            type="number"
                            value={editStreak}
                            onChange={(e) => setEditStreak(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyber-purple"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-white/50 font-mono uppercase">Study Focus Hours (hrs)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={editHours}
                            onChange={(e) => setEditHours(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyber-purple"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleUpdateUserStats}
                        disabled={isSavingEdit}
                        className="w-full flex items-center justify-center gap-2 border border-cyber-purple/30 hover:border-cyber-purple bg-cyber-purple/10 hover:bg-cyber-purple/25 text-cyber-purple hover:text-white py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        {isSavingEdit ? "SAVING NODE..." : "WRITE DATA OVERRIDE"}
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Tab Subjects */}
                {activeTab === 'subjects' && (
                  <div className="space-y-4">
                    {selectedUser.state.subjects && selectedUser.state.subjects.length > 0 ? (
                      <div className="space-y-2">
                        {selectedUser.state.subjects.map((sub) => (
                          <div key={sub.id} className="p-4 border border-white/5 rounded-xl bg-white/2 flex items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs">{sub.name}</span>
                                <span className="text-[10px] font-mono bg-cyber-blue/15 text-cyber-blue px-1.5 py-0.5 rounded border border-cyber-blue/20">{sub.code}</span>
                              </div>
                              <div className="text-[10px] text-white/40 mt-1 font-mono">Difficulty: {sub.difficulty} | Credits: {sub.credits}</div>
                            </div>
                            
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              sub.priority === 'High' 
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                                : sub.priority === 'Medium' 
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              {sub.priority.toUpperCase()} PRIORITY
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-white/30 text-xs">No academic subjects configured by this student.</div>
                    )}
                  </div>
                )}

                {/* 3. Tab Tasks */}
                {activeTab === 'tasks' && (
                  <div className="space-y-4">
                    {selectedUser.state.tasks && selectedUser.state.tasks.length > 0 ? (
                      <div className="space-y-2">
                        {selectedUser.state.tasks.map((task) => (
                          <div key={task.id} className="p-3 border border-white/5 rounded-xl bg-white/2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className={`text-xs font-bold text-white truncate ${task.status === 'completed' ? 'line-through text-white/40' : ''}`}>{task.title}</h4>
                              <div className="text-[9px] text-white/40 mt-1 font-mono truncate">Subject: {task.subjectName || 'General'} | Due: {task.deadline}</div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[10px] text-white/50 font-mono">{task.actualMinutesSpent} / {task.estimatedMinutes}m</span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                task.status === 'completed' 
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' 
                                  : task.status === 'in_progress'
                                  ? 'bg-cyber-blue/15 text-cyber-blue border border-cyber-blue/25 animate-pulse'
                                  : 'bg-white/5 border border-white/10 text-white/50'
                              }`}>
                                {task.status.toUpperCase().replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-white/30 text-xs">No active tasks registered.</div>
                    )}
                  </div>
                )}

                {/* 4. Tab Courses */}
                {activeTab === 'courses' && (
                  <div className="space-y-4">
                    {selectedUser.state.courses && selectedUser.state.courses.length > 0 ? (
                      <div className="space-y-3">
                        {selectedUser.state.courses.map((course) => (
                          <div key={course.id} className="p-4 border border-white/5 rounded-xl bg-white/2 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-xs font-bold text-white">{course.name}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-white/40 font-mono">
                                    {getPlatformDisplay(course.platform)} • Due {course.deadline}
                                  </span>
                                  {course.platform && course.platform.startsWith('http') && (
                                    <a
                                      href={course.platform}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[9px] text-cyber-blue hover:underline flex items-center gap-0.5"
                                    >
                                      Visit <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs text-cyber-blue font-bold font-mono">{course.progress}%</span>
                            </div>

                            <div className="progress-track">
                              <div className="progress-fill bg-cyber-blue" style={{ width: `${course.progress}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-white/30 text-xs">No online courses enrolled.</div>
                    )}
                  </div>
                )}

                {/* 5. Tab Timetable */}
                {activeTab === 'timetable' && (
                  <div className="space-y-3">
                    {selectedUser.state.timetable && selectedUser.state.timetable.length > 0 ? (
                      <div className="space-y-2">
                        {selectedUser.state.timetable.map((block) => {
                          const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                          return (
                            <div key={block.id} className="p-3 border border-white/5 rounded-xl bg-white/2 flex items-center justify-between text-xs">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white">{block.title}</span>
                                  <span className="text-[9px] bg-white/5 px-1 rounded text-white/40 font-mono uppercase">{block.type}</span>
                                </div>
                                <div className="text-[10px] text-white/40 mt-1 font-mono">
                                  {daysOfWeek[block.day]} • {block.start} - {block.end} {block.subjectCode ? `(${block.subjectCode})` : ''}
                                </div>
                              </div>

                              {block.completed && (
                                <span className="p-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold">COMPLETED</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-white/30 text-xs">No weekly schedule blocks compiled yet.</div>
                    )}
                  </div>
                )}

                {/* 5.5 Tab Certificates */}
                {activeTab === 'certificates' && (
                  <div className="space-y-4">
                    {loadingInspectedCerts ? (
                      <div className="p-8 text-center text-white/40 text-xs flex flex-col items-center gap-3">
                        <RefreshCw className="w-5 h-5 animate-spin text-cyber-blue" />
                        Fetching academic certificates...
                      </div>
                    ) : inspectedCerts.length === 0 ? (
                      <div className="text-center py-8 text-white/30 text-xs">
                        No verified credentials or skill certificates uploaded by this user.
                      </div>
                    ) : (
                      <CertificateGroups
                        certificates={inspectedCerts}
                        onPreview={setActiveCertPreview}
                        accent="blue"
                      />
                    )}
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Leaderboard User Details Inspector Modal */}
      <AnimatePresence>
        {selectedLeaderboardUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLeaderboardUser(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel border border-cyber-purple/30 p-6 rounded-2xl max-w-md w-full relative z-10 bg-[#1E2126]"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyber-purple/15 border border-cyber-purple/35 flex items-center justify-center font-bold text-sm text-cyber-purple">
                    {selectedLeaderboardUser.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">{selectedLeaderboardUser.name || 'Anonymous Student'}</h3>
                    <p className="text-[10px] text-white/40">{selectedLeaderboardUser.userId}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLeaderboardUser(null)}
                  className="p-1.5 rounded-lg border border-white/10 hover:border-white/30 text-white/50 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-6 space-y-4">
                <div className="bg-white/2 border border-white/5 rounded-xl p-4 space-y-3">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block">
                    Points Summary
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                      <div className="text-[10px] text-white/40 font-bold">Points</div>
                      <div className="text-sm font-black text-cyber-purple mt-0.5">{selectedLeaderboardUser.totalPoints}</div>
                    </div>
                    <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                      <div className="text-[10px] text-white/40 font-bold">LeetCode</div>
                      <div className="text-sm font-black text-yellow-500 mt-0.5">{selectedLeaderboardUser.totalLeetcodeSolved}</div>
                    </div>
                    <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                      <div className="text-[10px] text-white/40 font-bold">GitHub</div>
                      <div className="text-sm font-black text-cyber-blue mt-0.5">{selectedLeaderboardUser.totalGithubContributions}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block">
                    Social & Dev Profiles
                  </span>
                  
                  {/* GitHub Profile Button */}
                  {selectedLeaderboardUser.githubUsername ? (
                    <a
                      href={selectedLeaderboardUser.githubUsername.trim().startsWith('http') ? selectedLeaderboardUser.githubUsername.trim() : `https://github.com/${selectedLeaderboardUser.githubUsername.trim()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-cyber-blue/10 hover:bg-cyber-blue/20 border border-cyber-blue/25 hover:border-cyber-blue/50 text-cyber-blue font-bold text-xs transition duration-200 cursor-pointer shadow-md"
                    >
                      <span className="flex items-center gap-2">
                        🐙 GitHub Profile
                      </span>
                      <span className="text-white text-[10px]">{selectedLeaderboardUser.githubUsername}</span>
                    </a>
                  ) : (
                    <div className="w-full flex items-center justify-between p-3 rounded-xl bg-white/2 border border-white/5 text-white/30 text-xs italic">
                      <span>🐙 GitHub Profile</span>
                      <span>Not linked</span>
                    </div>
                  )}

                  {/* LeetCode Profile Button */}
                  {selectedLeaderboardUser.leetcodeUsername ? (
                    <a
                      href={selectedLeaderboardUser.leetcodeUsername.trim().startsWith('http') ? selectedLeaderboardUser.leetcodeUsername.trim() : `https://leetcode.com/u/${selectedLeaderboardUser.leetcodeUsername.trim()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/25 hover:border-yellow-500/50 text-yellow-500 font-bold text-xs transition duration-200 cursor-pointer shadow-md"
                    >
                      <span className="flex items-center gap-2">
                        💡 LeetCode Profile
                      </span>
                      <span className="text-white text-[10px]">{selectedLeaderboardUser.leetcodeUsername}</span>
                    </a>
                  ) : (
                    <div className="w-full flex items-center justify-between p-3 rounded-xl bg-white/2 border border-white/5 text-white/30 text-xs italic">
                      <span>💡 LeetCode Profile</span>
                      <span>Not linked</span>
                    </div>
                  )}

                  {/* CodeChef Profile Button */}
                  {selectedLeaderboardUser.codechefUsername ? (
                    <a
                      href={selectedLeaderboardUser.codechefUsername.trim().startsWith('http') ? selectedLeaderboardUser.codechefUsername.trim() : `https://www.codechef.com/users/${selectedLeaderboardUser.codechefUsername.trim()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/25 hover:border-orange-500/50 text-orange-500 font-bold text-xs transition duration-200 cursor-pointer shadow-md"
                    >
                      <span className="flex items-center gap-2">
                        🍳 CodeChef Profile
                      </span>
                      <span className="text-white text-[10px]">{selectedLeaderboardUser.codechefUsername}</span>
                    </a>
                  ) : (
                    <div className="w-full flex items-center justify-between p-3 rounded-xl bg-white/2 border border-white/5 text-white/30 text-xs italic">
                      <span>🍳 CodeChef Profile</span>
                      <span>Not linked</span>
                    </div>
                  )}

                  {/* LinkedIn Profile Button */}
                  {selectedLeaderboardUser.linkedinUrl ? (
                    <a
                      href={selectedLeaderboardUser.linkedinUrl.trim().startsWith('http') ? selectedLeaderboardUser.linkedinUrl.trim() : `https://${selectedLeaderboardUser.linkedinUrl.trim()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 hover:border-blue-500/50 text-blue-400 font-bold text-xs transition duration-200 cursor-pointer shadow-md"
                    >
                      <span className="flex items-center gap-2">
                        🔗 LinkedIn Profile
                      </span>
                      <span className="text-white text-[10px] truncate max-w-[200px]">View Profile</span>
                    </a>
                  ) : (
                    <div className="w-full flex items-center justify-between p-3 rounded-xl bg-white/2 border border-white/5 text-white/30 text-xs italic">
                      <span>🔗 LinkedIn Profile</span>
                      <span>Not linked</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedLeaderboardUser(null)}
                  className="px-4 py-2 border border-white/10 hover:border-white/20 text-white/60 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  CLOSE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inspected Certificate Image Lightbox Overlay */}
      <AnimatePresence>
        {activeCertPreview && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveCertPreview(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel border border-white/10 p-4 rounded-2xl max-w-3xl w-full relative z-10 bg-[#1E2126] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div>
                  <h3 className="text-xs font-bold text-white">{activeCertPreview.name}</h3>
                  <p className="text-[9px] text-white/40 uppercase font-mono mt-0.5">{resolveCategory(activeCertPreview.category)} certificate</p>
                </div>
                <button
                  onClick={() => setActiveCertPreview(null)}
                  className="p-1.5 rounded-lg border border-white/10 hover:border-white/30 text-white/50 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Drive files embed inline; any other link can only be opened in a tab. */}
              <div className="bg-black/50 p-2 rounded-lg flex items-center justify-center overflow-auto max-h-[60vh]">
                {drivePreviewUrl(activeCertPreview.file_url) ? (
                  <iframe
                    src={drivePreviewUrl(activeCertPreview.file_url) as string}
                    title={activeCertPreview.name}
                    className="w-full h-[55vh] rounded-lg border border-white/5 bg-white"
                  />
                ) : (
                  <div className="text-center text-[11px] text-white/40 py-10 space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-white/20" />
                    <p>This link cannot be previewed here.</p>
                    <a
                      href={activeCertPreview.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyber-blue hover:underline inline-flex items-center gap-1"
                    >
                      Open original <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </main>
  );
}
