'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Inbox, Send, Clock, Plus, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/common/Toast';
import { Sidebar } from '../../components/layout/Sidebar';
import { Header } from '../../components/layout/Header';
import { EmailRow } from '../../components/email/EmailRow';
import { EmailDetailModal } from '../../components/email/EmailDetailModal';
import { ComposeModal } from '../../components/compose/ComposeModal';
import { Email, Sender, SlackStatus } from '../../types';

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [currentTab, setCurrentTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [scheduledEmails, setScheduledEmails] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [counts, setCounts] = useState<{ scheduled: number; sent: number }>({ scheduled: 0, sent: 0 });
  const [senders, setSenders] = useState<Sender[]>([]);
  const [slackStatus, setSlackStatus] = useState<SlackStatus>({ connected: false });
  const [loading, setLoading] = useState<boolean>(true);

  // Search state (Elasticsearch)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Email[] | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Modals state
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  // Fetch all initial data
  const fetchData = useCallback(async () => {
    try {
      const [scheduledRes, sentRes, countsRes, sendersRes, slackRes] = await Promise.all([
        api.get('/emails/scheduled'),
        api.get('/emails/sent'),
        api.get('/emails/counts'),
        api.get('/senders'),
        api.get('/slack/status').catch(() => ({ data: { data: { connected: false } } })),
      ]);

      if (scheduledRes.data.success) setScheduledEmails(scheduledRes.data.data);
      if (sentRes.data.success) setSentEmails(sentRes.data.data);
      if (countsRes.data.success) setCounts(countsRes.data.data);
      if (sendersRes.data.success) setSenders(sendersRes.data.data);
      if (slackRes.data.data) setSlackStatus(slackRes.data.data);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('reachinbox_token') : null;
      if (!token) {
        router.push('/login');
      }
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    fetchData();
    // Refresh periodically so user sees live worker transitions (SCHEDULED -> PROCESSING -> SENT)
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Elasticsearch Search Debouncer
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await api.get(`/emails/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.data.success) {
          setSearchResults(res.data.data);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle Slack connection redirect
  const handleConnectSlack = async () => {
    try {
      const res = await api.get('/slack/connect');
      if (res.data.success && res.data.data.url) {
        window.location.href = res.data.data.url;
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Slack OAuth not configured in .env', 'error');
    }
  };

  const handleDisconnectSlack = async () => {
    try {
      const res = await api.post('/slack/disconnect');
      if (res.data.success) {
        setSlackStatus({ connected: false });
        showToast('Slack disconnected', 'info');
      }
    } catch (err: any) {
      showToast('Failed to disconnect Slack', 'error');
    }
  };

  // Handle Campaign Scheduling
  const handleScheduleCampaign = async (campaignData: any) => {
    try {
      const res = await api.post('/campaigns', campaignData);
      if (res.data.success) {
        showToast(
          `🎉 ${res.data.data.totalScheduled} email(s) queued in BullMQ delayed scheduler!`,
          'success'
        );
        fetchData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to schedule campaign', 'error');
      throw err;
    }
  };

  // Current display list
  const displayEmails = searchResults !== null
    ? searchResults
    : currentTab === 'scheduled'
    ? scheduledEmails
    : sentEmails;

  return (
    <div className="flex h-screen bg-[#F9FAFB] overflow-hidden">
      {/* 1. Left Sidebar (Figma p.8) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setSearchQuery('');
          setSearchResults(null);
        }}
        onOpenCompose={() => setIsComposeOpen(true)}
        user={user}
        scheduledCount={counts.scheduled}
        sentCount={counts.sent}
        slackStatus={slackStatus}
        onConnectSlack={handleConnectSlack}
        onDisconnectSlack={handleDisconnectSlack}
      />

      {/* 2. Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          user={user}
          onLogout={logout}
          isSearching={isSearching}
        />

        {/* Action / Title Bar */}
        <div className="px-8 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">
              {searchResults !== null
                ? `Search Results (${displayEmails.length})`
                : currentTab === 'scheduled'
                ? 'Scheduled Emails'
                : 'Sent Emails'}
            </h1>
            {searchResults !== null && (
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-semibold">
                Elasticsearch Query: &quot;{searchQuery}&quot;
              </span>
            )}
          </div>

          <button
            onClick={fetchData}
            className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Refresh queue status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Content Table / List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            /* Loading State */
            <div className="p-8 space-y-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="h-12 bg-white rounded-lg border border-gray-200 animate-pulse" />
              ))}
            </div>
          ) : displayEmails.length === 0 ? (
            /* Empty State */
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
                {currentTab === 'scheduled' ? <Clock className="w-7 h-7" /> : <Inbox className="w-7 h-7" />}
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                {searchResults !== null
                  ? 'No matching emails found'
                  : currentTab === 'scheduled'
                  ? 'No scheduled emails yet'
                  : 'No sent emails yet'}
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mb-4">
                {currentTab === 'scheduled'
                  ? 'Compose an email to schedule delayed delivery via BullMQ.'
                  : 'Emails dispatched by the worker will appear here with delivery details.'}
              </p>
              {currentTab === 'scheduled' && (
                <button
                  onClick={() => setIsComposeOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Compose New Email</span>
                </button>
              )}
            </div>
          ) : (
            /* List of Email Rows (Figma p.8) */
            <div className="divide-y divide-gray-100 bg-white shadow-sm border-b border-gray-200">
              {displayEmails.map((email) => (
                <EmailRow
                  key={email.id}
                  email={email}
                  tab={currentTab}
                  onClick={() => setSelectedEmail(email)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        senders={senders}
        onSenderCreated={(sender) => {
          setSenders((prev) => [...prev, sender]);
          showToast(`Sender "${sender.email}" added`, 'success');
        }}
        onSchedule={handleScheduleCampaign}
      />

      {/* Email Detail Modal */}
      <EmailDetailModal
        email={selectedEmail}
        isOpen={selectedEmail !== null}
        onClose={() => setSelectedEmail(null)}
      />
    </div>
  );
}
