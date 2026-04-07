'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Users, Clock, Target, Trophy,
  ChevronDown, ChevronUp, CheckCircle, AlertTriangle, XCircle,
  Sparkles, TrendingUp,
} from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts';
import MetricCard from '@/components/shared/MetricCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { screeningsApi } from '@/lib/api';
import { cn, getScoreColor, getScoreBgColor, getRecommendationStyle, formatDate } from '@/lib/utils';
import type { Screening, ScreeningResult, Applicant } from '@/types';

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
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        <p className="text-sm text-gray-500">Loading screening results...</p>
      </div>
    );
  }

  if (!screening) {
    return <div className="text-center py-12"><p className="text-gray-500">Screening not found</p></div>;
  }

  const jobTitle = typeof screening.jobId === 'object' ? (screening.jobId as any).title : 'Job';
  const topScore = results.length > 0 ? results[0].overallScore : 0;

  return (
    <div className="space-y-6 animate-[fadeIn_0.2s_ease-in-out]">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href={`/jobs/${id}`} className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-0.5">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Screening Results</h1>
          <p className="text-sm text-gray-500 mt-1">
            {jobTitle} &middot; {formatDate(screening.createdAt)} &middot;{' '}
            {screening.totalCandidatesEvaluated} candidates evaluated
            {screening.processingTimeMs > 0 && ` in ${(screening.processingTimeMs / 1000).toFixed(1)}s`}
          </p>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Candidates Evaluated" value={screening.totalCandidatesEvaluated} icon={Users} variant="blue" />
        <MetricCard title="Shortlisted" value={results.length} icon={Trophy} variant="green" />
        <MetricCard title="Top Score" value={`${topScore}%`} icon={TrendingUp} variant="purple" />
        <MetricCard title="Average Score" value={`${screening.averageMatchScore}%`} icon={Target} variant="orange" />
      </div>

      {/* Score Distribution Chart */}
      {results.length > 0 && (
        <div className="card-stripe p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Score Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={results.map((r) => {
              const applicant = r.applicantId as Applicant;
              return {
                name: applicant?.firstName ? `${applicant.firstName} ${(applicant.lastName || '')[0]}.` : `#${r.rank}`,
                score: r.overallScore,
              };
            })}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`${value}%`, 'Score']} />
              <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                {results.map((r, i) => (
                  <Cell key={i} fill={r.overallScore >= 85 ? '#16a34a' : r.overallScore >= 70 ? '#2563eb' : r.overallScore >= 55 ? '#d97706' : '#dc2626'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ranked Results Table */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Ranked Shortlist</h2>

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
            <div key={result._id} className="card-stripe overflow-hidden transition-all">
              {/* Row */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : result._id)}
                className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
              >
                {/* Rank */}
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0',
                  result.rank === 1 ? 'bg-amber-100 text-amber-700' :
                  result.rank === 2 ? 'bg-gray-100 text-gray-600' :
                  result.rank === 3 ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-50 text-gray-500'
                )}>
                  #{result.rank}
                </div>

                {/* Name & Title */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {applicant?.firstName} {applicant?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {applicant?.currentTitle}{applicant?.currentCompany ? ` at ${applicant.currentCompany}` : ''}
                  </p>
                </div>

                {/* Score Bar */}
                <div className="w-48 hidden lg:block">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className={cn('h-2 rounded-full transition-all', getScoreBgColor(result.overallScore))}
                        style={{ width: `${result.overallScore}%`, backgroundColor: result.overallScore >= 85 ? '#16a34a' : result.overallScore >= 70 ? '#2563eb' : result.overallScore >= 55 ? '#d97706' : '#dc2626' }}
                      />
                    </div>
                    <span className={cn('text-sm font-bold font-mono w-10 text-right', getScoreColor(result.overallScore))}>
                      {result.overallScore}
                    </span>
                  </div>
                </div>

                {/* Recommendation Badge */}
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', recStyle.bg, recStyle.text)}>
                  {recStyle.label}
                </span>

                {/* Top Strength (preview) */}
                <p className="text-xs text-gray-500 max-w-xs truncate hidden xl:block">
                  {result.strengths[0] || ''}
                </p>

                {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-6 bg-gray-50/50 animate-[slideUp_0.2s_ease-out]">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Radar Chart */}
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center mb-2">
                        <span className="text-white font-bold text-lg">{result.overallScore}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">Overall Match Score</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="#e5e7eb" />
                          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: '#6b7280' }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                          <Radar name="Score" dataKey="score" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.3} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Dimension Scores */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900">Score Breakdown</h3>
                      {[
                        { label: 'Skills Match', score: result.skillsScore },
                        { label: 'Experience', score: result.experienceScore },
                        { label: 'Education', score: result.educationScore },
                        { label: 'Relevance', score: result.relevanceScore },
                      ].map((dim) => (
                        <div key={dim.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-600">{dim.label}</span>
                            <span className={cn('text-xs font-bold font-mono', getScoreColor(dim.score))}>{dim.score}/100</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all duration-500"
                              style={{
                                width: `${dim.score}%`,
                                backgroundColor: dim.score >= 85 ? '#16a34a' : dim.score >= 70 ? '#2563eb' : dim.score >= 55 ? '#d97706' : '#dc2626',
                              }}
                            />
                          </div>
                        </div>
                      ))}

                      {/* Dimension Rationale */}
                      {result.dimensionAnalysis.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {result.dimensionAnalysis.map((d, i) => (
                            <div key={i} className="text-xs text-gray-500">
                              <span className="font-medium text-gray-700">{d.dimension}:</span> {d.rationale}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Strengths, Gaps, Reasoning */}
                    <div className="space-y-4">
                      {/* Strengths */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 mb-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500" /> Strengths
                        </h3>
                        <ul className="space-y-1">
                          {result.strengths.map((s, i) => (
                            <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                              <span className="text-emerald-500 mt-0.5">+</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Gaps */}
                      {result.gaps.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 mb-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" /> Gaps
                          </h3>
                          <ul className="space-y-1">
                            {result.gaps.map((g, i) => (
                              <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                                <span className="text-amber-500 mt-0.5">-</span> {g}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* AI Reasoning */}
                      {result.reasoningSummary && (
                        <div className="bg-gradient-to-r from-primary-50 to-purple-50 border border-primary-100 rounded-lg p-4">
                          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 mb-2">
                            <Sparkles className="w-4 h-4 text-primary-500" /> AI Reasoning
                          </h3>
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
  );
}
