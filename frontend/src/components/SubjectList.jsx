import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { usePageRefresh } from '../context/RefreshContext';
import { Loader2, Search, Plus, X, Trash2, CheckCircle2 } from 'lucide-react';
import DeleteConfirmationModal from './DeleteConfirmationModal';

// Academic year options and normalization helpers
const YEAR_GROUPS = [
  { key: 'First Year', title: 'First Year Subjects', display: 'First', order: 1 },
  { key: 'Second Year', title: 'Second Year Subjects', display: 'Second', order: 2 },
  { key: 'Third Year', title: 'Third Year Subjects', display: 'Third', order: 3 },
  { key: 'Fourth Year', title: 'Fourth Year Subjects', display: 'Fourth', order: 4 }
];

export const resolveSubjectYear = (s) => {
  if (!s) return '';
  if (s.academicYear) {
    const val = String(s.academicYear).trim().toLowerCase();
    if (val === 'first year' || val === 'first' || val === '1st year' || val === '1st' || val === '1') return 'First Year';
    if (val === 'second year' || val === 'second' || val === '2nd year' || val === '2nd' || val === '2') return 'Second Year';
    if (val === 'third year' || val === 'third' || val === '3rd year' || val === '3rd' || val === '3') return 'Third Year';
    if (val === 'fourth year' || val === 'fourth' || val === '4th year' || val === '4th' || val === '4') return 'Fourth Year';
  }
  if (s.semester !== undefined && s.semester !== null) {
    const sem = String(s.semester).trim().toLowerCase();
    const match = sem.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num === 1 || num === 2) return 'First Year';
      if (num === 3 || num === 4) return 'Second Year';
      if (num === 5 || num === 6) return 'Third Year';
      if (num === 7 || num === 8) return 'Fourth Year';
    }
  }
  return '';
};

export const getDisplayYear = (yearStr) => {
  if (yearStr === 'First Year') return 'First';
  if (yearStr === 'Second Year') return 'Second';
  if (yearStr === 'Third Year') return 'Third';
  if (yearStr === 'Fourth Year') return 'Fourth';
  return yearStr || '—';
};

const getYearOrder = (s) => {
  const y = resolveSubjectYear(s);
  if (y === 'First Year') return 1;
  if (y === 'Second Year') return 2;
  if (y === 'Third Year') return 3;
  if (y === 'Fourth Year') return 4;
  return 5; // Unassigned at end
};

export default function SubjectList() {
  const [subjects, setSubjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [deptError, setDeptError] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Toolbar filter states: All Years, All Departments, Search, and Summary Cards Status Filter
  const [filterYear, setFilterYear] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'

  const [departmentSelect, setDepartmentSelect] = useState('');
  const [subjectTypeSelect, setSubjectTypeSelect] = useState('Theory');

  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // Delete modal & processing state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [processingDeleteId, setProcessingDeleteId] = useState(null);

  const [formData, setFormData] = useState({
    _id: '',
    name: '',
    code: '',
    department: '',
    description: '',
    subjectType: 'Theory',
    credits: '',
    semester: '',
    academicYear: '',
    isActive: true
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchDepartments = async () => {
    setLoadingDepts(true);
    setDeptError('');
    try {
      const deptRes = await adminApi.getDepartments();
      if (deptRes && deptRes.success) {
        setDepartments(deptRes.departments || []);
      }
    } catch (err) {
      console.error('Failed to load departments in SubjectList:', err);
      setDeptError('Failed to load departments');
    } finally {
      setLoadingDepts(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      fetchDepartments();
      const subjRes = await adminApi.getSubjects();
      if (subjRes && subjRes.success) {
        setSubjects(subjRes.subjects || []);
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  usePageRefresh(fetchInitialData);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Sync selected department in modal if departments finish loading after modal opens
  useEffect(() => {
    if (showModal && isEditing && editingSubject && departments.length > 0) {
      const deptVal = editingSubject.department || '';
      const deptRefId = editingSubject.departmentRef ? (editingSubject.departmentRef._id || editingSubject.departmentRef) : null;
      const matched = departments.find(d =>
        (d._id && String(d._id) === String(deptVal)) ||
        (deptRefId && d._id && String(d._id) === String(deptRefId)) ||
        (d.name && d.name.toLowerCase() === String(deptVal).toLowerCase()) ||
        (d.code && d.code.toLowerCase() === String(deptVal).toLowerCase())
      );
      if (matched && departmentSelect !== matched._id) {
        setDepartmentSelect(matched._id);
        setFormData(prev => ({ ...prev, department: matched._id }));
      }
    }
  }, [departments, showModal, isEditing, editingSubject]);

  const resolveDeptName = (s) => {
    if (s.departmentRef && s.departmentRef.name) return s.departmentRef.name;
    if (!s.department) return '—';
    const matched = departments.find(d =>
      (d._id && String(d._id) === String(s.department)) ||
      (d.code && d.code.toLowerCase() === String(s.department).toLowerCase()) ||
      (d.name && d.name.toLowerCase() === String(s.department).toLowerCase())
    );
    return matched ? matched.name : s.department;
  };

  const handleOpenCreate = () => {
    setFormData({
      _id: '',
      name: '',
      code: '',
      department: '',
      description: '',
      subjectType: 'Theory',
      credits: '',
      semester: '',
      academicYear: filterYear || '',
      isActive: true
    });
    setDepartmentSelect('');
    setSubjectTypeSelect('Theory');
    setFormError('');
    setIsEditing(false);
    setEditingSubject(null);
    setShowModal(true);
  };

  const handleOpenEdit = (subject) => {
    setEditingSubject(subject);
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

    const knownTypes = ['Theory', 'Practical', 'Both'];
    const typeVal = subject.subjectType || 'Theory';
    setSubjectTypeSelect(knownTypes.includes(typeVal) ? typeVal : 'Other');

    const resolvedYear = resolveSubjectYear(subject);

    setFormData({
      _id: subject._id,
      name: subject.name,
      code: subject.code,
      department: matchedDept ? matchedDept._id : deptVal,
      description: subject.description || '',
      subjectType: typeVal,
      credits: subject.credits || '',
      semester: subject.semester || '',
      academicYear: resolvedYear || subject.academicYear || '',
      isActive: subject.isActive
    });
    setFormError('');
    setIsEditing(true);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');

    // Academic Year is mandatory alongside Name, Code, and Department
    if (!formData.name.trim() || !formData.code.trim() || !formData.department || !formData.academicYear) {
      return setFormError('Name, Code, Department, and Academic Year are required.');
    }

    setSaving(true);
    try {
      if (isEditing) {
        await adminApi.updateSubject(formData._id, formData);
        setActionSuccess(`Subject "${formData.name.trim()} (${formData.code.trim().toUpperCase()})" was updated successfully.`);
      } else {
        await adminApi.createSubject(formData);
        setActionSuccess(`Subject "${formData.name.trim()} (${formData.code.trim().toUpperCase()})" was created successfully.`);
      }
      setShowModal(false);
      fetchInitialData();
      setTimeout(() => setActionSuccess(''), 5000);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save subject');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (subject) => {
    if (!window.confirm(`Are you sure you want to ${subject.isActive ? 'deactivate' : 'activate'} this subject?`)) return;
    try {
      await adminApi.updateSubjectStatus(subject._id, !subject.isActive);
      fetchInitialData();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  /**
   * Handle Delete Click with Assignment-Aware Logic:
   * 1. If subject has NO assignments: delete immediately with no confirmation modal.
   * 2. If subject HAS assignments: show confirmation modal alerting that all assignments will be removed.
   */
  const handleDeleteClick = async (subject) => {
    setDeleteError('');
    setProcessingDeleteId(subject._id);

    try {
      const checkRes = await adminApi.checkSubjectAssignments(subject._id);

      if (checkRes && checkRes.hasAssignments) {
        // Assigned subject -> prompt confirmation modal
        setSubjectToDelete(subject);
        setDeleteModalOpen(true);
      } else {
        // Unassigned subject -> delete immediately!
        const delRes = await adminApi.deleteSubject(subject._id);
        if (delRes && delRes.success) {
          setActionSuccess(`Subject "${subject.name} (${subject.code})" was permanently deleted.`);
          fetchInitialData();
          setTimeout(() => setActionSuccess(''), 5000);
        } else {
          setError(delRes?.error || 'Failed to delete subject');
        }
      }
    } catch (err) {
      if (err.response?.data?.hasAssignments) {
        setSubjectToDelete(subject);
        setDeleteModalOpen(true);
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to process deletion');
      }
    } finally {
      setProcessingDeleteId(null);
    }
  };

  const handleCancelDelete = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setSubjectToDelete(null);
    setDeleteError('');
  };

  const handleConfirmPermanentDelete = async () => {
    if (!subjectToDelete) return;
    setDeleting(true);
    setDeleteError('');

    try {
      const res = await adminApi.deleteSubject(subjectToDelete._id, { cascadeAssignments: true });
      if (res && res.success) {
        setActionSuccess(`Subject "${subjectToDelete.name} (${subjectToDelete.code})" and all associated assignments were permanently deleted.`);
        setDeleteModalOpen(false);
        setSubjectToDelete(null);
        fetchInitialData();
        setTimeout(() => setActionSuccess(''), 5000);
      } else {
        setDeleteError(res?.error || 'Failed to delete subject');
      }
    } catch (err) {
      setDeleteError(err.response?.data?.error || err.message || 'Failed to delete subject');
    } finally {
      setDeleting(false);
    }
  };

  // Filter subjects by Academic Year, Department, Status (from summary cards), and Search Term concurrently
  const filtered = subjects.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDepartment ?
      (s.department === filterDepartment ||
        (s.departmentRef && String(s.departmentRef._id || s.departmentRef) === String(filterDepartment)) ||
        (resolveDeptName(s).toLowerCase() === String(filterDepartment).toLowerCase()))
      : true;
    const sYear = resolveSubjectYear(s);
    const matchesYear = filterYear ? sYear === filterYear : true;

    // Status filter from summary card selection ('ALL' | 'ACTIVE' | 'INACTIVE')
    const matchesStatus =
      statusFilter === 'ACTIVE' ? Boolean(s.isActive) :
        statusFilter === 'INACTIVE' ? !s.isActive :
          true;

    return matchesSearch && matchesDept && matchesYear && matchesStatus;
  });

  // Sort subjects strictly in academic year order:
  // 1. First Year -> 2. Second Year -> 3. Third Year -> 4. Fourth Year -> 5. Unassigned
  const sortedFiltered = [...filtered].sort((a, b) => {
    const orderA = getYearOrder(a);
    const orderB = getYearOrder(b);
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  const totalSubjects = subjects.length;
  const activeSubjects = subjects.filter(s => s.isActive).length;

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (error) return <div className="text-rose-600 bg-rose-50 p-4 rounded-lg">{error}</div>;

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Top Metric Cards - Clickable Summary Filter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Subjects Card */}
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-xl border text-left transition-all duration-150 cursor-pointer flex items-center justify-between ${statusFilter === 'ALL'
              ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/20 dark:ring-indigo-500/30 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-800/80 hover:shadow-md'
            }`}
          aria-pressed={statusFilter === 'ALL'}
          aria-label="Show all subjects"
        >
          <div>
            <p className={`text-sm font-medium ${statusFilter === 'ALL' ? 'text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
              Total Subjects
            </p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalSubjects}</p>
          </div>
        </button>

        {/* Active Subjects Card */}
        <button
          type="button"
          onClick={() => setStatusFilter('ACTIVE')}
          className={`p-4 rounded-xl border text-left transition-all duration-150 cursor-pointer flex items-center justify-between ${statusFilter === 'ACTIVE'
              ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/20 dark:ring-emerald-500/30 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-300 dark:hover:border-emerald-800/80 hover:shadow-md'
            }`}
          aria-pressed={statusFilter === 'ACTIVE'}
          aria-label="Filter active subjects"
        >
          <div>
            <p className={`text-sm font-medium ${statusFilter === 'ACTIVE' ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
              Active Subjects
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activeSubjects}</p>
          </div>
        </button>

        {/* Inactive Subjects Card */}
        <button
          type="button"
          onClick={() => setStatusFilter('INACTIVE')}
          className={`p-4 rounded-xl border text-left transition-all duration-150 cursor-pointer flex items-center justify-between ${statusFilter === 'INACTIVE'
              ? 'bg-slate-100 dark:bg-slate-800 border-slate-500 dark:border-slate-400 ring-2 ring-slate-500/20 dark:ring-slate-400/30 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-400 dark:hover:border-slate-700 hover:shadow-md'
            }`}
          aria-pressed={statusFilter === 'INACTIVE'}
          aria-label="Filter inactive subjects"
        >
          <div>
            <p className={`text-sm font-medium ${statusFilter === 'INACTIVE' ? 'text-slate-800 dark:text-slate-200 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
              Inactive Subjects
            </p>
            <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{totalSubjects - activeSubjects}</p>
          </div>
        </button>
      </div>

      {/* Main Subjects Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col flex-1 overflow-hidden transition-colors duration-200">
        {actionSuccess && (
          <div className="m-4 mb-0 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Toolbar in EXACT required order: 1. All Years, 2. All Departments, 3. Search, 4. Add Subject */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row gap-3 w-full items-stretch sm:items-center">
            {/* 1. All Years Dropdown */}
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full sm:flex-1 sm:min-w-0 h-10 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer"
              aria-label="Filter by Academic Year"
            >
              <option value="">All Years</option>
              <option value="First Year">First Year</option>
              <option value="Second Year">Second Year</option>
              <option value="Third Year">Third Year</option>
              <option value="Fourth Year">Fourth Year</option>
            </select>

            {/* 2. All Departments Dropdown */}
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full sm:flex-1 sm:min-w-0 h-10 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer truncate"
              aria-label="Filter by Department"
            >
              <option value="">All Departments</option>
              {departments
                .filter(d => d && (d.name || d._id))
                .map(d => (
                  <option key={d._id || d.name} value={d.name || d._id}>
                    {d.name || d.code}
                  </option>
                ))}
            </select>

            {/* 3. Search Input */}
            <div className="relative w-full sm:flex-1 sm:min-w-0">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            {/* 4. Add Subject Button */}
            <button
              onClick={handleOpenCreate}
              className="h-10 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Subject
            </button>
          </div>
        </div>

        {/* Subjects Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-200 sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold bg-slate-50 dark:bg-slate-800">Code</th>
                <th className="px-4 py-3 font-semibold bg-slate-50 dark:bg-slate-800">Name</th>
                <th className="px-4 py-3 font-semibold bg-slate-50 dark:bg-slate-800">Department</th>
                <th className="px-4 py-3 font-semibold bg-slate-50 dark:bg-slate-800">Year</th>
                <th className="px-4 py-3 font-semibold bg-slate-50 dark:bg-slate-800">Status</th>
                <th className="px-4 py-3 font-semibold text-right bg-slate-50 dark:bg-slate-800">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {sortedFiltered.map((s) => (
                <tr key={s._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-slate-100">{s.code}</td>
                  <td className="px-4 py-3 font-medium text-indigo-900 dark:text-indigo-300">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{resolveDeptName(s)}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                    {getDisplayYear(resolveSubjectYear(s))}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${s.isActive ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right flex justify-end items-center gap-3">
                    <button onClick={() => handleOpenEdit(s)} className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-medium cursor-pointer">
                      Edit
                    </button>
                    <button onClick={() => toggleStatus(s)} className={`text-sm font-medium cursor-pointer ${s.isActive ? 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200' : 'text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300'}`}>
                      {s.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDeleteClick(s)}
                      disabled={processingDeleteId === s._id}
                      className="text-sm text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="Permanently Delete Subject"
                    >
                      {processingDeleteId === s._id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      <span>Delete</span>
                    </button>
                  </td>
                </tr>
              ))}

              {sortedFiltered.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No subjects found matching the selected filters.{' '}
                    {(statusFilter !== 'ALL' || filterYear || filterDepartment || searchTerm) && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter('ALL');
                            setFilterYear('');
                            setFilterDepartment('');
                            setSearchTerm('');
                          }}
                          className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer mr-1"
                        >
                          Reset filters
                        </button>
                        or{' '}
                      </>
                    )}
                    <button onClick={handleOpenCreate} className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer">
                      Add a subject
                    </button>
                    .
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Subject Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{isEditing ? 'Edit Subject' : 'Add Subject'}</h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSave} className="p-6">
              {formError && (
                <div className="mb-6 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 rounded-lg text-sm border border-rose-200 dark:border-rose-900/50">
                  {formError}
                </div>
              )}

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject Name *</label>
                    <input
                      type="text" required
                      value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                      placeholder="e.g. Data Structures"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject Code *</label>
                    <input
                      type="text" required
                      value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow uppercase"
                      placeholder="e.g. CS201"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Department <span className="text-rose-500">*</span>
                      </label>
                      {loadingDepts && (
                        <span className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Loading...</span>
                        </span>
                      )}
                      {deptError && (
                        <button
                          type="button"
                          onClick={fetchDepartments}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                    <select
                      required={departmentSelect !== 'Other'}
                      value={departmentSelect}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDepartmentSelect(val);
                        if (val !== 'Other') setFormData({ ...formData, department: val });
                        else setFormData({ ...formData, department: '' });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Select Department</option>
                      {loadingDepts ? (
                        <option value="" disabled>Loading departments...</option>
                      ) : deptError ? (
                        <option value="" disabled>Error loading departments</option>
                      ) : departments.length === 0 ? (
                        <option value="" disabled>No departments available. Create a department first.</option>
                      ) : (
                        departments
                          .filter(d => d && (d.name || d._id))
                          .map(d => (
                            <option key={d._id || d.name} value={d._id || d.name}>
                              {d.name || d.code || 'Unnamed Department'}
                            </option>
                          ))
                      )}
                      <option value="Other">Other</option>
                    </select>
                    {departmentSelect === 'Other' && (
                      <div className="mt-2">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Please specify *</label>
                        <input
                          type="text" required
                          value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="Enter custom department"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Academic Year <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.academicYear}
                      onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Select Academic Year</option>
                      <option value="First Year">First Year</option>
                      <option value="Second Year">Second Year</option>
                      <option value="Third Year">Third Year</option>
                      <option value="Fourth Year">Fourth Year</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject Type</label>
                    <select
                      value={subjectTypeSelect}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSubjectTypeSelect(val);
                        if (val !== 'Other') setFormData({ ...formData, subjectType: val });
                        else setFormData({ ...formData, subjectType: '' });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="Theory">Theory</option>
                      <option value="Practical">Practical</option>
                      <option value="Both">Both</option>
                      <option value="Other">Other</option>
                    </select>
                    {subjectTypeSelect === 'Other' && (
                      <div className="mt-2">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Please specify *</label>
                        <input
                          type="text" required
                          value={formData.subjectType} onChange={(e) => setFormData({ ...formData, subjectType: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="Enter custom subject type"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Semester</label>
                    <input
                      type="text"
                      value={formData.semester} onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="e.g. 3rd"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Credits</label>
                    <input
                      type="number" min="0" step="0.5"
                      value={formData.credits} onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="e.g. 3"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    placeholder="Brief description of the subject..."
                  />
                </div>
              </div>

              <div className="mt-8 pt-5 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-900">
                <button type="button" onClick={handleCloseModal} className="px-5 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 min-w-[100px] cursor-pointer">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignment-Aware Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmPermanentDelete}
        title="Delete Subject?"
        recordName={subjectToDelete ? `${subjectToDelete.name} (${subjectToDelete.code})` : ''}
        message="This subject is currently assigned to teachers or sections. If you continue, all assignments associated with this subject will be removed. This action cannot be undone."
        confirmText="Permanently Delete"
        loading={deleting}
        error={deleteError}
      />
    </div>
  );
}
