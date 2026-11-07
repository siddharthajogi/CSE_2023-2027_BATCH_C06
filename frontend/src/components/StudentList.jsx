import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { adminApi } from '../api';
import { usePageRefresh } from '../context/RefreshContext';
import { Loader2, Search, Plus, MoreVertical, ShieldAlert, X, Trash2, CheckCircle2 } from 'lucide-react';
import DeleteConfirmationModal from './DeleteConfirmationModal';

// Academic year and section normalization helpers
export const isStudentEnrolled = (student, configuredClasses = []) => {
  if (!student || !student.classRef) return false;
  const classId = typeof student.classRef === 'object' ? student.classRef._id : student.classRef;
  if (!classId) return false;
  if (!configuredClasses || configuredClasses.length === 0) return true;
  return configuredClasses.some(c => String(c._id) === String(classId));
};

export const resolveSectionName = (student, configuredClasses = []) => {
  if (!student) return '—';
  // If student has no valid classRef or is not in configured classes, they are unassigned
  if (!student.classRef) return '—';
  if (configuredClasses && configuredClasses.length > 0) {
    const classId = typeof student.classRef === 'object' ? student.classRef._id : student.classRef;
    const isEnrolled = configuredClasses.some(c => String(c._id) === String(classId));
    if (!isEnrolled) return '—';
  }
  const sec = (student.classRef && student.classRef.section) || student.section;
  if (!sec) return '—';
  // Strip redundant "Section " or "Sec " prefixes if present (e.g. "Section C" -> "C", "Sec C" -> "C")
  const cleaned = String(sec).replace(/^(section|sec)\s+/i, '').trim();
  return cleaned || '—';
};

export const resolveStudentYear = (student) => {
  if (!student) return '—';

  // 1. Check direct yearOfStudy on student profile or classRef
  const rawYear = student.yearOfStudy || student.classRef?.yearOfStudy;
  if (rawYear && typeof rawYear === 'string') {
    const y = rawYear.trim().toLowerCase();
    if (y.includes('first') || y === '1' || y.startsWith('1st')) return 'First';
    if (y.includes('second') || y === '2' || y.startsWith('2nd')) return 'Second';
    if (y.includes('third') || y === '3' || y.startsWith('3rd')) return 'Third';
    if (y.includes('fourth') || y === '4' || y.startsWith('4th')) return 'Fourth';
  }

  // 2. Derive accurately from semester on student profile or classRef
  const sem = student.semester || student.classRef?.semester;
  if (sem !== undefined && sem !== null) {
    const match = String(sem).match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num === 1 || num === 2) return 'First';
      if (num === 3 || num === 4) return 'Second';
      if (num === 5 || num === 6) return 'Third';
      if (num === 7 || num === 8) return 'Fourth';
    }
  }

  return '—';
};

export default function StudentList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [configuredClasses, setConfiguredClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Toolbar filters: All Years, All Departments, All Sections, Search, and Summary Cards Status Filter
  const [filterYear, setFilterYear] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'active') return 'ACTIVE';
    if (filterParam === 'inactive') return 'INACTIVE';
    return 'ALL';
  });
  const [actionSuccess, setActionSuccess] = useState('');

  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'active') setStatusFilter('ACTIVE');
    else if (filterParam === 'inactive') setStatusFilter('INACTIVE');
  }, [searchParams]);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [departmentSelect, setDepartmentSelect] = useState('');
  const [courseSelect, setCourseSelect] = useState('');
  const [semesterSelect, setSemesterSelect] = useState('');

  const [loadingDepts, setLoadingDepts] = useState(false);
  const [deptError, setDeptError] = useState('');

  const coursesList = ['B.Tech', 'M.Tech', 'Ph.D.', 'B.Sc.', 'M.Sc.', 'BCA', 'MCA'];
  const semestersList = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

  const [formData, setFormData] = useState({
    _id: '',
    studentId: '',
    course: '',
    department: '',
    academicYear: '',
    semester: '',
    section: '',
    personalInfo: { name: '', email: '' }
  });

  const fetchDepartments = async () => {
    try {
      setLoadingDepts(true);
      setDeptError('');
      const deptRes = await adminApi.getDepartments();
      if (deptRes && deptRes.success) {
        setDepartments(deptRes.departments || []);
      } else {
        setDeptError(deptRes?.error || 'Failed to load departments');
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
      setDeptError(err.response?.data?.error || err.message || 'Failed to load departments');
    } finally {
      setLoadingDepts(false);
    }
  };

  const fetchData = async () => {
    try {
      const [studentsRes, deptRes, classesRes] = await Promise.all([
        adminApi.getStudents(),
        adminApi.getDepartments(),
        adminApi.getClasses()
      ]);
      if (studentsRes.success) setStudents(studentsRes.students || []);
      if (deptRes && deptRes.success) {
        setDepartments(deptRes.departments || []);
      } else if (deptRes && !deptRes.success) {
        setDeptError(deptRes.error || 'Failed to load departments');
      }
      if (classesRes && classesRes.success) {
        setConfiguredClasses(classesRes.classes || []);
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  usePageRefresh(fetchData);

  useEffect(() => {
    fetchData();
  }, []);

  const openDeleteModal = (student) => {
    setStudentToDelete(student);
    setDeleteError('');
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setStudentToDelete(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!studentToDelete) return;
    try {
      setDeleting(true);
      setDeleteError('');
      const res = await adminApi.deleteStudent(studentToDelete._id);
      if (res.success) {
        setActionSuccess(res.message || 'Student was permanently deleted.');
        setDeleteModalOpen(false);
        setStudentToDelete(null);
        await fetchData();
        setTimeout(() => setActionSuccess(''), 4000);
      } else {
        setDeleteError(res.error || 'Failed to delete student.');
      }
    } catch (err) {
      setDeleteError(err.response?.data?.error || err.message || 'Failed to delete student.');
    } finally {
      setDeleting(false);
    }
  };

  const toggleStatus = async (student) => {
    if (!window.confirm(`Are you sure you want to ${student.user.isActive ? 'deactivate' : 'activate'} this student?`)) return;
    try {
      await adminApi.updateUserStatus(student.user._id, !student.user.isActive);
      fetchData();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const resetPassword = async (student) => {
    const newPassword = prompt(`Enter new temporary password for ${student.studentId} (Min 8 chars, 1 letter, 1 number/symbol):`);
    if (!newPassword) return;
    try {
      await adminApi.resetUserPassword(student.user._id, newPassword);
      alert('Password reset successfully. User must change it on next login.');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reset password');
    }
  };

  // Sync department selection if departments load while Edit modal is already open
  useEffect(() => {
    if (showModal && departments.length > 0 && formData.department) {
      const currentVal = formData.department;
      if (currentVal && currentVal !== 'Other') {
        const matched = departments.find(d =>
          (d._id && String(d._id) === String(currentVal)) ||
          (d.name && d.name.toLowerCase().trim() === String(currentVal).toLowerCase().trim()) ||
          (d.code && d.code.toLowerCase().trim() === String(currentVal).toLowerCase().trim())
        );
        if (matched && departmentSelect !== matched._id) {
          setDepartmentSelect(matched._id);
          setFormData(prev => ({ ...prev, department: matched._id }));
        }
      }
    }
  }, [departments, showModal]);

  const handleEditClick = (student) => {
    if (departments.length === 0 && !loadingDepts) {
      fetchDepartments();
    }

    const studentDeptRaw = student.department || (student.classRef && student.classRef.department) || (student.departmentRef && student.departmentRef.name) || '';

    // Match saved department by _id, name, or code
    const matchedDept = departments.find(d =>
      (d._id && String(d._id) === String(studentDeptRaw)) ||
      (d.name && d.name.toLowerCase().trim() === String(studentDeptRaw).toLowerCase().trim()) ||
      (d.code && d.code.toLowerCase().trim() === String(studentDeptRaw).toLowerCase().trim()) ||
      (student.departmentRef?._id && d._id && String(d._id) === String(student.departmentRef._id))
    );

    const initialDeptId = matchedDept ? matchedDept._id : (studentDeptRaw ? 'Other' : '');
    setDepartmentSelect(initialDeptId);

    const isCourseKnown = coursesList.includes(student.course);
    setCourseSelect(isCourseKnown ? student.course : (student.course ? 'Other' : ''));

    const isSemesterKnown = semestersList.includes(student.semester);
    setSemesterSelect(isSemesterKnown ? student.semester : (student.semester ? 'Other' : ''));

    setFormData({
      _id: student._id,
      studentId: student.studentId,
      course: student.course || '',
      department: matchedDept ? matchedDept._id : (studentDeptRaw || ''),
      academicYear: student.academicYear || '',
      semester: student.semester || '',
      section: student.section || '',
      personalInfo: {
        name: student.user?.name || '',
        email: student.personalInfo?.email || ''
      }
    });
    setFormError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData((prev) => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await adminApi.updateStudent(formData._id, formData);
      setShowModal(false);
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  const resolveStudentDept = (s) => {
    const raw = s.department || s.departmentRef?.name || (s.classRef && s.classRef.department) || '—';
    const found = departments.find(d => String(d._id) === String(raw) || d.code === raw || d.name === raw);
    return found ? found.name : raw;
  };

  // Available sections dynamically derived from configured classes
  const availableSections = React.useMemo(() => {
    const secSet = new Set();

    configuredClasses.forEach(c => {
      if (!c.section) return;
      const cleanSec = String(c.section).replace(/^(section|sec)\s+/i, '').trim();
      if (!cleanSec) return;

      if (!filterDepartment) {
        secSet.add(cleanSec);
      } else {
        const matchesDept =
          c.department === filterDepartment ||
          (c.departmentRef && String(c.departmentRef) === String(filterDepartment)) ||
          departments.some(d => (String(d._id) === String(filterDepartment) || d.name === filterDepartment || d.code === filterDepartment) &&
            (c.department === d.name || (d.code && c.department === d.code)));
        if (matchesDept) secSet.add(cleanSec);
      }
    });

    return Array.from(secSet).sort();
  }, [configuredClasses, filterDepartment, departments]);

  // Reset section filter if currently selected section is no longer available in newly selected department
  useEffect(() => {
    if (filterSection && filterSection !== 'UNASSIGNED' && !availableSections.includes(filterSection)) {
      setFilterSection('');
    }
  }, [availableSections, filterSection]);

  const getStudentYearOrder = (s) => {
    const yr = resolveStudentYear(s);
    if (yr === 'First') return 1;
    if (yr === 'Second') return 2;
    if (yr === 'Third') return 3;
    if (yr === 'Fourth') return 4;
    return 5;
  };

  const filtered = students.filter(s => {
    // 1. Search term (studentId, user.name, personalInfo.name)
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ? true : (
      (s.studentId || '').toLowerCase().includes(term) ||
      (s.user?.name || s.personalInfo?.name || '').toLowerCase().includes(term)
    );

    // 2. Year filter
    const sYear = resolveStudentYear(s);
    const matchesYear = !filterYear ? true : (
      filterYear === 'First Year' ? sYear === 'First' :
        filterYear === 'Second Year' ? sYear === 'Second' :
          filterYear === 'Third Year' ? sYear === 'Third' :
            filterYear === 'Fourth Year' ? sYear === 'Fourth' :
              sYear === filterYear
    );

    // 3. Department filter
    const matchesDept = !filterDepartment ? true : (() => {
      const sDept = resolveStudentDept(s).toLowerCase();
      const targetObj = departments.find(d => String(d._id) === String(filterDepartment) || d.name === filterDepartment || d.code === filterDepartment);
      const targetName = targetObj ? targetObj.name.toLowerCase() : filterDepartment.toLowerCase();
      const targetCode = targetObj && targetObj.code ? targetObj.code.toLowerCase() : '';
      const sDeptRaw = String(s.department || '').toLowerCase();
      const sDeptRefId = s.departmentRef?._id ? String(s.departmentRef._id) : (s.departmentRef ? String(s.departmentRef) : '');
      const targetId = targetObj ? String(targetObj._id) : '';

      return sDept === targetName ||
        sDeptRaw === targetName ||
        (targetCode && sDeptRaw === targetCode) ||
        (targetId && sDeptRefId === targetId);
    })();

    // 4. Section filter
    const matchesSection = !filterSection ? true : (
      filterSection === 'UNASSIGNED'
        ? !isStudentEnrolled(s, configuredClasses)
        : resolveSectionName(s, configuredClasses) === filterSection
    );

    // 5. Status filter (from summary cards)
    const matchesStatus =
      statusFilter === 'ACTIVE' ? Boolean(s.user?.isActive) :
        statusFilter === 'INACTIVE' ? !s.user?.isActive :
          true;

    return matchesSearch && matchesYear && matchesDept && matchesSection && matchesStatus;
  });

  // Strict academic year ordering: First Year -> Second Year -> Third Year -> Fourth Year
  // Secondary ordering within year by student name or student ID
  const sortedFiltered = [...filtered].sort((a, b) => {
    const orderA = getStudentYearOrder(a);
    const orderB = getStudentYearOrder(b);
    if (orderA !== orderB) return orderA - orderB;

    const nameA = (a.user?.name || a.personalInfo?.name || '').toLowerCase();
    const nameB = (b.user?.name || b.personalInfo?.name || '').toLowerCase();
    if (nameA && nameB && nameA !== nameB) {
      return nameA.localeCompare(nameB);
    }
    return (a.studentId || '').localeCompare(b.studentId || '');
  });

  const totalStudents = students.length;
  const enrolledStudents = students.filter(s => isStudentEnrolled(s, configuredClasses)).length;
  const unassignedStudents = totalStudents - enrolledStudents;
  const activeStudents = students.filter(s => s.user?.isActive).length;
  const inactiveStudents = totalStudents - activeStudents;

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (error) return <div className="text-rose-600 bg-rose-50 p-4 rounded-lg">{error}</div>;

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Top Metric Cards - Clickable Summary Filter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Students */}
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-xl border text-left transition-all duration-150 cursor-pointer flex items-center justify-between ${statusFilter === 'ALL'
            ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/20 dark:ring-indigo-500/30 shadow-sm'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-800/80 hover:shadow-md'
            }`}
          aria-pressed={statusFilter === 'ALL'}
          aria-label="Show all student accounts"
        >
          <div>
            <p className={`text-sm font-medium ${statusFilter === 'ALL' ? 'text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
              Total Students
            </p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalStudents}</p>
          </div>
        </button>

        {/* Card 2: Active Students */}
        <button
          type="button"
          onClick={() => setStatusFilter('ACTIVE')}
          className={`p-4 rounded-xl border text-left transition-all duration-150 cursor-pointer flex items-center justify-between ${statusFilter === 'ACTIVE'
            ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/20 dark:ring-emerald-500/30 shadow-sm'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-300 dark:hover:border-emerald-800/80 hover:shadow-md'
            }`}
          aria-pressed={statusFilter === 'ACTIVE'}
          aria-label="Filter active students"
        >
          <div>
            <p className={`text-sm font-medium ${statusFilter === 'ACTIVE' ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
              Active Students
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activeStudents}</p>
          </div>
        </button>

        {/* Card 3: Inactive Students */}
        <button
          type="button"
          onClick={() => setStatusFilter('INACTIVE')}
          className={`p-4 rounded-xl border text-left transition-all duration-150 cursor-pointer flex items-center justify-between ${statusFilter === 'INACTIVE'
            ? 'bg-slate-100 dark:bg-slate-800 border-slate-500 dark:border-slate-400 ring-2 ring-slate-500/20 dark:ring-slate-400/30 shadow-sm'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-400 dark:hover:border-slate-700 hover:shadow-md'
            }`}
          aria-pressed={statusFilter === 'INACTIVE'}
          aria-label="Filter inactive students"
        >
          <div>
            <p className={`text-sm font-medium ${statusFilter === 'INACTIVE' ? 'text-slate-800 dark:text-slate-200 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
              Inactive Students
            </p>
            <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{inactiveStudents}</p>
          </div>
        </button>
      </div>

      {/* Main Students Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col flex-1 overflow-hidden transition-colors duration-200">
        {actionSuccess && (
          <div className="m-4 mb-0 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Toolbar in EXACT required order: 1. All Years, 2. All Departments, 3. All Sections, 4. Search Students, 5. Add Student */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row flex-wrap lg:flex-nowrap gap-3 w-full items-stretch sm:items-center">
            {/* 1. All Years Dropdown */}
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full sm:flex-1 min-w-[150px] lg:min-w-0 h-10 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer"
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
              className="w-full sm:flex-1 min-w-[150px] lg:min-w-0 h-10 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer truncate"
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

            {/* 3. All Sections Dropdown */}
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="w-full sm:flex-1 min-w-[150px] lg:min-w-0 h-10 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer"
              aria-label="Filter by Section"
            >
              <option value="">All Sections</option>
              {availableSections.map(sec => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
              {unassignedStudents > 0 && (
                <option value="UNASSIGNED">
                  Unassigned ({unassignedStudents})
                </option>
              )}
            </select>

            {/* 4. Search Students */}
            <div className="relative w-full sm:flex-1 min-w-[150px] lg:min-w-0">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            {/* 5. Add Student Button */}
            <button
              onClick={() => navigate('/admin/students/create')}
              className="h-10 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap cursor-pointer shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Student
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-200 sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold bg-slate-50 dark:bg-slate-800">Student ID</th>
                <th className="px-6 py-4 font-semibold bg-slate-50 dark:bg-slate-800">Name</th>
                <th className="px-6 py-4 font-semibold bg-slate-50 dark:bg-slate-800">Year</th>
                <th className="px-6 py-4 font-semibold bg-slate-50 dark:bg-slate-800">Department</th>
                <th className="px-6 py-4 font-semibold bg-slate-50 dark:bg-slate-800">Section</th>
                <th className="px-6 py-4 font-semibold bg-slate-50 dark:bg-slate-800">Status</th>
                <th className="px-6 py-4 font-semibold text-right bg-slate-50 dark:bg-slate-800">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {sortedFiltered.map((s) => (
                <tr
                  key={s._id}
                  onClick={() => navigate(`/admin/students/${s._id}`)}
                  className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group"
                  title="Click to view student profile"
                >
                  {/* 1. Student ID */}
                  <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    <Link
                      to={`/admin/students/${s._id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline"
                    >
                      {s.studentId}
                    </Link>
                  </td>

                  {/* 2. Name */}
                  <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">
                    <Link
                      to={`/admin/students/${s._id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      {s.user?.name || s.personalInfo?.name || 'Name not available'}
                    </Link>
                  </td>

                  {/* 3. Year (Moved to 3rd position, immediately after Name) */}
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-medium">
                    {resolveStudentYear(s)}
                  </td>

                  {/* 4. Department */}
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                    {resolveStudentDept(s)}
                  </td>

                  {/* 5. Section */}
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-medium">
                    {isStudentEnrolled(s, configuredClasses) ? (
                      <span>Section {resolveSectionName(s, configuredClasses)}</span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                        title="Student has no valid section assignment in configured classes"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Unassigned
                      </span>
                    )}
                  </td>

                  {/* 6. Status */}
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${s.user?.isActive ? 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'}`}>
                      {s.user?.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td
                    className="px-6 py-4 text-right flex justify-end gap-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => toggleStatus(s)}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-medium cursor-pointer"
                    >
                      {s.user?.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => resetPassword(s)}
                      className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <ShieldAlert className="w-4 h-4" /> Reset Pwd
                    </button>
                    <button
                      onClick={() => openDeleteModal(s)}
                      className="text-sm text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 font-medium flex items-center gap-1 cursor-pointer"
                      title="Permanently Delete Student"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
              {sortedFiltered.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    <p className="text-base font-medium">No students found matching the selected filters.</p>
                    {(statusFilter !== 'ALL' || filterYear || filterDepartment || filterSection || searchTerm) && (
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter('ALL');
                          setFilterYear('');
                          setFilterDepartment('');
                          setFilterSection('');
                          setSearchTerm('');
                        }}
                        className="mt-2 inline-flex items-center text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                      >
                        Reset all filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Edit Student</h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSave} className="p-6">
              {formError && (
                <div className="mb-6 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg text-sm border border-rose-200 dark:border-rose-900/50">
                  {formError}
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                      <input type="text" name="personalInfo.name" value={formData.personalInfo.name} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                      <input type="email" name="personalInfo.email" value={formData.personalInfo.email} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">Academic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Course</label>
                      <select value={courseSelect} onChange={(e) => {
                        const val = e.target.value;
                        setCourseSelect(val);
                        if (val !== 'Other') setFormData(prev => ({ ...prev, course: val }));
                        else setFormData(prev => ({ ...prev, course: '' }));
                      }} required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select Course</option>
                        {coursesList.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="Other">Other</option>
                      </select>
                      {courseSelect === 'Other' && (
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Please specify *</label>
                          <input type="text" name="course" value={formData.course} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Enter custom course" />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Department <span className="text-rose-500">*</span>
                      </label>
                      {loadingDepts ? (
                        <div className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-sm">
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                          <span>Loading departments...</span>
                        </div>
                      ) : deptError ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between p-2.5 border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg text-xs">
                            <span>{deptError}</span>
                            <button
                              type="button"
                              onClick={fetchDepartments}
                              className="underline font-semibold hover:text-rose-800 dark:hover:text-rose-200 ml-2 cursor-pointer"
                            >
                              Retry
                            </button>
                          </div>
                        </div>
                      ) : (
                        <select
                          id="edit-student-department-select"
                          name="department"
                          value={departmentSelect}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDepartmentSelect(val);
                            if (val !== 'Other') setFormData(prev => ({ ...prev, department: val }));
                            else setFormData(prev => ({ ...prev, department: '' }));
                          }}
                          required
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select Department</option>
                          {departments.length === 0 ? (
                            <option value="" disabled>No departments configured</option>
                          ) : (
                            departments.map(d => {
                              const optVal = d._id || d.code || d.name;
                              const optLabel = (d.name && d.name.trim()) || (d.code && d.code.trim()) || 'Unnamed Department';
                              return (
                                <option key={optVal} value={optVal}>
                                  {optLabel}
                                </option>
                              );
                            })
                          )}
                          <option value="Other">Other</option>
                        </select>
                      )}
                      {departmentSelect === 'Other' && (
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Please specify *</label>
                          <input
                            type="text"
                            name="department"
                            value={formData.department}
                            onChange={handleChange}
                            required
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            placeholder="Enter custom department"
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Semester</label>
                      <select value={semesterSelect} onChange={(e) => {
                        const val = e.target.value;
                        setSemesterSelect(val);
                        if (val !== 'Other') setFormData(prev => ({ ...prev, semester: val }));
                        else setFormData(prev => ({ ...prev, semester: '' }));
                      }} required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select Semester</option>
                        {semestersList.map(s => <option key={s} value={s}>{s}</option>)}
                        <option value="Other">Other</option>
                      </select>
                      {semesterSelect === 'Other' && (
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Please specify *</label>
                          <input type="text" name="semester" value={formData.semester} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Enter custom semester" />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Academic Year</label>
                      <input type="text" name="academicYear" value={formData.academicYear} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Section</label>
                      <input type="text" name="section" value={formData.section} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">Account Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Student Login ID</label>
                      <input type="text" name="studentId" value={formData.studentId} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300" readOnly title="Student ID is read-only by default" />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Student ID is used for login and cannot be easily changed.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-5 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-900">
                <button type="button" onClick={handleCloseModal} className="px-5 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors cursor-pointer border border-transparent dark:border-slate-700">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors flex items-center justify-center gap-2 min-w-[100px] cursor-pointer">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title="Delete Permanently?"
        recordName={studentToDelete ? `${studentToDelete.user?.name || studentToDelete.personalInfo?.name || 'Student'} (${studentToDelete.studentId})` : ''}
        message="Are you sure you want to permanently delete this record? This action cannot be undone."
        loading={deleting}
        error={deleteError}
      />
    </div>
  );
}
