"use client";

import React from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  Star,
  Trash2,
  MoreVertical,
  ExternalLink,
} from "lucide-react";
import { Email } from "../../types";
import { Badge } from "../common/Badge";

interface EmailDetailModalProps {
  email: Email | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
}

export const EmailDetailModal: React.FC<EmailDetailModalProps> = ({
  email,
  isOpen,
  onClose,
  onDelete,
}) => {
  if (!isOpen || !email) return null;

  console.log('onDelete is:', typeof onDelete); // ← add this temporarily

  const formattedDate = (dateStr?: string | null) => {
    if (!dateStr) return "";
    try {
      return format(new Date(dateStr), "MMM d, h:mm a");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
        {/* 1. Detail Header (Figma style) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-semibold text-gray-900 truncate max-w-md">
              {email.subject}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-1.5 text-gray-400 hover:text-amber-500 rounded-lg hover:bg-gray-100 transition-colors">
              <Star className="w-4 h-4" />
            </button>
            <button
              onClick={async () => {
                if (!confirm("Delete this email permanently?")) return;
                await onDelete(email.id);
                onClose();
              }}
              className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Sender and Recipient Info */}
        <div className="px-8 py-5 border-b border-gray-100 flex items-start justify-between bg-gray-50/40">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-sm shadow-sm">
              {email.sender?.name
                ? email.sender.name.charAt(0).toUpperCase()
                : "S"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 text-sm">
                  {email.sender?.name || "Sender"}
                </span>
                <span className="text-xs text-gray-500">
                  &lt;{email.sender?.email || "sender@domain.com"}&gt;
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                to{" "}
                <span className="text-gray-700 font-medium">
                  {email.recipient}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span className="text-xs text-gray-500">
              {formattedDate(email.sentAt || email.scheduledAt)}
            </span>
            <Badge status={email.status} />
          </div>
        </div>

        {/* 3. Email Body Content */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1 text-sm text-gray-800 leading-relaxed">
          {/* Render raw HTML body safely */}
          <div
            className="prose prose-sm max-w-none text-gray-800 font-normal space-y-4"
            dangerouslySetInnerHTML={{ __html: email.body }}
          />

          {/* Figma Style Highlight Card if present or demo */}
          <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
            <p className="text-xs font-semibold text-amber-900 mb-1">
              ⚡ Status Details & Idempotency
            </p>
            <p className="text-xs text-amber-800 font-mono">
              Key: {email.idempotencyKey}
            </p>
            {email.failureReason && (
              <p className="text-xs text-rose-700 mt-1">
                Reason: {email.failureReason}
              </p>
            )}
          </div>

          {/* Attachments Section (Figma p.9 style) */}
        </div>

        {/* 4. Footer Actions (Ethereal Web Link) */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {email.sentAt
              ? `Delivered at: ${formattedDate(email.sentAt)}`
              : `Scheduled for: ${formattedDate(email.scheduledAt)}`}
          </div>

          <div className="flex items-center gap-3">
            {email.etherealPreviewUrl && (
              <a
                href={email.etherealPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
              >
                <span>View on Ethereal Web</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
