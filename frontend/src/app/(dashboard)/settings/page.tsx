'use client';
import { useSelector } from 'react-redux';
import { User } from 'lucide-react';
import type { RootState } from '@/store/store';

export default function SettingsPage() {
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <div className="max-w-2xl space-y-6 animate-[fadeIn_0.2s_ease-in-out]">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>

      <div className="card-stripe p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Profile</h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <p className="text-sm text-gray-500">{user?.company || 'No company set'}</p>
          </div>
        </div>
      </div>

      <div className="card-stripe p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-2">About Umukoro AI</h2>
        <p className="text-sm text-gray-500">
          AI-powered talent screening tool built for the Umurava AI Hackathon.
          Uses Google Gemini API to analyze, score, and rank job applicants with transparent reasoning.
        </p>
      </div>
    </div>
  );
}
