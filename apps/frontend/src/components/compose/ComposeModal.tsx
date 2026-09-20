'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Paperclip,
  Clock,
  Send,
  Upload,
  X,
  Plus,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Trash2,
  Calendar,
  Check,
} from 'lucide-react';
import { Sender } from '../../types';
import { LeadUploaderModal } from './LeadUploaderModal';
import { AddSenderModal } from './AddSenderModal';
import { Button } from '../common/Button';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  senders: Sender[];
  onSenderCreated?: (sender: Sender) => void;
  onSchedule: (campaignData: {
    senderId: string;
    subject: string;
    body: string;
    recipients: string[];
    startTime?: string;
    delaySeconds: number;
    hourlyLimit: number;
  }) => Promise<void>;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  senders,
  onSenderCreated,
  onSchedule,
}) => {
  const [senderId, setSenderId] = useState<string>(senders[0]?.id || '');
  const [recipientInput, setRecipientInput] = useState<string>('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [delaySeconds, setDelaySeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(100);

  // Send Later Flyout state
  const [showSendLater, setShowSendLater] = useState<boolean>(false);
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Lead uploader modal state
  const [showUploader, setShowUploader] = useState<boolean>(false);

  // Add sender modal state (multi-sender support)
  const [showAddSender, setShowAddSender] = useState<boolean>(false);

  // Keep the selected sender valid as the senders list loads/changes (e.g. after
  // the async dashboard fetch resolves, or right after a new sender is created).
  React.useEffect(() => {
    if (senders.length === 0) return;
    const stillExists = senders.some((s) => s.id === senderId);
    if (!senderId || !stillExists) {
      setSenderId(senders[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [senders]);

  const handleSenderCreated = (sender: Sender) => {
    onSenderCreated?.(sender);
    setSenderId(sender.id);
    setShowAddSender(false);
  };

  if (!isOpen) return null;

  // Add recipient chip on Enter or Comma
  const handleRecipientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addRecipient(recipientInput);
    }
  };

  const addRecipient = (raw: string) => {
    const trimmed = raw.trim().replace(/,$/, '').toLowerCase();
    if (trimmed && !recipients.includes(trimmed)) {
      setRecipients([...recipients, trimmed]);
      setRecipientInput('');
    }
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const handleLeadsImported = (importedEmails: string[]) => {
    const combined = Array.from(new Set([...recipients, ...importedEmails]));
    setRecipients(combined);
  };
const resetComposeForm = () => {
  setRecipientInput('');
  setRecipients([]);
  setSubject('');
  setBody('');
  setDelaySeconds(2);
  setHourlyLimit(100);
  setScheduledDateTime('');
  setShowSendLater(false);
  setShowUploader(false);
  setShowAddSender(false);

  if (senders.length > 0) {
    setSenderId(senders[0].id);
  }
};
  // Schedule action
  const handleScheduleSubmit = async (customStartTime?: string) => {
    if (recipients.length === 0) {
      alert('Please provide at least one recipient email address.');
      return;
    }
    if (!subject.trim()) {
      alert('Please provide an email subject.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSchedule({
        senderId: senderId || senders[0]?.id,
        subject,
        body: body || '<p></p>',
        recipients,
        startTime: customStartTime || scheduledDateTime
  ? new Date(customStartTime || scheduledDateTime).toISOString()
  : undefined,
        delaySeconds,
        hourlyLimit,
      });
      resetComposeForm();
      onClose();
    } catch (err: any) {
      console.error('Schedule failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Presets for Send Later
  const applyPreset = (hoursOffset: number, targetHour?: number) => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Tomorrow
    if (targetHour !== undefined) {
      d.setHours(targetHour, 0, 0, 0);
    } else {
      d.setHours(d.getHours() + hoursOffset);
    }
    // Format to datetime-local string
    const isoStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledDateTime(isoStr);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden relative animate-scale-up">
        {/* 1. Header (Figma style) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-semibold text-gray-900">Compose New Email</h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              title="Add attachment"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowSendLater(!showSendLater)}
              className={`p-1.5 rounded-lg transition-colors ${
                showSendLater ? 'text-emerald-700 bg-emerald-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              title="Schedule send time"
            >
              <Clock className="w-4 h-4" />
            </button>

            <Button
              onClick={() =>
  scheduledDateTime
    ? handleScheduleSubmit()
    : setShowSendLater(true)
}
              loading={isSubmitting}
              className="rounded-full px-5 py-2 text-xs font-semibold"
              icon={<Send className="w-3.5 h-3.5" />}
            >
              {scheduledDateTime ? 'Schedule Send' : 'Send Later'}
            </Button>
          </div>
        </div>

        {/* 2. Main Compose Form & Send Later Split View */}
        <div className="flex flex-1 overflow-hidden">
          {/* Compose Form */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* From Sender */}
            <div className="flex items-center border-b border-gray-100 pb-3">
              <span className="w-16 text-xs font-semibold text-gray-500">From</span>
              <select
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="flex-1 text-sm text-gray-800 bg-transparent focus:outline-none cursor-pointer"
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.email} ({s.name}) · {s.hourlyLimit}/hr
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowAddSender(true)}
                className="ml-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add sender</span>
              </button>
            </div>

            {/* To Recipients + Chips + Upload List Link */}
            <div className="border-b border-gray-100 pb-3">
              <div className="flex items-start justify-between">
                <span className="w-16 text-xs font-semibold text-gray-500 pt-1.5">To</span>
                <div className="flex-1 flex flex-wrap items-center gap-1.5">
                  {recipients.map((rec, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
                    >
                      <span>{rec}</span>
                      <button
                        onClick={() => removeRecipient(idx)}
                        className="p-0.5 hover:bg-emerald-200/60 rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}

                  <input
                    type="email"
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    onKeyDown={handleRecipientKeyDown}
                    onBlur={() => recipientInput && addRecipient(recipientInput)}
                    placeholder={recipients.length === 0 ? 'Type email and press Enter...' : 'Add more...'}
                    className="flex-1 min-w-[140px] text-sm text-gray-800 bg-transparent focus:outline-none py-1"
                  />
                </div>

                {/* Upload List Button (Figma style) */}
                <button
                  type="button"
                  onClick={() => setShowUploader(true)}
                  className="ml-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 flex-shrink-0 pt-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload List</span>
                </button>
              </div>
            </div>

            {/* Subject Input */}
            <div className="flex items-center border-b border-gray-100 pb-3">
              <span className="w-16 text-xs font-semibold text-gray-500">Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line"
                className="flex-1 text-sm text-gray-800 bg-transparent focus:outline-none font-medium"
              />
            </div>

            {/* Rate & Delay Inputs (Figma style) */}
            <div className="flex flex-wrap items-center gap-6 py-1 border-b border-gray-100 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span>Delay between 2 emails</span>
                <input
                  type="number"
                  min="0"
                  max="3600"
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 0)}
                  className="w-14 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-center font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
                <span>sec</span>
              </div>

              <div className="flex items-center gap-2">
                <span>Hourly Limit</span>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 1)}
                  className="w-14 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-center font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
                <span>emails/hr</span>
              </div>
            </div>

            {/* Rich Text Editor Toolbar (Figma style) */}
            <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-xs">
              <button type="button" className="p-1 hover:bg-gray-200 rounded">
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="p-1 hover:bg-gray-200 rounded">
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="p-1 hover:bg-gray-200 rounded">
                <Underline className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="p-1 hover:bg-gray-200 rounded">
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
              <button type="button" className="p-1 hover:bg-gray-200 rounded">
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="p-1 hover:bg-gray-200 rounded">
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="p-1 hover:bg-gray-200 rounded">
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
              <button type="button" className="p-1 hover:bg-gray-200 rounded">
                <List className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="p-1 hover:bg-gray-200 rounded">
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="p-1 hover:bg-gray-200 rounded">
                <Quote className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="p-1 hover:bg-gray-200 rounded">
                <LinkIcon className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="p-1 hover:bg-gray-200 rounded">
                <ImageIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setBody('')}
                className="p-1 hover:bg-gray-200 rounded ml-auto text-gray-400 hover:text-rose-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Email Body Editor */}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your email body here (HTML or plain text)..."
              rows={12}
              className="w-full p-4 text-sm text-gray-800 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans leading-relaxed"
            />
          </div>

          {/* 3. Send Later Flyout Panel on Right (Figma p.9 bottom screenshot) */}
          {showSendLater && (
            <div className="w-80 border-l border-gray-200 p-6 bg-gray-50/50 flex flex-col justify-between animate-slide-left flex-shrink-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>Send Later</span>
                  </h3>
                  <button
                    onClick={() => setShowSendLater(false)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Pick date & time:
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledDateTime}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Presets matching Figma Page 9 */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Quick Presets
                  </p>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => applyPreset(24)}
                      className="w-full px-3 py-2 text-left text-xs bg-white hover:bg-emerald-50 hover:text-emerald-800 border border-gray-200 rounded-lg transition-colors flex items-center justify-between"
                    >
                      <span>Tomorrow</span>
                      <span className="text-[10px] text-gray-400">+24h</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset(0, 10)}
                      className="w-full px-3 py-2 text-left text-xs bg-white hover:bg-emerald-50 hover:text-emerald-800 border border-gray-200 rounded-lg transition-colors flex items-center justify-between"
                    >
                      <span>Tomorrow, 10:00 AM</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset(0, 11)}
                      className="w-full px-3 py-2 text-left text-xs bg-white hover:bg-emerald-50 hover:text-emerald-800 border border-gray-200 rounded-lg transition-colors flex items-center justify-between"
                    >
                      <span>Tomorrow, 11:00 AM</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset(0, 15)}
                      className="w-full px-3 py-2 text-left text-xs bg-white hover:bg-emerald-50 hover:text-emerald-800 border border-gray-200 rounded-lg transition-colors flex items-center justify-between"
                    >
                      <span>Tomorrow, 3:00 PM</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Cancel and Done Buttons (Figma style) */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setScheduledDateTime('');
                    setShowSendLater(false);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowSendLater(false)}
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lead Uploader Modal */}
        <LeadUploaderModal
          isOpen={showUploader}
          onClose={() => setShowUploader(false)}
          onImport={handleLeadsImported}
        />

        {/* Add Sender Modal (multi-sender support) */}
        <AddSenderModal
          isOpen={showAddSender}
          onClose={() => setShowAddSender(false)}
          onCreated={handleSenderCreated}
        />
      </div>
    </div>
  );
};
