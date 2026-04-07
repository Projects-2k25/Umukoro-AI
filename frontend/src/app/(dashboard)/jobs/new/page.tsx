'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X, GripVertical } from 'lucide-react';
import Link from 'next/link';
import { jobsApi } from '@/lib/api';

export default function CreateJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    department: '',
    location: '',
    employmentType: 'FULL_TIME',
    experienceLevel: 'MID',
    minExperienceYears: 0,
    maxExperienceYears: 10,
    requiredSkills: [] as { name: string; weight: number; required: boolean }[],
    educationRequirements: [] as { level: string; field: string; required: boolean }[],
    status: 'OPEN',
  });

  const [skillInput, setSkillInput] = useState('');

  const addSkill = () => {
    if (!skillInput.trim()) return;
    setForm({
      ...form,
      requiredSkills: [...form.requiredSkills, { name: skillInput.trim(), weight: 3, required: false }],
    });
    setSkillInput('');
  };

  const removeSkill = (idx: number) => {
    setForm({ ...form, requiredSkills: form.requiredSkills.filter((_, i) => i !== idx) });
  };

  const updateSkill = (idx: number, field: string, value: any) => {
    const updated = [...form.requiredSkills];
    (updated[idx] as any)[field] = value;
    setForm({ ...form, requiredSkills: updated });
  };

  const addEducation = () => {
    setForm({
      ...form,
      educationRequirements: [...form.educationRequirements, { level: 'BACHELORS', field: '', required: false }],
    });
  };

  const handleSubmit = async (status: string) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await jobsApi.create({ ...form, status });
      router.push(`/jobs/${data._id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create job');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-[fadeIn_0.2s_ease-in-out]">
      <div className="flex items-center gap-3">
        <Link href="/jobs" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create New Job</h1>
          <p className="text-sm text-gray-500">Define the role and requirements for AI screening</p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg p-3">{error}</div>
      )}

      <div className="space-y-6">
        {/* Basic Info */}
        <div className="card-stripe p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="e.g. Senior Frontend Developer" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <input type="text" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="e.g. Engineering" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="e.g. Kigali, Rwanda" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
              <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none">
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERNSHIP">Internship</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Experience Level</label>
              <select value={form.experienceLevel} onChange={(e) => setForm({ ...form, experienceLevel: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none">
                <option value="JUNIOR">Junior</option>
                <option value="MID">Mid-Level</option>
                <option value="SENIOR">Senior</option>
                <option value="LEAD">Lead</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={6}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                placeholder="Describe the role, responsibilities, and what makes an ideal candidate..." required />
            </div>
          </div>
        </div>

        {/* Required Skills */}
        <div className="card-stripe p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Required Skills</h2>
          <p className="text-xs text-gray-500">Add skills and set their importance (1-5). Mark critical skills as required.</p>

          <div className="flex gap-2">
            <input type="text" value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="Type a skill and press Enter" />
            <button onClick={addSkill} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              <Plus className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {form.requiredSkills.length > 0 && (
            <div className="space-y-2">
              {form.requiredSkills.map((skill, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                  <GripVertical className="w-4 h-4 text-gray-300" />
                  <span className="text-sm font-medium text-gray-700 flex-1">{skill.name}</span>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Importance:</label>
                    <input type="range" min={1} max={5} value={skill.weight}
                      onChange={(e) => updateSkill(idx, 'weight', parseInt(e.target.value))}
                      className="w-20 accent-primary-600" />
                    <span className="text-xs font-mono text-gray-600 w-4">{skill.weight}</span>
                  </div>
                  <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={skill.required}
                      onChange={(e) => updateSkill(idx, 'required', e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                    Required
                  </label>
                  <button onClick={() => removeSkill(idx)} className="text-gray-400 hover:text-rose-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Experience */}
        <div className="card-stripe p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Experience Range</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Years</label>
              <input type="number" min={0} value={form.minExperienceYears}
                onChange={(e) => setForm({ ...form, minExperienceYears: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Years</label>
              <input type="number" min={0} value={form.maxExperienceYears}
                onChange={(e) => setForm({ ...form, maxExperienceYears: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
            </div>
          </div>
        </div>

        {/* Education */}
        <div className="card-stripe p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Education Requirements</h2>
            <button onClick={addEducation} className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
          {form.educationRequirements.map((edu, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
              <select value={edu.level}
                onChange={(e) => {
                  const updated = [...form.educationRequirements];
                  updated[idx].level = e.target.value;
                  setForm({ ...form, educationRequirements: updated });
                }}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                <option value="HIGH_SCHOOL">High School</option>
                <option value="DIPLOMA">Diploma</option>
                <option value="CERTIFICATE">Certificate</option>
                <option value="BACHELORS">Bachelor&apos;s</option>
                <option value="MASTERS">Master&apos;s</option>
                <option value="PHD">PhD</option>
              </select>
              <input type="text" value={edu.field} placeholder="Field (optional)"
                onChange={(e) => {
                  const updated = [...form.educationRequirements];
                  updated[idx].field = e.target.value;
                  setForm({ ...form, educationRequirements: updated });
                }}
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
              <button onClick={() => setForm({ ...form, educationRequirements: form.educationRequirements.filter((_, i) => i !== idx) })}
                className="text-gray-400 hover:text-rose-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button onClick={() => handleSubmit('DRAFT')} disabled={loading}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm disabled:opacity-50">
            Save as Draft
          </button>
          <button onClick={() => handleSubmit('OPEN')} disabled={loading || !form.title || !form.description}
            className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors text-sm disabled:opacity-50">
            {loading ? 'Creating...' : 'Publish Job'}
          </button>
        </div>
      </div>
    </div>
  );
}
