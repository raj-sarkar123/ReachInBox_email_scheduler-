'use client';

import React from 'react';
import { format } from 'date-fns';
import { MoreVertical, ExternalLink } from 'lucide-react';
import { Email } from '../../types';
import { Badge } from '../common/Badge';

interface EmailRowProps {
  email: Email;
  tab: 'scheduled' | 'sent';
  onClick: () => void;
}

export const EmailRow: React.FC<EmailRowProps> = ({ email, tab, onClick }) => {
  const formattedTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'EEE h:mm:ss a');
    } catch {
      return dateStr;
    }
  };

  const plainTextPreview = email.body
    ? email.body.replace(/<[^>]*>?/gm, '').substring(0, 80)
    : '';

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between px-6 py-3.5 bg-white hover:bg-gray-50/80 border-b border-gray-100 cursor-pointer transition-colors duration-150 group text-sm select-none"
    >
      {/* 1. Recipient Column (Figma: "To: John Smith") */}
      <div className="w-48 sm:w-60 flex-shrink-0">
        <span className="font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">
          To: {email.recipient}
        </span>
      </div>

      {/* 2. Subject, Time Badge, & Snippet (Figma style) */}
      <div className="flex-1 min-w-0 flex items-center gap-2.5 mr-4">
        {tab === 'scheduled' ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            {formattedTime(email.scheduledAt)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Sent {formattedTime(email.sentAt || email.updatedAt || email.createdAt)}
          </span>
        )}

        <span className="font-medium text-gray-800 truncate flex-shrink-0">
          {email.subject}
        </span>

        <span className="text-gray-400 font-light truncate hidden md:inline">
          — {plainTextPreview}
        </span>
      </div>

      {/* 3. Status Badge & Actions */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <Badge status={email.status} />

        {email.etherealPreviewUrl && (
          <a
            href={email.etherealPreviewUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1 text-gray-400 hover:text-emerald-600 rounded hover:bg-gray-100 transition-colors"
            title="View email in Ethereal web"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}

        
      </div>
    </div>
  );
};
