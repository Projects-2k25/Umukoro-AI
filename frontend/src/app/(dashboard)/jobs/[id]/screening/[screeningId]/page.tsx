'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ChevronDown, ChevronUp, Check, AlertTriangle,
} from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts';
import { screeningsApi } from '@/lib/api';
import { cn, getScoreColor, getRecommendationStyle, formatDate } from '@/lib/utils';
import type { Screening, ScreeningResult, Applicant } from '@/types';

function scoreColor(s: number) {
  if (s >= 85) return '#15803d';
  if (s >= 70) return '#1d4ed8';
  if (s >= 55) return '#b45309';
  return '#b91c1c';
}

export default function ScreeningResultsPage() {
  const { id, screeningId } = useParams<{ id: string; screeningId: string }>();
  const [screening, setScreening] = useState<Screening | null>(null);
  const [results, setResults] = useState<ScreeningResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    screeningsApi.get(screeningId).then(({ data }) => {
      setScreening(data.screening);
      setResults(data.results || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [screeningId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-700" />
      </div>
    );
  }

  if (!screening) {
    return <div className="text-center py-12 text-sm text-gray-500">Screening not found</div>;
  }

  const jobTitle = typeof screening.jobId === 'object' ? (screening.jobId as any).title : 'Job';
  const topScore = results.length > 0 ? results[0].overallScore : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Link href={`/jobs/${id}`} className="p-2 hover:bg-gray-100 rounded-md transition-colors mt-0.5">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Screening results</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {jobTitle} · {formatDate(screening.createdAt)} · {screening.totalCandidatesEvaluated} candidates
            {screening.processingTimeMs > 0 && ` · ${(screening.processingTimeMs / 1000).toFixed(1)}s`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 border border-gray-200 rounded-md divide-x divide-gray-200">
        {[
          { label: 'Evaluated', value: screening.totalCandidatesEvaluated },
          { label: 'Shortlisted', value: results.length },
          { label: 'Top score', value: `${topScore}` },
          { label: 'Average', value: `${screening.averageMatchScore}` },
        ].map((m) => (
          <div key={m.label} className="px-5 py-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{m.label}</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1 font-mono tabular-nums">{m.value}</p>
          </div>
        ))}
      </div>

      {results.length > 0 && (
        <div className="border border-gray-200 rounded-md p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Score distribution</h2>
            <p className="text-xs text-gray-500">Overall match, top {results.length}</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={results.map((r) => {
              const applicant = r.applicantId as Applicant;
              return {
                name: applicant?.firstName ? `${applicant.firstName} ${(applicant.lastName || '')[0]}.` : `#${r.rank}`,
                score: r.overallScore,
              };
            })} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: '#f3f4f6' }}
                formatter={(value) => [`${value}`, 'Score']}
                contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 4, padding: '6px 8px' }}
              />
              <Bar dataKey="score" radius={[2, 2, 0, 0]}>
                {results.map((r, i) => <Cell key={i} fill={scoreColor(r.overallScore)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Ranked shortlist</h2>

        <div className="border border-gray-200 rounded-md divide-y divide-gray-200">
          {results.map((result) => {
            const applicant = result.applicantId as Applicant;
            const isExpanded = expandedId === result._id;
            const recStyle = getRecommendationStyle(result.recommendation);

            const radarData = [
              { dimension: 'Skills', score: result.skillsScore, fullMark: 100 },
              { dimension: 'Experience', score: result.experienceScore, fullMark: 100 },
              { dimension: 'Education', score: result.educationScore, fullMark: 100 },
              { dimension: 'Relevance', score: result.relevanceScore, fullMark: 100 },
            ];

            return (
              <div key={result._id}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : result._id)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-sm font-mono tabular-nums text-gray-500 w-6">
                    {result.rank}.
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {applicant?.firstName} {applicant?.lastName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {applicant?.headline || applicant?.currentTitle || ''}
                    </p>
                  </div>

                  <div className="hidden lg:flex items-center gap-3 w-56">
                    <div className="flex-1 bg-gray-100 rounded-sm h-1.5">
                      <div
                        className="h-1.5 rounded-sm"
                        style={{ width: `${result.overallScore}%`, backgroundColor: scoreColor(result.overallScore) }}
                      />
                    </div>
                    <span className={cn('text-sm font-semibold font-mono tabular-nums w-8 text-right', getScoreColor(result.overallScore))}>
                      {result.overallScore}
                    </span>
                  </div>

                  <span className={cn('px-2 py-0.5 rounded text-xs font-medium', recStyle.bg, recStyle.text)}>
                    {recStyle.label}
                  </span>

                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                    : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {isExpanded && (
                  <div className="px-5 py-5 bg-gray-50/60 border-t border-gray-200">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Match profile</p>
                        <ResponsiveContainer width="100%" height={200}>
                          <RadarChart data={radarData}>
                            <PolarGrid stroke="#e5e7eb" />
                            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: '#6b7280' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#9ca3af' }} />
                            <Radar dataKey="score" stroke="#1f2937" fill="#1f2937" fillOpacity={0.12} strokeWidth={1.5} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Score breakdown</p>
                        <div className="space-y-3">
                          {[
                            { label: 'Skills', score: result.skillsScore },
                            { label: 'Experience', score: result.experienceScore },
                            { label: 'Education', score: result.educationScore },
                            { label: 'Relevance', score: result.relevanceScore },
                          ].map((dim) => (
                            <div key={dim.label}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-700">{dim.label}</span>
                                <span className="text-xs font-mono tabular-nums text-gray-900">{dim.score}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-sm h-1">
                                <div
                                  className="h-1 rounded-sm"
                                  style={{ width: `${dim.score}%`, backgroundColor: scoreColor(dim.score) }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {result.dimensionAnalysis?.length > 0 && (
                          <div className="mt-5 pt-4 border-t border-gray-200 space-y-2">
                            {result.dimensionAnalysis.map((d, i) => (
                              <div key={i} className="text-xs text-gray-600 leading-relaxed">
                                <span className="font-medium text-gray-800">{d.dimension}.</span>{' '}
                                {d.rationale}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-5">
                        {result.strengths.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Strengths</p>
                            <ul className="space-y-1.5">
                              {result.strengths.map((s, i) => (
                                <li key={i} className="text-xs text-gray-700 flex items-start gap-2 leading-relaxed">
                                  <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {result.gaps.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Gaps</p>
                            <ul className="space-y-1.5">
                              {result.gaps.map((g, i) => (
                                <li key={i} className="text-xs text-gray-700 flex items-start gap-2 leading-relaxed">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                                  {g}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {result.reasoningSummary && (
                          <div className="border-l-2 border-gray-300 pl-3">
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Summary</p>
                            <p className="text-xs text-gray-700 leading-relaxed">{result.reasoningSummary}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
