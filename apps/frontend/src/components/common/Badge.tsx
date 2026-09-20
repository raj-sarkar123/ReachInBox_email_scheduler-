'use client';

import React from 'react';
import { clsx } from 'clsx';
import { EmailStatus } from '../../types';

interface BadgeProps {
  status: EmailStatus | string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, className }) => {
  const statusStyles: Record<string, string> = {
    SCHEDULED: 'bg-amber-50 text-amber-700 border-amber-200',
    PROCESSING: 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse',
    SENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
    RATE_LIMITED_RESCHEDULED: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  const labels: Record<string, string> = {
    SCHEDULED: 'Scheduled',
    PROCESSING: 'Processing',
    SENT: 'Sent',
    FAILED: 'Failed',
    RATE_LIMITED_RESCHEDULED: 'Rescheduled (Rate Limit)',
  };

  const style = statusStyles[status] || 'bg-gray-50 text-gray-700 border-gray-200';
  const label = labels[status] || status;

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        style,
        className
      )}
    >
      {label}
    </span>
  );
};
