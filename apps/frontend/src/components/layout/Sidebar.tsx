'use client';

import React from 'react';
import { Clock, Send, Plus, Slack, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { User, SlackStatus } from '../../types';

interface SidebarProps {
  currentTab: 'scheduled' | 'sent';
  onSelectTab: (tab: 'scheduled' | 'sent') => void;
  onOpenCompose: () => void;
  user: User | null;
  scheduledCount: number;
  sentCount: number;
  slackStatus: SlackStatus;
  onConnectSlack: () => void;
  onDisconnectSlack: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenCompose,
  user,
  scheduledCount,
  sentCount,
  slackStatus,
  onConnectSlack,
  onDisconnectSlack,
}) => {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen flex-shrink-0 select-none">
      {/* 1. App Brand Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-sm tracking-wider shadow-sm">
            ON8
          </div>
          <div>
            <span className="font-bold text-gray-900 text-base tracking-tight">ReachInbox</span>
            <span className="ml-1 text-[10px] font-semibold uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
              Outbox
            </span>
          </div>
        </div>
      </div>

      {/* 2. User Profile Card (Matches Figma Oliver Brown) */}
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3">
          <img
            src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256'}
            alt={user?.name || 'User Avatar'}
            className="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {user?.name || 'Oliver Brown'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user?.email || 'oliver.brown@domain.io'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Primary Compose Button (Figma Pill Button) */}
      <div className="p-4">
        <button
          onClick={onOpenCompose}
          className="w-full py-2.5 px-4 rounded-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all duration-150 hover:shadow"
        >
          <Plus className="w-4 h-4" />
          <span>Compose</span>
        </button>
      </div>

      {/* 4. Navigation Links */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        <button
          onClick={() => onSelectTab('scheduled')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            currentTab === 'scheduled'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <Clock className={`w-4 h-4 ${currentTab === 'scheduled' ? 'text-emerald-600' : 'text-gray-400'}`} />
            <span>Scheduled</span>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              currentTab === 'scheduled'
                ? 'bg-emerald-200/70 text-emerald-900'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {scheduledCount}
          </span>
        </button>

        <button
          onClick={() => onSelectTab('sent')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            currentTab === 'sent'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <Send className={`w-4 h-4 ${currentTab === 'sent' ? 'text-emerald-600' : 'text-gray-400'}`} />
            <span>Sent</span>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              currentTab === 'sent'
                ? 'bg-emerald-200/70 text-emerald-900'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {sentCount}
          </span>
        </button>
      </nav>

      {/* 5. Footer Widgets: Bull Board & Slack Integration */}
      <div className="p-4 border-t border-gray-200 space-y-2 bg-gray-50/50">
        {/* Bull Board Quick Link */}
        <a
          href="http://localhost:5000/admin/queues"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-gray-600 hover:text-emerald-700 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all"
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            BullMQ Dashboard
          </span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        {/* Slack Connection Widget */}
        <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
              <Slack className="w-3.5 h-3.5 text-purple-600" />
              <span>Slack Alerts</span>
            </div>
            {slackStatus.connected ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                <AlertCircle className="w-3 h-3" /> Offline
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 mb-2 leading-relaxed">
            {slackStatus.connected
              ? `Channel: ${slackStatus.channel || slackStatus.teamName || 'Active'}`
              : 'Receive real Slack alerts when hourly sender limits are exceeded.'}
          </p>
          {slackStatus.connected ? (
            <button
              onClick={onDisconnectSlack}
              className="w-full py-1 text-[11px] font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition-colors"
            >
              Disconnect Slack
            </button>
          ) : (
            <button
              onClick={onConnectSlack}
              className="w-full py-1 text-[11px] font-medium text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Slack className="w-3 h-3" /> Connect Slack
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
