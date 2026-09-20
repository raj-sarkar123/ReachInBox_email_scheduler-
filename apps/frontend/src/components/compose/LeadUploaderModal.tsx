'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X, Users } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface LeadUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (validEmails: string[]) => void;
}

const EMAIL_REGEX = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+/gi;

export const LeadUploaderModal: React.FC<LeadUploaderModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [detectedEmails, setDetectedEmails] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawContent, setRawContent] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processText = (text: string, name?: string) => {
    if (name) setFileName(name);
    setRawContent(text);

    const matches = text.match(EMAIL_REGEX) || [];
    // Deduplicate and normalize
    const unique = Array.from(new Set(matches.map((e) => e.toLowerCase())));
    setDetectedEmails(unique);
  };

 const [fileError, setFileError] = useState<string | null>(null);

const isSupportedFile = (file: File) => /\.(csv|txt)$/i.test(file.name);

const handleFileUpload = (file: File) => {
  setFileError(null);
  if (!isSupportedFile(file)) {
    setFileError(`"${file.name}" isn't a supported format. Please upload a .csv or .txt file (Excel .xlsx is not supported).`);
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = (e.target?.result as string) || '';
    processText(text, file.name);
  };
  reader.readAsText(file);
};

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  setDragActive(false);
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleFileUpload(e.dataTransfer.files[0]); // now validated inside handleFileUpload
  }
};

  const handleDone = () => {
    if (detectedEmails.length > 0) {
      onImport(detectedEmails);
      handleReset();
      onClose();
    }
  };

  const handleReset = () => {
    setDetectedEmails([]);
    setFileName(null);
    setRawContent('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Email Leads (CSV or TXT)" maxWidth="md">
      <div className="space-y-4">
        {/* Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragActive ? 'border-emerald-500 bg-emerald-50/50' : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
            className="hidden"
          />
          <UploadCloud className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-800">
            Click to upload or drag & drop CSV / TXT leads
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Accepts comma-separated, tab-separated, or newline email lists
          </p>
        </div>

        {/* Manual Paste Area */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Or paste raw leads text:
          </label>
          <textarea
            value={rawContent}
            onChange={(e) => processText(e.target.value, 'Manual Paste')}
            placeholder="paste emails here..."
            rows={3}
            className="w-full p-2.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        {/* Detection Banner (Assignment requirement: "X email addresses detected") */}
        {detectedEmails.length > 0 && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-900">
                  {detectedEmails.length} email addresses detected
                </p>
                {fileName && <p className="text-[10px] text-emerald-700">Source: {fileName}</p>}
              </div>
            </div>
            <button
              onClick={handleReset}
              className="text-xs text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Preview of Detected Emails */}
        {detectedEmails.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Detected Leads Preview:</p>
            <div className="max-h-32 overflow-y-auto p-2 bg-gray-50 border border-gray-200 rounded-lg flex flex-wrap gap-1.5">
              {detectedEmails.slice(0, 20).map((email, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-white text-gray-700 border border-gray-200"
                >
                  {email}
                </span>
              ))}
              {detectedEmails.length > 20 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  +{detectedEmails.length - 20} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={detectedEmails.length === 0}
            onClick={handleDone}
            icon={<Users className="w-3.5 h-3.5" />}
          >
            Import {detectedEmails.length > 0 ? `(${detectedEmails.length})` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
