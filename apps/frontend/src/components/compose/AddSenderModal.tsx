'use client';

import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api } from '../../lib/api';
import { Sender } from '../../types';

interface AddSenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (sender: Sender) => void;
}

export const AddSenderModal: React.FC<AddSenderModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [hourlyLimit, setHourlyLimit] = useState<number>(100);
  const [delaySeconds, setDelaySeconds] = useState<number>(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setEmail('');
    setHourlyLimit(100);
    setDelaySeconds(2);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim()) {
      setError('Sender name and email are both required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post('/senders', {
        name: name.trim(),
        email: email.trim(),
        hourlyLimit,
        delaySeconds,
      });

      if (res.data.success) {
        onCreated(res.data.data as Sender);
        resetForm();
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create sender. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Sender Account" maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-gray-500 -mt-2">
          Each sender gets its own hourly rate limit and minimum delay between sends, tracked
          independently in Redis.
        </p>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Sender Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sales Team"
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Sender Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="sales@yourdomain.com"
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            required
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Sends still route through the shared Ethereal SMTP test account for this demo; this
            is the &quot;From&quot; identity attached to scheduled campaigns.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Hourly Limit
            </label>
            <input
              type="number"
              min={1}
              max={10000}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Delay (sec)
            </label>
            <input
              type="number"
              min={0}
              max={3600}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={isSubmitting} icon={<UserPlus className="w-3.5 h-3.5" />}>
            Add Sender
          </Button>
        </div>
      </form>
    </Modal>
  );
};
