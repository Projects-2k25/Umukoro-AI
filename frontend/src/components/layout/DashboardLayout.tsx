'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import Sidebar from './Sidebar';
import Header from './Header';
import { hydrateAuth } from '@/store/slices/authSlice';
import type { RootState } from '@/store/store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useSelector((state: RootState) => state.auth);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    dispatch(hydrateAuth());
  }, [dispatch]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="lg:ml-60">
        <Header onOpenMobile={() => setMobileOpen(true)} />
        <main className="p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
