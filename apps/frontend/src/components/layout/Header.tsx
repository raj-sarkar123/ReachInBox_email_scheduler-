'use client';

import React, { useState } from 'react';
import { Search, SlidersHorizontal, LogOut, User as UserIcon, Check } from 'lucide-react';
import { User } from '../../types';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  user: User | null;
  onLogout: () => void;
  isSearching?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  user,
  onLogout,
  isSearching,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between z-10 flex-shrink-0">
      {/* 1. Global Elasticsearch Search Input */}
      <div className="flex-1 max-w-xl">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search emails by recipient, subject, or content (Elasticsearch)..."
            className="w-full pl-10 pr-10 py-2 bg-gray-50 hover:bg-gray-100 focus:bg-white text-sm text-gray-800 placeholder-gray-400 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
          {isSearching ? (
            <div className="absolute right-3 w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          ) : (
           <></>
          )}
        </div>
      </div>

      {/* 2. Right Side: Profile & Logout */}
      <div className="flex items-center gap-4 relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <img
            src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256'}
            alt="Profile"
            className="w-8 h-8 rounded-full object-cover border border-gray-200"
          />
          <span className="text-xs font-semibold text-gray-700 hidden sm:inline-block">
            {user?.name || 'Oliver Brown'}
          </span>
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-12 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 animate-scale-up">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-900 truncate">{user?.name}</p>
              <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => {
                setDropdownOpen(false);
                onLogout();
              }}
              className="w-full px-4 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Log out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
