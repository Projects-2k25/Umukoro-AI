'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Users, Brain, Target, Plus, ArrowRight } from 'lucide-react';
import MetricCard from '@/components/shared/MetricCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { dashboardApi } from '@/lib/api';
import { formatDate, getScoreColor } from '@/lib/utils';
import type { DashboardOverview } from '@/types';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.overview()
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-[fadeIn_0.2s_ease-in-out]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of your recruitment screening activity</p>
        </div>
        <Link
          href="/jobs/new"
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Create Job
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Jobs" value={data?.totalJobs || 0} icon={Briefcase} variant="blue" />
        <MetricCard title="Total Applicants" value={data?.totalApplicants || 0} icon={Users} variant="green" />
        <MetricCard title="Screenings Completed" value={data?.completedScreenings || 0} icon={Brain} variant="purple" />
        <MetricCard title="Avg Match Score" value={`${data?.avgMatchScore || 0}%`} icon={Target} variant="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Screenings */}
        <div className="card-stripe p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Screenings</h2>
            <Link href="/jobs" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {data?.recentScreenings?.length ? (
            <div className="space-y-3">
              {data.recentScreenings.map((s: any) => (
                <div key={s._id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{(s.jobId as any)?.title || 'Unknown Job'}</p>
                    <p className="text-xs text-gray-500">{formatDate(s.createdAt)} &middot; {s.totalCandidatesEvaluated} candidates</p>
                  </div>
                  <StatusBadge status={s.status} type="screening" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No screenings yet. Create a job and start screening!</p>
          )}
        </div>

        {/* Top Candidates */}
        <div className="card-stripe p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Candidates</h2>
          {data?.topCandidates?.length ? (
            <div className="space-y-3">
              {data.topCandidates.map((r: any) => (
                <div key={r._id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {(r.applicantId as any)?.firstName} {(r.applicantId as any)?.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{(r.applicantId as any)?.currentTitle} &middot; {(r.jobId as any)?.title}</p>
                  </div>
                  <span className={`text-sm font-bold font-mono ${getScoreColor(r.overallScore)}`}>
                    {r.overallScore}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">Run your first screening to see top candidates</p>
          )}
        </div>
      </div>
    </div>
  );
}
