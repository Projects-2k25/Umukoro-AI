'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Users, Brain } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { jobsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Job, PaginatedResponse } from '@/types';

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await jobsApi.list(params);
      setJobs(data.data || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, [search, statusFilter]);

  return (
    <div className="space-y-6 animate-[fadeIn_0.2s_ease-in-out]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Jobs</h1>
          <p className="text-sm text-gray-500 mt-1">{total} job{total !== 1 ? 's' : ''} total</p>
        </div>
        <Link
          href="/jobs/new"
          className="inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Job
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="OPEN">Open</option>
          <option value="SCREENING">Screening</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {/* Jobs Table */}
      <div className="card-stripe overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Job Title</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Applicants</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Screenings</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">Loading...</td></tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <p className="text-sm text-gray-500">No jobs found</p>
                  <Link href="/jobs/new" className="text-sm text-primary-600 font-medium mt-1 inline-block">Create your first job</Link>
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr
                  key={job._id}
                  onClick={() => router.push(`/jobs/${job._id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{job.title}</p>
                    <p className="text-xs text-gray-500">{job.location || 'Remote'}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{job.department || '-'}</td>
                  <td className="px-6 py-4"><StatusBadge status={job.status} type="job" /></td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-700">
                      <Users className="w-3.5 h-3.5 text-gray-400" /> {job.totalApplicants}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-700">
                      <Brain className="w-3.5 h-3.5 text-gray-400" /> {job.totalScreenings}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(job.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
