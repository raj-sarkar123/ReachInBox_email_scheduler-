import React from 'react';
import type { Metadata } from 'next';
import { ToastProvider } from '../components/common/Toast';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'ReachInbox | Outbox Email Scheduler',
  description: 'Production-grade full-stack email scheduling platform built for ReachInbox',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased text-gray-900 bg-[#F9FAFB]">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
