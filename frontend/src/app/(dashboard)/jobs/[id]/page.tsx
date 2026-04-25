'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Upload, FileSpreadsheet, FileText, FileJson, ClipboardPaste,
  Users, Brain, Play, Loader2, CheckCircle, AlertCircle, Trash2, X,
} from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { jobsApi, applicantsApi, screeningsApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import type { Job, Applicant, Screening } from '@/types';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'applicants' | 'screenings'>('applicants');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [screening, setScreening] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [pasting, setPasting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [jobRes, appRes, scrRes] = await Promise.all([
        jobsApi.get(id),
        applicantsApi.list({ jobId: id, limit: 100 }),
        screeningsApi.list({ jobId: id }),
      ]);
      setJob(jobRes.data.job);
      setApplicants(appRes.data.data || []);
      setScreenings(scrRes.data || []);
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadResult(null);
    try {
      const { data } = await applicantsApi.upload(id, file);
      setUploadResult({ success: true, imported: data.imported, errors: data.errors || [] });
      fetchData();
    } catch (err: any) {
      setUploadResult({ success: false, error: err.response?.data?.message || 'Upload failed' });
    }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handlePasteImport = async () => {
    setPasteError('');
    let parsed: any;
    try {
      parsed = JSON.parse(pasteText);
    } catch {
      setPasteError('Invalid JSON. Make sure you pasted a valid JSON array or object.');
      return;
    }

    const profiles = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.profiles)
        ? parsed.profiles
        : Array.isArray(parsed?.applicants)
          ? parsed.applicants
          : null;

    if (!profiles || profiles.length === 0) {
      setPasteError('JSON must be an array of profiles, or contain a "profiles" or "applicants" array.');
      return;
    }

    setPasting(true);
    try {
      const { data } = await applicantsApi.importProfiles(id, profiles);
      setUploadResult({ success: true, imported: data.imported, errors: [] });
      setPasteOpen(false);
      setPasteText('');
      fetchData();
    } catch (err: any) {
      setPasteError(err.response?.data?.message || 'Import failed');
    }
    setPasting(false);
  };

  const handleScreening = async () => {
    setScreening(true);
    try {
      const { data } = await screeningsApi.create({ jobId: id, config: { shortlistSize: 10 } });
      const screeningId = data.screening._id;
      router.push(`/jobs/${id}/screening/${screeningId}`);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Screening failed');
    }
    setScreening(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  }

  if (!job) {
    return <div className="text-center py-12"><p className="text-gray-500">Job not found</p></div>;
  }

  return (
    <div className="space-y-6 animate-[fadeIn_0.2s_ease-in-out]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Link href="/jobs" className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-0.5">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{job.title}</h1>
              <StatusBadge status={job.status} type="job" />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {job.department && `${job.department} · `}{job.location || 'Remote'} · {job.experienceLevel} · {formatDate(job.createdAt)}
            </p>
          </div>
        </div>
        <button
          onClick={handleScreening}
          disabled={screening || applicants.length === 0}
          className={cn(
            'inline-flex items-center gap-2 font-semibold py-2.5 px-5 rounded-lg transition-all text-sm',
            applicants.length === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'
          )}
        >
          {screening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          {screening ? 'Screening...' : `Screen ${applicants.length} Candidates`}
        </button>
      </div>

      {/* Skills tags */}
      {job.requiredSkills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {job.requiredSkills.map((skill, i) => (
            <span key={i} className={cn(
              'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
              skill.required ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
            )}>
              {skill.name}
              {skill.required && <span className="ml-1 text-primary-500">*</span>}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {(['applicants', 'screenings'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors capitalize',
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}>
              {tab === 'applicants' ? <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> Applicants ({applicants.length})</span>
                : <span className="flex items-center gap-1.5"><Brain className="w-4 h-4" /> Screenings ({screenings.length})</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Applicants Tab */}
      {activeTab === 'applicants' && (
        <div className="space-y-4">
          {/* Upload Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center transition-all',
              dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
            )}
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Drag & drop your file here</p>
            <p className="text-xs text-gray-500 mt-1">Supports CSV, XLSX, PDF, and JSON files (max 10MB)</p>
            <div className="flex justify-center flex-wrap gap-3 mt-4">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                <FileSpreadsheet className="w-4 h-4" />
                Upload Spreadsheet
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
              </label>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                <FileText className="w-4 h-4" />
                Upload Resume PDF
                <input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
              </label>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                <FileJson className="w-4 h-4" />
                Upload JSON Profiles
                <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
              </label>
              <button
                type="button"
                onClick={() => { setPasteOpen(true); setPasteError(''); }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <ClipboardPaste className="w-4 h-4" />
                Paste JSON
              </button>
            </div>
            {uploading && <p className="text-sm text-primary-600 mt-3 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Processing file...</p>}
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div className={cn(
              'rounded-lg p-3 text-sm flex items-start gap-2',
              uploadResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            )}>
              {uploadResult.success ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              <div>
                {uploadResult.success
                  ? <p>{uploadResult.imported} applicant{uploadResult.imported !== 1 ? 's' : ''} imported successfully</p>
                  : <p>{uploadResult.error}</p>}
                {uploadResult.errors?.length > 0 && (
                  <p className="text-xs mt-1">{uploadResult.errors.length} row(s) skipped due to errors</p>
                )}
              </div>
            </div>
          )}

          {/* Applicants List */}
          {applicants.length > 0 && (
            <div className="card-stripe overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Skills</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Experience</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Location</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Availability</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Source</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {applicants.map((a) => (
                    <tr key={a._id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <p className="text-sm font-medium text-gray-900">{a.firstName} {a.lastName}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[200px]">{a.headline || a.email || a.currentTitle || ''}</p>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {a.skills.slice(0, 3).map((s, i) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                              {s.name}{s.level ? ` · ${s.level}` : ''}
                            </span>
                          ))}
                          {a.skills.length > 3 && <span className="text-xs text-gray-400">+{a.skills.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">{a.totalExperienceYears}yr</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{a.location || '—'}</td>
                      <td className="px-6 py-3">
                        {a.availability?.status ? (
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            a.availability.status === 'Available' ? 'bg-emerald-100 text-emerald-700' :
                            a.availability.status === 'Open to Opportunities' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          )}>{a.availability.status}</span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-3"><StatusBadge status={a.source} type="job" /></td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={() => applicantsApi.delete(a._id).then(fetchData)}
                          className="text-gray-400 hover:text-rose-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Screenings Tab */}
      {activeTab === 'screenings' && (
        <div className="space-y-3">
          {screenings.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">No screenings yet. Add applicants and click &quot;Screen Candidates&quot; to start.</p>
          ) : (
            screenings.map((s: any) => (
              <Link key={s._id} href={`/jobs/${id}/screening/${s._id}`}
                className="card-stripe p-4 flex items-center justify-between hover:shadow-md transition-all block">
                <div>
                  <p className="text-sm font-medium text-gray-900">Screening &middot; {formatDate(s.createdAt)}</p>
                  <p className="text-xs text-gray-500">{s.totalCandidatesEvaluated} candidates &middot; {s.processingTimeMs ? `${(s.processingTimeMs / 1000).toFixed(1)}s` : 'Processing...'}</p>
                </div>
                <div className="flex items-center gap-3">
                  {s.averageMatchScore > 0 && (
                    <span className="text-sm font-mono font-bold text-gray-700">Avg: {s.averageMatchScore}%</span>
                  )}
                  <StatusBadge status={s.status} type="screening" />
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => !pasting && setPasteOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Paste JSON Profiles</h3>
                <p className="text-xs text-gray-500 mt-0.5">Paste a JSON array of profiles, or an object with a &quot;profiles&quot; / &quot;applicants&quot; array.</p>
              </div>
              <button onClick={() => !pasting && setPasteOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`[
  {
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "headline": "Backend Engineer",
    "location": "Kigali, Rwanda",
    "skills": [{ "name": "Node.js", "level": "Advanced", "yearsOfExperience": 4 }]
  }
]`}
                className="w-full h-72 font-mono text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                spellCheck={false}
              />
              {pasteError && (
                <div className="rounded-lg bg-rose-50 text-rose-700 text-sm px-3 py-2 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>{pasteError}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setPasteOpen(false)}
                disabled={pasting}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteImport}
                disabled={pasting || !pasteText.trim()}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors',
                  pasting || !pasteText.trim()
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-700 text-white'
                )}
              >
                {pasting && <Loader2 className="w-4 h-4 animate-spin" />}
                {pasting ? 'Importing...' : 'Import Profiles'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
