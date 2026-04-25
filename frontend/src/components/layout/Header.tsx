'use client';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { LogOut, Menu, User as UserIcon } from 'lucide-react';
import { logout } from '@/store/slices/authSlice';
import type { RootState } from '@/store/store';

interface HeaderProps {
  onOpenMobile?: () => void;
}

export default function Header({ onOpenMobile }: HeaderProps) {
  const dispatch = useDispatch();
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);

  const handleLogout = () => {
    dispatch(logout());
    router.push('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
      <button
        onClick={onOpenMobile}
        className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
            <UserIcon className="w-4 h-4 text-primary-600" />
          </div>
          <div className="text-sm hidden sm:block">
            <p className="font-medium text-gray-900 leading-tight">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-500 leading-tight">{user?.company || 'Recruiter'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          aria-label="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
