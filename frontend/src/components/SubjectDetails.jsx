import React, { useEffect, useState } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { adminApi } from '../api';
import { usePageRefresh } from '../context/RefreshContext';
import {
  ArrowLeft,
  BookOpen,
  Building2,
  Calendar,
  Award,
  Hash,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  Layers,
  Edit3,
  X,
  GraduationCap,
  FileText,
  Clock,
  ExternalLink,
  UserX
} from 'lucide-react';

export default function SubjectDetails() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [subject, setSubject] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Edit Subject Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    code: '',
    department: '',
    academicYear: '',
    subjectType: 'Theory',
    credits: '',
    description: '',
    semester: ''
  });
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [departmentSelect, setDepartmentSelect] = useState('');

  const subjectTypesList = ['Theory', 'Practical', 'Elective', 'Seminar', 'Project'];
  const academicYearsList = ['First Year', 'Second Year', 'Third Year', 'Fourth Year'];

  const fetchDepartments = async () => {
    try {
      const res = await adminApi.getDepartments();
      if (res && res.success) {
        setDepartments(res.departments || []);
      }
    } catch (err) {
      console.error('Failed to load departments in SubjectDetails:', err);
    }
  };

  const fetchSubjectData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.getSubjectById(id);
      if (res.success && res.subject) {
        setSubject(res.subject);
      } else {
        setError(res.error || 'Subject not found');
      }
    } catch (err) {
      console.error('Failed to fetch subject details:', err);
      setError(err.response?.data?.error || 'Failed to load subject details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjectData();
    fetchDepartments();
  }, [id]);

  // Handle auto-refresh triggered via RefreshContext
  usePageRefresh(fetchSubjectData);

  const handleOpenEdit = () => {
    if (!subject) return;

    const deptVal = subject.department || '';
    const deptRefId = subject.departmentRef ? (subject.departmentRef._id || subject.departmentRef) : null;
    const matchedDept = departments.find(d =>
      (d._id && String(d._id) === String(deptVal)) ||
      (deptRefId && d._id && String(d._id) === String(deptRefId)) ||
      (d.name && d.name.toLowerCase() === String(deptVal).toLowerCase()) ||
      (d.code && d.code.toLowerCase() === String(deptVal).toLowerCase())
    );

    const initialDeptId = matchedDept ? matchedDept._id : (deptVal ? 'Other' : '');
    setDepartmentSelect(initialDeptId);

    setEditFormData({
      name: subject.name || '',
      code: subject.code || '',
      department: matchedDept ? matchedDept._id : deptVal,
      academicYear: subject.year || subject.academicYear || '',
      subjectType: subject.subjectType || 'Theory',
      credits: subject.credits !== undefined && subject.credits !== null ? String(subject.credits) : '',
      description: subject.description || '',
      semester: subject.semester || ''
    });

    setEditError('');
    setIsEditOpen(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSaving(true);

    try {
      const payload = {
        name: editFormData.name.trim(),
        code: editFormData.code.trim(),
        department: editFormData.department.trim(),
        academicYear: editFormData.academicYear.trim(),
        subjectType: editFormData.subjectType,
        credits: editFormData.credits ? Number(editFormData.credits) : undefined,
        description: editFormData.description.trim(),
        semester: editFormData.semester.trim() || undefined
      };

      const res = await adminApi.updateSubject(subject._id, payload);
      if (res.success) {
        setIsEditOpen(false);
        setActionSuccess('Subject details updated successfully!');
        setTimeout(() => setActionSuccess(''), 4000);
        await fetchSubjectData();
      }
    } catch (err) {
      console.error('Failed to save subject edits:', err);
      setEditError(err.response?.data?.error || 'Failed to update subject');
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!subject) return;
    const nextStatus = !subject.isActive;
    const actionLabel = nextStatus ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} subject "${subject.name}"?`)) return;

    try {
      const res = await adminApi.updateSubjectStatus(subject._id, nextStatus);
      if (res.success) {
        setActionSuccess(`Subject successfully ${nextStatus ? 'activated' : 'deactivated'}.`);
        setTimeout(() => setActionSuccess(''), 4000);
        await fetchSubjectData();
      }
    } catch (err) {
      console.error('Failed to update subject status:', err);
      alert(err.response?.data?.error || `Failed to ${actionLabel} subject.`);
    }
  };

  const displayVal = (val) => {
    if (val === undefined || val === null || String(val).trim() === '') return '—';
    return String(val);
  };

  // Back navigation preserving previously selected filters and search term
  const handleBack = () => {
    navigate('/admin/subjects', { state: location.state });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading subject details...</p>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="max-w-4xl mx-auto pb-12">
        <div className="mb-6">
          <button
            onClick={handleBack}
            className="inline-flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Subjects
          </button>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 text-center">
          <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Subject Not Found</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">{error || 'The requested subject record could not be found.'}</p>
          <button
            onClick={handleBack}
            className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            Return to Subjects
          </button>
        </div>
      </div>
    );
  }

  const assignedTeachers = subject.assignedTeachers || [];
  const sections = subject.sections || [];
  const isActive = subject.isActive;

  return (
    <div className="max-w-6xl mx-auto pb-12 transition-colors duration-200">
      {/* Top Navigation Bar */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          onClick={handleBack}
          className="inline-flex items-center text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Subjects
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleStatus}
            className={`inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              isActive
                ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                : 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/50'
            }`}
          >
            {isActive ? 'Deactivate Subject' : 'Activate Subject'}
          </button>
          <button
            onClick={handleOpenEdit}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit Subject
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Subject Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8 mb-6 transition-colors duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-inner">
            <BookOpen className="w-10 h-10" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white truncate">
                {subject.name}
              </h1>
              <span
                className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold ${
                  isActive
                    ? 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {isActive ? 'Active Subject' : 'Inactive Subject'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 text-sm text-slate-500 dark:text-slate-400 mt-2">
              <span className="flex items-center gap-1 font-mono font-semibold text-slate-700 dark:text-slate-300">
                <Hash className="w-4 h-4 text-slate-400 dark:text-slate-500" /> {subject.code}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500" /> {displayVal(subject.department)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" /> {displayVal(subject.year)}
              </span>
              {subject.subjectType && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <GraduationCap className="w-4 h-4 text-slate-400 dark:text-slate-500" /> {subject.subjectType}
                  </span>
                </>
              )}
              {subject.credits !== undefined && subject.credits !== null && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Award className="w-4 h-4 text-slate-400 dark:text-slate-500" /> {subject.credits} Credits
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Subject Information + Section Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Section A: Subject Information (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-colors duration-200">
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Subject Information</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Curriculum metadata and course classification</p>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
            <div className="py-2 border-b border-slate-50 dark:border-slate-800/60">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Subject Name</dt>
              <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100">{displayVal(subject.name)}</dd>
            </div>

            <div className="py-2 border-b border-slate-50 dark:border-slate-800/60">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Subject Code</dt>
              <dd className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">{displayVal(subject.code)}</dd>
            </div>

            <div className="py-2 border-b border-slate-50 dark:border-slate-800/60">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Department</dt>
              <dd className="text-sm font-medium text-slate-900 dark:text-slate-200">{displayVal(subject.department)}</dd>
            </div>

            <div className="py-2 border-b border-slate-50 dark:border-slate-800/60">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Year</dt>
              <dd className="text-sm font-medium text-slate-900 dark:text-slate-200">{displayVal(subject.year)}</dd>
            </div>

            <div className="py-2 border-b border-slate-50 dark:border-slate-800/60">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Subject Type</dt>
              <dd className="text-sm font-medium text-slate-900 dark:text-slate-200">{displayVal(subject.subjectType)}</dd>
            </div>

            <div className="py-2 border-b border-slate-50 dark:border-slate-800/60">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Credits</dt>
              <dd className="text-sm font-medium text-slate-900 dark:text-slate-200">
                {subject.credits !== undefined && subject.credits !== null ? `${subject.credits} Credits` : 'Not specified'}
              </dd>
            </div>

            <div className="py-2 border-b border-slate-50 dark:border-slate-800/60 sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Subject Status</dt>
              <dd className="text-sm">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    isActive
                      ? 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </dd>
            </div>

            {subject.description && (
              <div className="py-2 sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Description</dt>
                <dd className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800">
                  {subject.description}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Section C: Section Overview Summary (1 col) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between transition-colors duration-200">
          <div>
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Associated Sections</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Sections offering this course</p>
              </div>
            </div>

            {sections.length > 0 ? (
              <div className="space-y-3">
                {sections.map((sec) => (
                  <div
                    key={sec._id || sec.section}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {sec.section}
                      </span>
                      <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/50">
                        {sec.yearOfStudy || subject.year || 'Study Year'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {sec.department || sec.course || 'Department'}
                    </div>
                    {sec.teachers && sec.teachers.length > 0 && (
                      <div className="text-xs text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-slate-700/40 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">
                          Teacher: {sec.teachers.map(t => t.name).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 px-4 text-center">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-400">
                  <Layers className="w-5 h-5" />
                </div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  No sections are currently offering this subject.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
            <Link
              to="/admin/classes"
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors"
            >
              <span>Manage in Classes & Sections</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Section B: Assigned Teachers & Sections Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Assigned Teachers & Sections</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Faculty members assigned to teach this subject across sections</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full self-start sm:self-auto border border-slate-200 dark:border-slate-700">
            {assignedTeachers.length} {assignedTeachers.length === 1 ? 'Teacher Assigned' : 'Teachers Assigned'}
          </span>
        </div>

        {assignedTeachers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border-b-2 border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-3.5">Teacher Name</th>
                  <th className="px-6 py-3.5">Faculty ID</th>
                  <th className="px-6 py-3.5">Designation</th>
                  <th className="px-6 py-3.5">Department</th>
                  <th className="px-6 py-3.5">Assigned Sections</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {assignedTeachers.map((t) => (
                  <tr
                    key={t._id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <Link
                        to={`/admin/teachers/${t._id}`}
                        className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline flex items-center gap-2"
                        title={`View profile for ${t.name}`}
                      >
                        <span>{t.name}</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-700 dark:text-slate-300">
                      {displayVal(t.facultyId)}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {displayVal(t.designation)}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      {displayVal(t.department)}
                    </td>
                    <td className="px-6 py-4">
                      {t.assignedSections && t.assignedSections.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {t.assignedSections.map((sec) => (
                            <span
                              key={sec}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60"
                            >
                              {sec}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No section specified</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 px-4 text-center">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-slate-500">
              <UserX className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
              No teachers or sections assigned to this subject yet.
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
              Teaching assignments connect faculty members to specific academic classes and sections offering this subject.
            </p>
            <Link
              to="/admin/classes"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <span>Assign Teachers to Classes</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Edit Subject Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit Subject</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Subject Code: {subject.code}</p>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Subject Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={editFormData.name}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Subject Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={editFormData.code}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={departmentSelect}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDepartmentSelect(val);
                      if (val !== 'Other') {
                        setEditFormData((prev) => ({ ...prev, department: val }));
                      } else {
                        setEditFormData((prev) => ({ ...prev, department: '' }));
                      }
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d._id || d.name} value={d._id || d.name}>
                        {d.name || d.code}
                      </option>
                    ))}
                    <option value="Other">Other (Custom)</option>
                  </select>
                  {departmentSelect === 'Other' && (
                    <input
                      type="text"
                      placeholder="Enter department name"
                      value={editFormData.department}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, department: e.target.value }))}
                      required
                      className="mt-2 w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Year (Academic Level) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="academicYear"
                    value={editFormData.academicYear}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Year</option>
                    {academicYearsList.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Subject Type
                  </label>
                  <select
                    name="subjectType"
                    value={editFormData.subjectType}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {subjectTypesList.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Credits
                  </label>
                  <input
                    type="number"
                    name="credits"
                    min="0"
                    max="10"
                    value={editFormData.credits}
                    onChange={handleEditChange}
                    placeholder="e.g. 3"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  rows="3"
                  value={editFormData.description}
                  onChange={handleEditChange}
                  placeholder="Optional course syllabus summary or notes"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  disabled={editSaving}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {editSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

