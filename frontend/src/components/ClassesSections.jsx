import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../api';
import { usePageRefresh } from '../context/RefreshContext';
import {
  BookOpen,
  Users,
  GraduationCap,
  Search,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Calendar,
  Building2,
  Hash,
  X,
  Loader2,
  Sparkles,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  UserCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  UserPlus,
  Pencil,
  AlertTriangle,
  MoreVertical,
  Eye
} from 'lucide-react';

// Academic years of study in canonical order
const ACADEMIC_YEARS_ORDER = [
  { id: 'First Year', label: 'First Year', order: 1, defaultSemesters: ['1st', '2nd'] },
  { id: 'Second Year', label: 'Second Year', order: 2, defaultSemesters: ['3rd', '4th'] },
  { id: 'Third Year', label: 'Third Year', order: 3, defaultSemesters: ['5th', '6th'] },
  { id: 'Fourth Year', label: 'Fourth Year', order: 4, defaultSemesters: ['7th', '8th'] },
];

// Helper to calculate assignment metrics and status consistently
export const calculateAssignmentMetrics = (assignments = []) => {
  const activeAssignments = (assignments || []).filter(a => a && a.isActive !== false);
  const subjectIds = new Set();
  const teacherIds = new Set();
  const subjectTeacherMap = new Map();

  for (const asgn of activeAssignments) {
    const sId = asgn.subject?._id ? asgn.subject._id.toString() : (asgn.subject ? asgn.subject.toString() : null);
    const tId = asgn.teacher?._id ? asgn.teacher._id.toString() : (asgn.teacher ? asgn.teacher.toString() : null);

    if (sId) {
      subjectIds.add(sId);
      if (!subjectTeacherMap.has(sId)) {
        subjectTeacherMap.set(sId, new Set());
      }
      if (tId) {
        teacherIds.add(tId);
        subjectTeacherMap.get(sId).add(tId);
      }
    }
  }

  const subjectsCount = subjectIds.size;
  const teachersCount = teacherIds.size;

  let allSubjectsHaveTeachers = subjectsCount > 0;
  for (const [, teachers] of subjectTeacherMap.entries()) {
    if (teachers.size === 0) {
      allSubjectsHaveTeachers = false;
      break;
    }
  }

  const isAssigned = subjectsCount > 0 && teachersCount > 0 && allSubjectsHaveTeachers;
  return {
    subjectsCount,
    teachersCount,
    status: isAssigned ? 'Assigned' : 'Not Assigned',
    hasPendingAssignments: !isAssigned
  };
};

export default function ClassesSections() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [totalEnrolledStudents, setTotalEnrolledStudents] = useState(0);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Search & Filter Toolbar State
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Summary Card Filter State: 'all' | 'assigned' | 'not_assigned'
  const [cardFilter, setCardFilter] = useState('all');

  // Modal State: Manage Group Assignments
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupModalTab, setGroupModalTab] = useState('assignments'); // 'assignments' | 'students'
  const [assignmentRows, setAssignmentRows] = useState([]); // [{ subjectId: '', teacherId: '' }]
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const initialAssignmentRowsRef = useRef('[]');

  // Modal State: View Section Students (Task 6)
  const [viewingSectionStudents, setViewingSectionStudents] = useState(null);
  const [sectionStudentsLoading, setSectionStudentsLoading] = useState(false);
  const [sectionStudentSearch, setSectionStudentSearch] = useState('');

  // Three-dot dropdown menu active state
  const [activeDropdownSectionId, setActiveDropdownSectionId] = useState(null);

  // Modal State: Add Department (Task 4)
  const [addDeptModal, setAddDeptModal] = useState({
    isOpen: false,
    yearOfStudy: 'First Year',
    department: '',
    customDepartment: '',
    customCode: '',
    course: 'B.Tech',
    academicYear: '',
    semester: '1st',
    section: 'A'
  });
  const [savingDept, setSavingDept] = useState(false);
  const [deptFormError, setDeptFormError] = useState('');

  // Modal State: Add Section (Task 4)
  const [addSectionModal, setAddSectionModal] = useState({
    isOpen: false,
    departmentName: '',
    departmentCode: '',
    course: '',
    academicYear: '',
    yearOfStudy: '',
    semester: '',
    section: ''
  });
  const [savingSection, setSavingSection] = useState(false);
  const [sectionFormError, setSectionFormError] = useState('');

  // Modal State: Safe Reconciliation (Task 5)
  const [reconcileModal, setReconcileModal] = useState({
    isOpen: false,
    loading: false,
    result: null
  });

  // Modal State: Delete Department Confirmation
  const [deleteDeptModal, setDeleteDeptModal] = useState({
    isOpen: false,
    deptCard: null,
    loading: false,
    error: ''
  });

  // Modal State: Delete Section Confirmation
  const [deleteSectionModal, setDeleteSectionModal] = useState({
    isOpen: false,
    section: null,
    deptCard: null,
    loading: false,
    error: ''
  });

  // Modal State: Edit Section
  const [editSectionModal, setEditSectionModal] = useState({
    isOpen: false,
    section: null,
    deptCard: null,
    sectionId: '',
    sectionName: '',
    department: '',
    customDepartment: '',
    academicYear: '',
    semester: '1st',
    yearOfStudy: 'First Year',
    course: 'B.Tech',
    isActive: true,
    studentCount: 0,
    assignmentCount: 0,
    assignments: [],
    students: [],
    activeTab: 'details', // 'details' | 'assignments' | 'students'
    loadingDetails: false,
    saving: false,
    error: '',
    errors: {},
    showMoveConfirm: false,
    initialValues: null
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [clsRes, subjRes, tchRes, deptRes, ayRes] = await Promise.all([
        adminApi.getClasses(),
        adminApi.getSubjects(),
        adminApi.getTeachers(),
        adminApi.getDepartments(),
        adminApi.getAcademicYears()
      ]);

      if (clsRes.success) {
        setClasses(clsRes.classes || []);
        if (clsRes.totalEnrolledStudents !== undefined) {
          setTotalEnrolledStudents(clsRes.totalEnrolledStudents);
        } else {
          // Calculate deduplicated student count
          const total = (clsRes.classes || []).reduce((sum, c) => sum + (c.studentCount || 0), 0);
          setTotalEnrolledStudents(total);
        }
      }
      if (subjRes.success) setSubjects(subjRes.subjects || []);
      if (tchRes.success) setTeachers(tchRes.teachers || []);
      if (deptRes.success) setDepartments(deptRes.departments || []);
      if (ayRes.success) {
        setAcademicYears(ayRes.academicYears || []);
        const active = (ayRes.academicYears || []).find(y => y.isActive);
        if (active) {
          setAddDeptModal(prev => ({ ...prev, academicYear: active.year }));
        }
      }
    } catch (err) {
      console.error('Failed to load classes data:', err);
      setError(err.response?.data?.error || 'Failed to load classes and academic hierarchy.');
    } finally {
      setLoading(false);
    }
  };

  usePageRefresh(loadData);

  useEffect(() => {
    loadData();
  }, []);

  // Close three-dot section menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('[data-section-menu]')) {
        setActiveDropdownSectionId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Filter active subjects & active teachers
  const activeSubjects = subjects.filter(s => s.isActive !== false);
  const activeTeachers = teachers.filter(t => t.user?.isActive !== false);

  // Helper to resolve department display code and name
  const getDeptInfo = (deptString) => {
    if (!deptString) return { code: 'DEPT', name: 'Department', displayName: 'Department' };
    const trimmed = typeof deptString === 'string' ? deptString.trim() : (deptString?.name || String(deptString)).trim();
    const found = departments.find(d => 
      (d._id && String(d._id) === String(trimmed)) ||
      (d.code && d.code.toLowerCase() === trimmed.toLowerCase()) || 
      (d.name && d.name.toLowerCase() === trimmed.toLowerCase())
    );
    if (found) {
      return {
        code: found.code || (found.name?.length <= 5 ? found.name.toUpperCase() : found.name?.substring(0, 4).toUpperCase()),
        name: found.name,
        displayName: found.code ? `${found.code} — ${found.name}` : found.name
      };
    }
    return {
      code: trimmed.length <= 5 ? trimmed.toUpperCase() : trimmed.substring(0, 4).toUpperCase(),
      name: trimmed,
      displayName: trimmed
    };
  };

  // Helper to determine if a section is fully assigned
  const isSectionFullyAssigned = (c) => {
    const metrics = calculateAssignmentMetrics(c.assignments);
    const status = c.status || metrics.status;
    return status === 'Assigned';
  };

  // --- Summary Counts from actual MongoDB records ---
  const totalGroupsCount = classes.length;
  const assignedGroupsCount = useMemo(() => {
    return classes.filter(isSectionFullyAssigned).length;
  }, [classes]);
  const notAssignedGroupsCount = useMemo(() => {
    return classes.length - assignedGroupsCount;
  }, [classes, assignedGroupsCount]);
  const enrolledStudentsCount = totalEnrolledStudents;

  // Academic year options for dropdown: strictly academic study level (no calendar years)
  const ACADEMIC_YEAR_OPTIONS = ['First Year', 'Second Year', 'Third Year', 'Fourth Year'];

  // Deduplicated unique departments from database
  const uniqueDepartments = useMemo(() => {
    const seen = new Set();
    const list = [];
    (departments || []).forEach(d => {
      if (!d) return;
      const name = (d.name || '').trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        list.push(d);
      }
    });
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [departments]);

  // Handle Summary Card Clicks
  const handleCardClick = (filterType) => {
    if (filterType === 'all') {
      setCardFilter('all');
    } else if (filterType === 'enrolled') {
      navigate('/admin/students');
    } else if (filterType === 'assigned') {
      setCardFilter('assigned');
    } else if (filterType === 'not_assigned') {
      setCardFilter('not_assigned');
    }
  };

  // Reset all search and filter conditions immediately
  const handleResetAllFilters = () => {
    setSearchTerm('');
    setYearFilter('all');
    setDepartmentFilter('all');
    setCardFilter('all');
  };

  // --- Filter Classes based on Search and Filter Criteria ---
  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      // 1. Search filter: search department names, section names, and program names
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term ||
        (c.name || '').toLowerCase().includes(term) ||
        (c.course || '').toLowerCase().includes(term) ||
        (c.department || '').toLowerCase().includes(term) ||
        (c.section || '').toLowerCase().includes(term) ||
        (c.semester || '').toLowerCase().includes(term) ||
        (c.academicYear || '').toLowerCase().includes(term) ||
        (c.yearOfStudy || '').toLowerCase().includes(term);

      // 2. Academic Year dropdown filter (study year level)
      let matchesYear = true;
      if (yearFilter && yearFilter !== 'all') {
        const cleanYear = yearFilter.trim().toLowerCase();
        const cStudyYear = (c.yearOfStudy || '').trim().toLowerCase();
        const cAcadYear = (c.academicYear || '').trim().toLowerCase();
        const cSem = String(c.semester || '').trim().toLowerCase();

        if (cleanYear === 'first year') {
          matchesYear = cStudyYear === 'first year' || cSem === '1st' || cSem === '2nd' || cAcadYear === 'first year';
        } else if (cleanYear === 'second year') {
          matchesYear = cStudyYear === 'second year' || cSem === '3rd' || cSem === '4th' || cAcadYear === 'second year';
        } else if (cleanYear === 'third year') {
          matchesYear = cStudyYear === 'third year' || cSem === '5th' || cSem === '6th' || cAcadYear === 'third year';
        } else if (cleanYear === 'fourth year') {
          matchesYear = cStudyYear === 'fourth year' || cSem === '7th' || cSem === '8th' || cAcadYear === 'fourth year';
        }
      }

      // 3. Department dropdown filter
      const matchesDept = departmentFilter === 'all' || 
        c.department === departmentFilter ||
        departments.some(d => d.code === departmentFilter && (c.department === d.name || c.department === d.code));

      // 4. Summary Card interactive filter
      let matchesCard = true;
      if (cardFilter === 'assigned') {
        matchesCard = isSectionFullyAssigned(c);
      } else if (cardFilter === 'not_assigned') {
        matchesCard = !isSectionFullyAssigned(c);
      } else if (cardFilter === 'enrolled') {
        matchesCard = (c.studentCount || 0) > 0;
      }

      return matchesSearch && matchesYear && matchesDept && matchesCard;
    });
  }, [classes, searchTerm, yearFilter, departmentFilter, cardFilter, departments]);

  // --- Task 2 & Task 3: Build Academic Hierarchy ---
  // Structure: 4 Academic Years -> Departments configured for that year -> Inner Sections Grid
  const academicYearHierarchy = useMemo(() => {
    return ACADEMIC_YEARS_ORDER.map(yearMeta => {
      // Find all sections belonging to this year of study
      const yearSections = filteredClasses.filter(c => {
        if (c.yearOfStudy === yearMeta.id) return true;
        if (!c.yearOfStudy) {
          const s = String(c.semester || '').toLowerCase();
          if (yearMeta.id === 'First Year' && (s === '1st' || s === '2nd')) return true;
          if (yearMeta.id === 'Second Year' && (s === '3rd' || s === '4th')) return true;
          if (yearMeta.id === 'Third Year' && (s === '5th' || s === '6th')) return true;
          if (yearMeta.id === 'Fourth Year' && (s === '7th' || s === '8th')) return true;
        }
        return false;
      });

      // Group sections by department inside this year
      const deptMap = {};
      yearSections.forEach(section => {
        const deptKey = `${section.course || 'B.Tech'}:::${section.department}`;
        if (!deptMap[deptKey]) {
          const deptInfo = getDeptInfo(section.department);
          deptMap[deptKey] = {
            deptKey,
            departmentName: section.department,
            departmentCode: deptInfo.code,
            displayName: deptInfo.displayName,
            course: section.course || 'B.Tech',
            academicYear: section.academicYear,
            yearOfStudy: yearMeta.id,
            semesters: new Set(),
            sections: [],
            totalStudents: 0
          };
        }
        deptMap[deptKey].sections.push(section);
        deptMap[deptKey].totalStudents += (section.studentCount || 0);
        if (section.semester) deptMap[deptKey].semesters.add(section.semester);
      });

      // Sort sections within each department by section name (Section A, B, C...)
      const departmentCards = Object.values(deptMap).map(dept => {
        const sortedSections = [...dept.sections].sort((a, b) => 
          (a.section || '').localeCompare(b.section || '', undefined, { numeric: true, sensitivity: 'base' })
        );
        const sortedSemesters = Array.from(dept.semesters).sort();
        return {
          ...dept,
          semesters: sortedSemesters,
          sections: sortedSections,
          sectionCount: sortedSections.length
        };
      });

      // Sort department cards alphabetically by department name
      departmentCards.sort((a, b) => a.departmentName.localeCompare(b.departmentName));

      const totalYearSections = departmentCards.reduce((acc, d) => acc + d.sections.length, 0);
      const totalYearStudents = departmentCards.reduce((acc, d) => acc + d.totalStudents, 0);

      return {
        ...yearMeta,
        departments: departmentCards,
        departmentCount: departmentCards.length,
        totalSections: totalYearSections,
        totalStudents: totalYearStudents
      };
    });
  }, [filteredClasses, departments]);

  // Displayed Academic Hierarchy filtered by selected academic year level
  const displayedHierarchy = useMemo(() => {
    if (!yearFilter || yearFilter === 'all') {
      return academicYearHierarchy;
    }
    const cleanYear = yearFilter.trim().toLowerCase();
    return academicYearHierarchy.filter(y => y.id.toLowerCase() === cleanYear);
  }, [academicYearHierarchy, yearFilter]);

  // --- Tasks 3, 4, 5: View Section Details (Assignments, Students, Subjects, Teachers) ---
  const handleOpenSectionStudents = async (section, initialTab = 'overview') => {
    const initialAssignments = section.assignments || [];
    const initialMetrics = calculateAssignmentMetrics(initialAssignments);
    setViewingSectionStudents({
      section,
      students: [],
      assignments: initialAssignments,
      studentCount: section.studentCount || 0,
      assignmentCount: section.assignmentCount !== undefined ? section.assignmentCount : initialAssignments.length,
      subjectsCount: section.subjectsCount !== undefined ? section.subjectsCount : initialMetrics.subjectsCount,
      teachersCount: section.teachersCount !== undefined ? section.teachersCount : initialMetrics.teachersCount,
      status: section.status || initialMetrics.status,
      activeTab: initialTab,
      isOpen: true
    });
    setSectionStudentSearch('');
    setSectionStudentsLoading(true);

    try {
      const res = await adminApi.getClassById(section._id);
      if (res.success && res.class) {
        const fetchedClass = res.class;
        const fetchedMetrics = calculateAssignmentMetrics(fetchedClass.assignments);
        setViewingSectionStudents(prev => ({
          ...prev,
          section: fetchedClass,
          students: fetchedClass.students || [],
          assignments: fetchedClass.assignments || [],
          studentCount: fetchedClass.studentCount !== undefined ? fetchedClass.studentCount : (fetchedClass.students ? fetchedClass.students.length : 0),
          assignmentCount: fetchedClass.assignmentCount !== undefined ? fetchedClass.assignmentCount : (fetchedClass.assignments ? fetchedClass.assignments.length : 0),
          subjectsCount: fetchedClass.subjectsCount !== undefined ? fetchedClass.subjectsCount : fetchedMetrics.subjectsCount,
          teachersCount: fetchedClass.teachersCount !== undefined ? fetchedClass.teachersCount : fetchedMetrics.teachersCount,
          status: fetchedClass.status || fetchedMetrics.status,
          isOpen: true
        }));
      }
    } catch (err) {
      console.error('Failed to fetch section details:', err);
    } finally {
      setSectionStudentsLoading(false);
    }
  };

  const handleCloseSectionStudents = () => {
    setViewingSectionStudents(null);
    setSectionStudentSearch('');
  };

  // --- Task 1: Delete Department Handlers ---
  const handlePromptDeleteDepartment = (deptCard) => {
    setDeleteDeptModal({
      isOpen: true,
      deptCard,
      loading: false,
      error: ''
    });
  };

  const handleConfirmDeleteDepartment = async () => {
    if (!deleteDeptModal.deptCard) return;
    const { deptCard } = deleteDeptModal;
    setDeleteDeptModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await adminApi.deleteDepartment(deptCard.departmentName, {
        yearOfStudy: deptCard.yearOfStudy,
        course: deptCard.course
      });
      if (res.success) {
        setActionSuccess(res.message || `Department "${deptCard.displayName}" deleted successfully.`);
        setDeleteDeptModal({ isOpen: false, deptCard: null, loading: false, error: '' });
        await loadData();
        setTimeout(() => setActionSuccess(''), 5000);
      }
    } catch (err) {
      console.error('Failed to delete department:', err);
      const errMsg = err.response?.data?.error || 'Failed to delete department.';
      setDeleteDeptModal(prev => ({ ...prev, loading: false, error: errMsg }));
    }
  };

  // --- Task 1: Delete Section Handlers ---
  const handlePromptDeleteSection = (section, deptCard) => {
    const metrics = calculateAssignmentMetrics(section.assignments);
    const subjectsCount = section.subjectsCount !== undefined ? section.subjectsCount : metrics.subjectsCount;
    const teachersCount = section.teachersCount !== undefined ? section.teachersCount : metrics.teachersCount;
    setDeleteSectionModal({
      isOpen: true,
      section: {
        ...section,
        subjectsCount,
        teachersCount
      },
      deptCard,
      loading: false,
      error: ''
    });
  };

  const handleConfirmDeleteSection = async () => {
    if (!deleteSectionModal.section || deleteSectionModal.loading) return;
    const { section } = deleteSectionModal;
    setDeleteSectionModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await adminApi.deleteClass(section._id, { confirm: true });
      if (res.success) {
        setActionSuccess(res.message || `Section "${section.section}" deleted successfully.`);
        setDeleteSectionModal({ isOpen: false, section: null, deptCard: null, loading: false, error: '' });
        await loadData();
        setTimeout(() => setActionSuccess(''), 5000);
      } else {
        setDeleteSectionModal(prev => ({ ...prev, loading: false, error: res.error || 'Failed to delete section.' }));
      }
    } catch (err) {
      console.error('Failed to delete section:', err);
      const errMsg = err.response?.data?.error || 'Failed to delete section.';
      setDeleteSectionModal(prev => ({ ...prev, loading: false, error: errMsg }));
    }
  };

  // --- Edit Section Handlers ---
  const handleOpenEditSection = async (section, deptCard) => {
    const rawDept = section.department || deptCard?.departmentName || '';
    const matchedDeptObj = departments.find(d => 
      (section.departmentRef && String(d._id) === String(section.departmentRef?._id || section.departmentRef)) ||
      (rawDept && (
        d.name?.toLowerCase() === rawDept.toLowerCase() ||
        d.code?.toLowerCase() === rawDept.toLowerCase() ||
        String(d._id) === String(rawDept)
      ))
    );
    const initialMetrics = calculateAssignmentMetrics(section.assignments);

    const initial = {
      sectionId: section._id,
      sectionName: section.section || '',
      department: matchedDeptObj ? matchedDeptObj.name : (rawDept ? 'Other' : (departments[0]?.name || '')),
      customDepartment: !matchedDeptObj ? rawDept : '',
      academicYear: section.academicYear || deptCard?.academicYear || academicYears[0]?.year || '2026-2027',
      semester: section.semester || '1st',
      yearOfStudy: section.yearOfStudy || deptCard?.yearOfStudy || 'First Year',
      course: section.course || deptCard?.course || 'B.Tech',
      isActive: section.isActive !== false,
      studentCount: section.studentCount || 0,
      assignmentCount: section.assignmentCount !== undefined ? section.assignmentCount : (section.assignments ? section.assignments.length : 0),
      subjectsCount: section.subjectsCount !== undefined ? section.subjectsCount : initialMetrics.subjectsCount,
      teachersCount: section.teachersCount !== undefined ? section.teachersCount : initialMetrics.teachersCount,
      status: section.status || initialMetrics.status,
      assignments: section.assignments || [],
      students: []
    };

    setEditSectionModal({
      isOpen: true,
      section,
      deptCard,
      ...initial,
      activeTab: 'details',
      loadingDetails: true,
      saving: false,
      error: '',
      errors: {},
      showMoveConfirm: false,
      initialValues: { ...initial }
    });

    try {
      const res = await adminApi.getClassById(section._id);
      if (res.success && res.class) {
        const fetchedClass = res.class;
        const fetchedDept = fetchedClass.department || '';
        const fetchedMatchedDept = departments.find(d => 
          (fetchedClass.departmentRef && String(d._id) === String(fetchedClass.departmentRef?._id || fetchedClass.departmentRef)) ||
          (fetchedDept && (
            d.name?.toLowerCase() === fetchedDept.toLowerCase() ||
            d.code?.toLowerCase() === fetchedDept.toLowerCase() ||
            String(d._id) === String(fetchedDept)
          ))
        );
        const fetchedMetrics = calculateAssignmentMetrics(fetchedClass.assignments);

        const loadedValues = {
          sectionId: fetchedClass._id,
          sectionName: fetchedClass.section || '',
          department: fetchedMatchedDept ? fetchedMatchedDept.name : (fetchedDept ? 'Other' : (departments[0]?.name || '')),
          customDepartment: !fetchedMatchedDept ? fetchedDept : '',
          academicYear: fetchedClass.academicYear || initial.academicYear,
          semester: fetchedClass.semester || initial.semester,
          yearOfStudy: fetchedClass.yearOfStudy || initial.yearOfStudy,
          course: fetchedClass.course || initial.course,
          isActive: fetchedClass.isActive !== false,
          studentCount: fetchedClass.studentCount !== undefined ? fetchedClass.studentCount : (fetchedClass.students ? fetchedClass.students.length : 0),
          assignmentCount: fetchedClass.assignmentCount !== undefined ? fetchedClass.assignmentCount : (fetchedClass.assignments ? fetchedClass.assignments.length : 0),
          subjectsCount: fetchedClass.subjectsCount !== undefined ? fetchedClass.subjectsCount : fetchedMetrics.subjectsCount,
          teachersCount: fetchedClass.teachersCount !== undefined ? fetchedClass.teachersCount : fetchedMetrics.teachersCount,
          status: fetchedClass.status || fetchedMetrics.status,
          assignments: fetchedClass.assignments || [],
          students: fetchedClass.students || []
        };

        setEditSectionModal(prev => ({
          ...prev,
          section: fetchedClass,
          ...loadedValues,
          loadingDetails: false,
          initialValues: { ...loadedValues }
        }));
      } else {
        setEditSectionModal(prev => ({ ...prev, loadingDetails: false }));
      }
    } catch (err) {
      console.error('Failed to load fresh section details for editing:', err);
      setEditSectionModal(prev => ({ ...prev, loadingDetails: false }));
    }
  };

  const handleCloseEditSection = () => {
    if (editSectionModal.saving) return;
    setEditSectionModal({
      isOpen: false,
      section: null,
      deptCard: null,
      sectionId: '',
      sectionName: '',
      department: '',
      customDepartment: '',
      academicYear: '',
      semester: '1st',
      yearOfStudy: 'First Year',
      course: 'B.Tech',
      isActive: true,
      studentCount: 0,
      assignmentCount: 0,
      subjectsCount: 0,
      teachersCount: 0,
      status: 'Not Assigned',
      assignments: [],
      students: [],
      activeTab: 'details',
      loadingDetails: false,
      saving: false,
      error: '',
      errors: {},
      showMoveConfirm: false,
      initialValues: null
    });
  };

  const handleSaveEditSection = async (forceMove = false) => {
    setEditSectionModal(prev => ({ ...prev, error: '', errors: {} }));

    let finalDeptName = editSectionModal.department;
    if (editSectionModal.department === 'Other') {
      if (!editSectionModal.customDepartment.trim()) {
        setEditSectionModal(prev => ({
          ...prev,
          error: 'Please enter custom department name.',
          errors: { department: 'Custom department name is required' }
        }));
        return;
      }
      finalDeptName = editSectionModal.customDepartment.trim();
    }

    if (!editSectionModal.sectionName.trim()) {
      setEditSectionModal(prev => ({
        ...prev,
        error: 'Section identifier is required (e.g. A, B, or C).',
        errors: { sectionName: 'Section name cannot be empty.' }
      }));
      return;
    }

    if (!finalDeptName) {
      setEditSectionModal(prev => ({
        ...prev,
        error: 'Department is required.',
        errors: { department: 'Department is required.' }
      }));
      return;
    }

    if (!editSectionModal.academicYear.trim()) {
      setEditSectionModal(prev => ({
        ...prev,
        error: 'Academic Year is required.',
        errors: { academicYear: 'Academic Year is required.' }
      }));
      return;
    }

    if (!editSectionModal.semester) {
      setEditSectionModal(prev => ({
        ...prev,
        error: 'Semester is required.',
        errors: { semester: 'Semester is required.' }
      }));
      return;
    }

    // Check if moving to a different department, academicYear, or semester
    const initial = editSectionModal.initialValues;
    const initialDept = initial ? (initial.department === 'Other' ? initial.customDepartment : initial.department) : '';
    const hasDeptChanged = initial && finalDeptName.trim().toLowerCase() !== initialDept.trim().toLowerCase();
    const hasYearChanged = initial && editSectionModal.academicYear.trim().toLowerCase() !== (initial.academicYear || '').trim().toLowerCase();
    const hasSemChanged = initial && String(editSectionModal.semester).trim() !== String(initial.semester || '').trim();

    const isMoving = hasDeptChanged || hasYearChanged || hasSemChanged;
    const hasDependencies = (editSectionModal.studentCount > 0) || (editSectionModal.assignmentCount > 0);

    if (isMoving && hasDependencies && !forceMove) {
      // Require explicit confirmation
      setEditSectionModal(prev => ({ ...prev, showMoveConfirm: true }));
      return;
    }

    // Compute canonical yearOfStudy based on semester
    let derivedYear = editSectionModal.yearOfStudy;
    const semStr = String(editSectionModal.semester);
    if (semStr === '1st' || semStr === '2nd') derivedYear = 'First Year';
    else if (semStr === '3rd' || semStr === '4th') derivedYear = 'Second Year';
    else if (semStr === '5th' || semStr === '6th') derivedYear = 'Third Year';
    else if (semStr === '7th' || semStr === '8th') derivedYear = 'Fourth Year';

    setEditSectionModal(prev => ({ ...prev, saving: true, error: '', showMoveConfirm: false }));

    try {
      const payload = {
        course: editSectionModal.course.trim(),
        department: finalDeptName,
        academicYear: editSectionModal.academicYear.trim(),
        semester: editSectionModal.semester.trim(),
        section: editSectionModal.sectionName.trim(),
        yearOfStudy: derivedYear,
        isActive: editSectionModal.isActive
      };

      const res = await adminApi.updateClass(editSectionModal.sectionId, payload);
      if (res.success) {
        setActionSuccess(res.message || `Section "${editSectionModal.sectionName.trim()}" updated successfully.`);
        handleCloseEditSection();
        await loadData();
        setTimeout(() => setActionSuccess(''), 5000);
      }
    } catch (err) {
      console.error('Failed to update section:', err);
      const errMsg = err.response?.data?.error || 'Failed to update section. Please check your inputs.';
      const errFields = err.response?.data?.errors || {};
      setEditSectionModal(prev => ({
        ...prev,
        saving: false,
        error: errMsg,
        errors: errFields
      }));
    }
  };

  // Filter students inside the View Details modal
  const modalFilteredStudents = useMemo(() => {
    if (!viewingSectionStudents || !viewingSectionStudents.students) return [];
    const term = sectionStudentSearch.toLowerCase().trim();
    if (!term) return viewingSectionStudents.students;
    return viewingSectionStudents.students.filter(stu => {
      const name = (stu.user?.name || stu.personalInfo?.name || '').toLowerCase();
      const studentId = (stu.studentId || '').toLowerCase();
      const email = (stu.personalInfo?.email || stu.user?.email || '').toLowerCase();
      return name.includes(term) || studentId.includes(term) || email.includes(term);
    });
  }, [viewingSectionStudents, sectionStudentSearch]);

  // Distinct subjects assigned to this section
  const modalDistinctSubjects = useMemo(() => {
    if (!viewingSectionStudents || !viewingSectionStudents.assignments) return [];
    const seen = new Set();
    const list = [];
    viewingSectionStudents.assignments.forEach(asgn => {
      const sub = asgn.subject;
      if (!sub) return;
      const key = String(sub._id || sub.code || sub.name);
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          _id: sub._id,
          code: sub.code || '—',
          name: sub.name || 'Unnamed Subject',
          subjectType: sub.subjectType || 'Theory',
          credits: sub.credits !== undefined ? sub.credits : '—',
          teacherName: asgn.teacher?.user?.name || asgn.teacher?.personalInfo?.name || asgn.teacher?.teacherId || 'Unassigned',
          status: asgn.isActive !== false ? 'Active' : 'Inactive'
        });
      }
    });
    return list;
  }, [viewingSectionStudents]);

  // Distinct teachers assigned to this section
  const modalDistinctTeachers = useMemo(() => {
    if (!viewingSectionStudents || !viewingSectionStudents.assignments) return [];
    const teacherMap = new Map();
    viewingSectionStudents.assignments.forEach(asgn => {
      const tch = asgn.teacher;
      if (!tch) return;
      const key = String(tch._id || tch.teacherId || tch.user?.userId || tch.user?.name);
      const subName = asgn.subject?.name
        ? `${asgn.subject.name}${asgn.subject.code ? ` (${asgn.subject.code})` : ''}`
        : (asgn.subject?.code || 'Assigned Subject');
      if (teacherMap.has(key)) {
        const existing = teacherMap.get(key);
        if (!existing.subjects.includes(subName)) {
          existing.subjects.push(subName);
        }
      } else {
        teacherMap.set(key, {
          _id: tch._id,
          teacherId: tch.teacherId || tch.user?.userId || 'N/A',
          name: tch.user?.name || tch.personalInfo?.name || tch.name || 'Unnamed Faculty',
          designation: tch.designation || tch.professionalInfo?.designation || 'Faculty Member',
          department: tch.department || 'N/A',
          subjects: [subName],
          status: tch.user?.isActive !== false ? 'Active' : 'Inactive'
        });
      }
    });
    return Array.from(teacherMap.values());
  }, [viewingSectionStudents]);

  // --- Task 7: Manage Assignments Modal ---
  const openGroupModal = async (group) => {
    setModalError('');
    setModalSuccess('');
    setGroupModalTab('assignments');
    setGroupLoading(true);
    try {
      const res = await adminApi.getClassById(group._id);
      if (res.success && res.class) {
        setSelectedGroup(res.class);
        const currentRows = (res.class.assignments || []).map(a => ({
          subjectId: a.subject?._id || a.subject || '',
          teacherId: a.teacher?._id || a.teacher || ''
        }));
        setAssignmentRows(currentRows);
        initialAssignmentRowsRef.current = JSON.stringify(currentRows);
      } else {
        setSelectedGroup(group);
        setAssignmentRows([]);
        initialAssignmentRowsRef.current = '[]';
      }
    } catch (err) {
      console.error('Failed to load group details:', err);
      setSelectedGroup(group);
      setAssignmentRows([]);
      initialAssignmentRowsRef.current = '[]';
    } finally {
      setGroupLoading(false);
    }
  };

  const closeGroupModal = () => {
    if (savingAssignments) return;
    const hasUnsavedChanges = JSON.stringify(assignmentRows) !== initialAssignmentRowsRef.current;
    if (hasUnsavedChanges) {
      const confirmDiscard = window.confirm('You have unsaved changes in subject assignments. Are you sure you want to discard them?');
      if (!confirmDiscard) return;
    }
    setSelectedGroup(null);
    setAssignmentRows([]);
    setModalError('');
    setModalSuccess('');
  };

  const handleAddAssignmentRow = () => {
    setAssignmentRows(prev => [...prev, { subjectId: '', teacherId: '' }]);
  };

  const handleRemoveAssignmentRow = (index) => {
    setAssignmentRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index, field, value) => {
    setAssignmentRows(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSaveAssignments = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');

    const seenSubjects = new Set();
    for (let i = 0; i < assignmentRows.length; i++) {
      const row = assignmentRows[i];
      if (!row.subjectId) {
        setModalError(`Row ${i + 1}: Please select a subject.`);
        return;
      }
      if (seenSubjects.has(row.subjectId)) {
        const subName = activeSubjects.find(s => s._id === row.subjectId)?.name || 'This subject';
        setModalError(`"${subName}" is assigned more than once. Each subject can only be assigned once per section.`);
        return;
      }
      seenSubjects.add(row.subjectId);
    }

    setSavingAssignments(true);
    try {
      const res = await adminApi.updateClassAssignments(selectedGroup._id, assignmentRows);
      if (res.success) {
        initialAssignmentRowsRef.current = JSON.stringify(assignmentRows);
        setModalSuccess(res.message || 'Section assignments updated successfully!');
        setActionSuccess(`Assignments updated for Section ${selectedGroup.section} (${selectedGroup.department})`);
        
        // Refresh local group state
        setSelectedGroup(prev => ({
          ...prev,
          assignments: res.assignments,
          assignmentCount: res.assignmentCount,
          subjectsCount: res.subjectsCount,
          teachersCount: res.teachersCount,
          hasPendingAssignments: res.hasPendingAssignments,
          status: res.status
        }));

        // Refresh global classes list
        await loadData();
        setTimeout(() => setActionSuccess(''), 4500);
      }
    } catch (err) {
      console.error('Failed to update assignments:', err);
      setModalError(err.response?.data?.error || 'Failed to save assignments.');
    } finally {
      setSavingAssignments(false);
    }
  };

  // Eligible subjects for Manage Assignments modal based on section department & academic year
  const eligibleSubjectsForGroup = useMemo(() => {
    if (!selectedGroup) return activeSubjects;
    const groupDept = (selectedGroup.department || '').toLowerCase().trim();
    const groupDeptCode = getDeptInfo(selectedGroup.department).code.toLowerCase().trim();
    const groupYearOfStudy = (selectedGroup.yearOfStudy || '').toLowerCase().trim();
    const groupAy = (selectedGroup.academicYear || '').toLowerCase().trim();

    const deptMatched = activeSubjects.filter(sub => {
      const subDept = (sub.departmentRef?.name || (typeof sub.department === 'string' ? sub.department : sub.department?.name) || '').toLowerCase().trim();
      const isDeptMatch = subDept === groupDept || subDept === groupDeptCode || (groupDept.includes(subDept) && subDept.length > 2) || (subDept.includes(groupDept) && groupDept.length > 2);
      
      if (sub.academicYear) {
        const subAy = sub.academicYear.toLowerCase().trim();
        const isAyMatch = subAy === groupYearOfStudy || subAy === groupAy;
        return isDeptMatch && (isAyMatch || !groupYearOfStudy);
      }
      return isDeptMatch;
    });

    if (deptMatched.length > 0) {
      const assignedIds = new Set(assignmentRows.map(r => r.subjectId).filter(Boolean));
      const result = [...deptMatched];
      activeSubjects.forEach(s => {
        if (assignedIds.has(s._id) && !result.some(r => r._id === s._id)) {
          result.push(s);
        }
      });
      return result;
    }

    return activeSubjects;
  }, [selectedGroup, activeSubjects, assignmentRows]);

  // Eligible teachers for Manage Assignments modal based on section department
  const eligibleTeachersForGroup = useMemo(() => {
    if (!selectedGroup) return activeTeachers;
    const groupDept = (selectedGroup.department || '').toLowerCase().trim();
    const groupDeptCode = getDeptInfo(selectedGroup.department).code.toLowerCase().trim();

    const deptMatched = activeTeachers.filter(tch => {
      const tDept = (tch.departmentRef?.name || (typeof tch.department === 'string' ? tch.department : tch.department?.name) || '').toLowerCase().trim();
      return tDept === groupDept || tDept === groupDeptCode || (groupDept.includes(tDept) && tDept.length > 2) || (tDept.includes(groupDept) && groupDept.length > 2);
    });

    if (deptMatched.length > 0) {
      const assignedIds = new Set(assignmentRows.map(r => r.teacherId).filter(Boolean));
      const result = [...deptMatched];
      activeTeachers.forEach(t => {
        if (assignedIds.has(t._id) && !result.some(r => r._id === t._id)) {
          result.push(t);
        }
      });
      return result;
    }

    return activeTeachers;
  }, [selectedGroup, activeTeachers, assignmentRows]);

  // --- Task 4: Add Department Handler ---
  const handleOpenAddDepartment = (yearOfStudy) => {
    setDeptFormError('');
    const activeYear = academicYears.find(y => y.isActive)?.year || academicYears[0]?.year || '2026-2027';
    let defaultSem = '1st';
    if (yearOfStudy === 'Second Year') defaultSem = '3rd';
    if (yearOfStudy === 'Third Year') defaultSem = '5th';
    if (yearOfStudy === 'Fourth Year') defaultSem = '7th';

    setAddDeptModal({
      isOpen: true,
      yearOfStudy,
      department: departments[0]?.name || 'Computer Science and Engineering',
      customDepartment: '',
      customCode: '',
      course: 'B.Tech',
      academicYear: activeYear,
      semester: defaultSem,
      section: 'A'
    });
  };

  const handleSaveDepartment = async (e) => {
    e.preventDefault();
    setDeptFormError('');

    let finalDeptName = addDeptModal.department;
    if (addDeptModal.department === 'Other') {
      if (!addDeptModal.customDepartment.trim()) {
        setDeptFormError('Please enter custom department name.');
        return;
      }
      finalDeptName = addDeptModal.customDepartment.trim();
    }

    if (!addDeptModal.section.trim()) {
      setDeptFormError('Initial section identifier is required (e.g. A).');
      return;
    }

    setSavingDept(true);
    try {
      const payload = {
        course: addDeptModal.course.trim(),
        department: finalDeptName,
        academicYear: addDeptModal.academicYear.trim(),
        semester: addDeptModal.semester.trim(),
        section: addDeptModal.section.trim(),
        yearOfStudy: addDeptModal.yearOfStudy
      };

      const res = await adminApi.createClass(payload);
      if (res.success) {
        setActionSuccess(`Department "${finalDeptName}" configured with Section ${addDeptModal.section} under ${addDeptModal.yearOfStudy}`);
        setAddDeptModal(prev => ({ ...prev, isOpen: false }));
        await loadData();
        setTimeout(() => setActionSuccess(''), 5000);
      }
    } catch (err) {
      console.error('Failed to create department / section:', err);
      setDeptFormError(err.response?.data?.error || 'Failed to add department and section.');
    } finally {
      setSavingDept(false);
    }
  };

  // --- Task 4: Add Section Handler ---
  const handleOpenAddSection = (deptCard) => {
    setSectionFormError('');
    const nextSectionChar = String.fromCharCode(65 + (deptCard.sections.length || 0)); // e.g. A, B, C, D...
    const sem = deptCard.semesters[0] || (deptCard.yearOfStudy === 'First Year' ? '1st' : deptCard.yearOfStudy === 'Second Year' ? '3rd' : deptCard.yearOfStudy === 'Third Year' ? '5th' : '7th');

    setAddSectionModal({
      isOpen: true,
      departmentName: deptCard.departmentName,
      departmentCode: deptCard.departmentCode,
      course: deptCard.course,
      academicYear: deptCard.academicYear || academicYears[0]?.year || '2026-2027',
      yearOfStudy: deptCard.yearOfStudy,
      semester: sem,
      section: nextSectionChar
    });
  };

  const handleSaveSection = async (e) => {
    e.preventDefault();
    setSectionFormError('');

    if (!addSectionModal.section.trim()) {
      setSectionFormError('Section identifier is required (e.g. A, B, or C).');
      return;
    }

    setSavingSection(true);
    try {
      const payload = {
        course: addSectionModal.course.trim(),
        department: addSectionModal.departmentName.trim(),
        academicYear: addSectionModal.academicYear.trim(),
        semester: addSectionModal.semester.trim(),
        section: addSectionModal.section.trim(),
        yearOfStudy: addSectionModal.yearOfStudy
      };

      const res = await adminApi.createClass(payload);
      if (res.success) {
        setActionSuccess(`Section "${addSectionModal.section}" added to ${addSectionModal.departmentName} (${addSectionModal.yearOfStudy})`);
        setAddSectionModal(prev => ({ ...prev, isOpen: false }));
        await loadData();
        setTimeout(() => setActionSuccess(''), 5000);
      }
    } catch (err) {
      console.error('Failed to add section:', err);
      setSectionFormError(err.response?.data?.error || 'Failed to add section.');
    } finally {
      setSavingSection(false);
    }
  };

  // --- Task 5: Safe Reconciliation Handler ---
  const handleStartReconciliation = async () => {
    setReconcileModal(prev => ({ ...prev, loading: true, result: null }));
    try {
      const res = await adminApi.reconcileStudentGroups();
      setReconcileModal(prev => ({
        ...prev,
        loading: false,
        result: res
      }));
      if (res.success) {
        await loadData();
      }
    } catch (err) {
      setReconcileModal(prev => ({
        ...prev,
        loading: false,
        result: {
          success: false,
          error: err.response?.data?.error || 'Reconciliation failed.'
        }
      }));
    }
  };

  return (
    <div className="space-y-6 pb-16 transition-colors duration-200">
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm flex items-center gap-3 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium">{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 rounded-xl text-sm flex items-center gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Four Interactive Summary Cards: Total Groups -> Enrolled Students -> Fully Assigned -> Not Assigned */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Total Groups */}
          <button
            type="button"
            onClick={() => handleCardClick('all')}
            aria-pressed={cardFilter === 'all'}
            className={`p-5 sm:p-6 rounded-2xl min-h-[118px] flex flex-col justify-between text-left transition-all duration-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 ${
              cardFilter === 'all'
                ? 'bg-indigo-50/40 dark:bg-indigo-950/30 border-2 border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700/60 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Groups
              </span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                {totalGroupsCount}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">sections</span>
            </div>
          </button>

          {/* Card 2: Enrolled Students */}
          <button
            type="button"
            onClick={() => handleCardClick('enrolled')}
            aria-label="View Enrolled Students in Manage Students"
            className="p-5 sm:p-6 rounded-2xl min-h-[118px] flex flex-col justify-between text-left transition-all duration-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-purple-500/50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700/60 hover:shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Enrolled Students
              </span>
              <div className="p-2 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400">
                {enrolledStudentsCount}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">actual enrolled</span>
            </div>
          </button>

          {/* Card 3: Fully Assigned */}
          <button
            type="button"
            onClick={() => handleCardClick('assigned')}
            aria-pressed={cardFilter === 'assigned'}
            className={`p-5 sm:p-6 rounded-2xl min-h-[118px] flex flex-col justify-between text-left transition-all duration-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 ${
              cardFilter === 'assigned'
                ? 'bg-emerald-50/40 dark:bg-emerald-950/30 border-2 border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700/60 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Fully Assigned
              </span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {assignedGroupsCount}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">active curriculum</span>
            </div>
          </button>

          {/* Card 4: Not Assigned */}
          <button
            type="button"
            onClick={() => handleCardClick('not_assigned')}
            aria-pressed={cardFilter === 'not_assigned'}
            className={`p-5 sm:p-6 rounded-2xl min-h-[118px] flex flex-col justify-between text-left transition-all duration-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 ${
              cardFilter === 'not_assigned'
                ? 'bg-amber-50/40 dark:bg-amber-950/30 border-2 border-amber-500 dark:border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/40 hover:border-amber-400 dark:hover:border-amber-700/60 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Not Assigned
              </span>
              <div className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-700 dark:text-amber-400">
                {notAssignedGroupsCount}
              </span>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">pending assignment</span>
            </div>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar: 1. Search (with integrated reset icon) -> 2. All Years -> 3. All Departments */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between transition-colors">
        {/* 1. Search Field - visually wider than both dropdowns with left Search icon and right Reset button */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search departments, sections, or programs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-10 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm transition-colors"
            aria-label="Search departments, sections, or programs"
          />
          <button
            type="button"
            onClick={handleResetAllFilters}
            title="Reset filters"
            aria-label="Reset filters"
            className="absolute right-2.5 top-2 p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* 2. All Years Dropdown - exactly equal width to All Departments */}
        <div className="w-full md:w-60 lg:w-64 shrink-0">
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="w-full h-10 px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            aria-label="Filter by Academic Year"
          >
            <option value="all">All Years</option>
            {ACADEMIC_YEAR_OPTIONS.map(yr => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>

        {/* 3. All Departments Dropdown - exactly equal width to All Years */}
        <div className="w-full md:w-60 lg:w-64 shrink-0">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="w-full h-10 px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            aria-label="Filter by Department"
          >
            <option value="all">All Departments</option>
            {uniqueDepartments.map(d => (
              <option key={d._id || d.name} value={d.name}>
                {d.code ? `${d.code} — ${d.name}` : d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ACADEMIC YEAR HIERARCHY */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Loading academic hierarchy, departments, and section assignments...
          </p>
        </div>
      ) : displayedHierarchy.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
          <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            No Departments or Sections Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-4">
            No departments or sections match the selected academic year, department, and search criteria.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setYearFilter('all');
              setDepartmentFilter('all');
              setCardFilter('all');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {displayedHierarchy.map((yearGroup, yearIndex) => {
            const hasDepts = yearGroup.departments.length > 0;

            return (
              <section
                key={yearGroup.id}
                className="bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 transition-colors duration-200"
              >
                {/* Academic Year Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                      {yearIndex + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                          {yearGroup.label}
                        </h2>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {yearGroup.departmentCount} {yearGroup.departmentCount === 1 ? 'Department' : 'Departments'}
                        </span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                          {yearGroup.totalSections} {yearGroup.totalSections === 1 ? 'Section' : 'Sections'}
                        </span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                          {yearGroup.totalStudents} {yearGroup.totalStudents === 1 ? 'Student' : 'Students'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Add Department Action (Task 4) */}
                  <button
                    type="button"
                    onClick={() => handleOpenAddDepartment(yearGroup.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Department</span>
                  </button>
                </div>

                {/* Task 3: Department Cards with Inner Section Cards */}
                <div className="mt-6 space-y-6">
                  {!hasDepts ? (
                    <div className="p-8 sm:p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                      <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        No Departments Configured for {yearGroup.label}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                        {searchTerm || cardFilter !== 'all' || departmentFilter !== 'all' || yearFilter !== 'all'
                          ? 'No configured departments in this academic year match your active filter criteria.'
                          : `Configure departments and their initial sections for ${yearGroup.label} to establish the academic structure.`}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleOpenAddDepartment(yearGroup.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Department to {yearGroup.label}</span>
                      </button>
                    </div>
                  ) : (
                    yearGroup.departments.map(deptCard => (
                      <div
                        key={deptCard.deptKey}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all p-6 sm:p-7"
                      >
                        {/* Department Card Header */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-start gap-3">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0 mt-0.5">
                              <Building2 className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                  {deptCard.displayName}
                                </h3>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
                                  {deptCard.course}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                                {deptCard.academicYear && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Calendar: {deptCard.academicYear}</span>
                                  </span>
                                )}
                                {deptCard.semesters.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                                    <span>
                                      Semesters: {deptCard.semesters.map(s => `Sem ${s}`).join(', ')}
                                    </span>
                                  </span>
                                )}
                                <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
                                  <Users className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{deptCard.totalStudents} enrolled students</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Department Card Actions: Section count, Add Section, and Delete Department */}
                          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {deptCard.sectionCount} {deptCard.sectionCount === 1 ? 'Section' : 'Sections'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenAddSection(deptCard)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Section</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePromptDeleteDepartment(deptCard)}
                              title={`Delete ${deptCard.displayName}`}
                              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-900/40 rounded-xl transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Task 3 Critical Requirement: INNER SECTION CARDS GRID */}
                        <div className="mt-5">
                          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3.5">
                            Configured Sections ({deptCard.sections.length})
                          </span>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                            {deptCard.sections.map(section => {
                              const metrics = calculateAssignmentMetrics(section.assignments);
                              const subjectsCount = section.subjectsCount !== undefined ? section.subjectsCount : metrics.subjectsCount;
                              const teachersCount = section.teachersCount !== undefined ? section.teachersCount : metrics.teachersCount;
                              const status = section.status || metrics.status;
                              const isAssigned = status === 'Assigned';

                              return (
                                <div
                                  key={section._id}
                                  className="section-card-glow p-4 sm:p-5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700/60 shadow-xs hover:shadow-sm transition-all duration-150 flex flex-col justify-between"
                                >
                                  {/* Section Card Top */}
                                  <div>
                                    {/* 1. Section Header: Name, Status Badge, Three-Dot Menu */}
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
                                          Section {section.section}
                                        </h4>
                                        {isAssigned ? (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/50 shrink-0">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                            <span>Assigned</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-900/40 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/50 shrink-0">
                                            <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                                            <span>Not Assigned</span>
                                          </span>
                                        )}
                                      </div>

                                      {/* Three-Dot Action Menu */}
                                      <div className="relative shrink-0" data-section-menu="true">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveDropdownSectionId(prev => prev === section._id ? null : section._id);
                                          }}
                                          aria-expanded={activeDropdownSectionId === section._id}
                                          aria-label={`Actions for Section ${section.section}`}
                                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                        >
                                          <MoreVertical className="w-4 h-4" />
                                        </button>

                                        {activeDropdownSectionId === section._id && (
                                          <div
                                            role="menu"
                                            className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100"
                                          >
                                            <button
                                              type="button"
                                              role="menuitem"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveDropdownSectionId(null);
                                                handleOpenEditSection(section, deptCard);
                                              }}
                                              className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer text-left"
                                            >
                                              <Pencil className="w-3.5 h-3.5 text-indigo-500" />
                                              <span>Edit Section</span>
                                            </button>
                                            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                                            <button
                                              type="button"
                                              role="menuitem"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveDropdownSectionId(null);
                                                handlePromptDeleteSection(section, deptCard);
                                              }}
                                              className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer text-left"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                              <span>Delete Section</span>
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* 2. Three Clickable Statistics: Students, Subjects, Teachers */}
                                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 dark:border-slate-800">
                                      {/* Students */}
                                      <button
                                        type="button"
                                        onClick={() => handleOpenSectionStudents(section, 'students')}
                                        title={`View ${section.studentCount || 0} enrolled students in Section ${section.section}`}
                                        className="p-2 sm:p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-300 dark:hover:border-purple-700/60 transition-all text-center group cursor-pointer"
                                      >
                                        <div className="p-1 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 w-fit mx-auto mb-1 group-hover:scale-110 transition-transform">
                                          <Users className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                          Students
                                        </span>
                                        <span className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                          {section.studentCount || 0}
                                        </span>
                                      </button>

                                      {/* Subjects */}
                                      <button
                                        type="button"
                                        onClick={() => handleOpenSectionStudents(section, 'subjects')}
                                        title={`View ${subjectsCount} assigned subjects for Section ${section.section}`}
                                        className="p-2 sm:p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-700/60 transition-all text-center group cursor-pointer"
                                      >
                                        <div className="p-1 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 w-fit mx-auto mb-1 group-hover:scale-110 transition-transform">
                                          <BookOpen className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                          Subjects
                                        </span>
                                        <span className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                          {subjectsCount}
                                        </span>
                                      </button>

                                      {/* Teachers */}
                                      <button
                                        type="button"
                                        onClick={() => handleOpenSectionStudents(section, 'teachers')}
                                        title={`View ${teachersCount} assigned teachers for Section ${section.section}`}
                                        className="p-2 sm:p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:border-teal-300 dark:hover:border-teal-700/60 transition-all text-center group cursor-pointer"
                                      >
                                        <div className="p-1 rounded-md bg-teal-100 dark:bg-teal-900/60 text-teal-600 dark:text-teal-300 w-fit mx-auto mb-1 group-hover:scale-110 transition-transform">
                                          <GraduationCap className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                          Teachers
                                        </span>
                                        <span className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                                          {teachersCount}
                                        </span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* 3 & 4. Section Card Action Buttons */}
                                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenSectionStudents(section, 'overview')}
                                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-indigo-500" />
                                      <span>View Details</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => openGroupModal(section)}
                                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                                    >
                                      <SlidersHorizontal className="w-3.5 h-3.5" />
                                      <span>Manage Assignments</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Add Section Action Tile inside the Grid */}
                            <button
                              type="button"
                              onClick={() => handleOpenAddSection(deptCard)}
                              className="p-5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/40 dark:bg-slate-800/20 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-all flex flex-col items-center justify-center text-center gap-2 cursor-pointer min-h-[160px] group"
                            >
                              <div className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/60 group-hover:text-indigo-600 transition-colors">
                                <Plus className="w-5 h-5" />
                              </div>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                Add Section
                              </span>
                              <span className="text-[11px] text-slate-400">
                                Create another section for {deptCard.departmentCode}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: SECTION DETAILS VIEW (Tasks 3, 4, 5)                  */}
      {/* ============================================================== */}
      {viewingSectionStudents && viewingSectionStudents.isOpen && (() => {
        const sectionDeptInfo = getDeptInfo(viewingSectionStudents.section.department);
        const enrolledCount = viewingSectionStudents.students?.length || 0;
        const assignmentList = viewingSectionStudents.assignments || [];
        const assignmentCount = assignmentList.length;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden transition-colors">
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                    Section Details — Section {viewingSectionStudents.section.section}
                  </h2>
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      Department: <strong className="font-semibold text-slate-700 dark:text-slate-300">{viewingSectionStudents.section.department}</strong>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span>
                      Academic Year: <strong className="font-semibold text-slate-700 dark:text-slate-300">{viewingSectionStudents.section.academicYear}</strong>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span>
                      Semester: <strong className="font-semibold text-slate-700 dark:text-slate-300">Sem {viewingSectionStudents.section.semester}</strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseSectionStudents}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Navigation Tabs */}
              {(() => {
                const currentTab = viewingSectionStudents.activeTab || 'overview';
                const sCount = modalDistinctSubjects.length;
                const tCount = modalDistinctTeachers.length;

                return (
                  <div className="px-5 sm:px-6 border-b border-slate-200 dark:border-slate-800 flex gap-2 sm:gap-4 text-xs font-semibold overflow-x-auto bg-slate-50/50 dark:bg-slate-800/20 shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewingSectionStudents(prev => ({ ...prev, activeTab: 'overview' }))}
                      className={`py-3 px-1 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        currentTab === 'overview'
                          ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Overview</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewingSectionStudents(prev => ({ ...prev, activeTab: 'students' }))}
                      className={`py-3 px-1 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        currentTab === 'students'
                          ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 text-purple-500" />
                      <span>Students</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-bold">
                        {enrolledCount}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewingSectionStudents(prev => ({ ...prev, activeTab: 'subjects' }))}
                      className={`py-3 px-1 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        currentTab === 'subjects'
                          ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Subjects</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                        {sCount}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewingSectionStudents(prev => ({ ...prev, activeTab: 'teachers' }))}
                      className={`py-3 px-1 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        currentTab === 'teachers'
                          ? 'border-teal-600 text-teal-600 dark:text-teal-400 font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      <GraduationCap className="w-3.5 h-3.5 text-teal-500" />
                      <span>Teachers</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 text-[10px] font-bold">
                        {tCount}
                      </span>
                    </button>
                  </div>
                );
              })()}

              {/* Scrollable Content Body */}
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
                {sectionStudentsLoading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-9 h-9 animate-spin text-indigo-600 mb-3" />
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading section details, assignments, and student roster...</p>
                  </div>
                ) : (() => {
                  const currentTab = viewingSectionStudents.activeTab || 'overview';
                  const secStatus = viewingSectionStudents.status || (viewingSectionStudents.section?.status) || 'Not Assigned';
                  const isSecAssigned = secStatus === 'Assigned';
                  const sCount = modalDistinctSubjects.length;
                  const tCount = modalDistinctTeachers.length;

                  return (
                    <>
                      {/* ======================================================== */}
                      {/* TAB 1: OVERVIEW TAB                                      */}
                      {/* ======================================================== */}
                      {currentTab === 'overview' && (
                        <div className="space-y-6">
                          {/* Top 4 Summary Cards */}
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            {/* Card 1: Enrolled Students */}
                            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between shadow-2xs">
                              <div>
                                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 block mb-1">
                                  Enrolled Students
                                </span>
                                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                                  {enrolledCount}
                                </span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shrink-0">
                                <Users className="w-5 h-5" />
                              </div>
                            </div>

                            {/* Card 2: Assigned Subjects */}
                            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between shadow-2xs">
                              <div>
                                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 block mb-1">
                                  Assigned Subjects
                                </span>
                                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                                  {sCount}
                                </span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                                <BookOpen className="w-5 h-5" />
                              </div>
                            </div>

                            {/* Card 3: Assigned Teachers */}
                            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between shadow-2xs">
                              <div>
                                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 block mb-1">
                                  Assigned Teachers
                                </span>
                                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                                  {tCount}
                                </span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 shrink-0">
                                <GraduationCap className="w-5 h-5" />
                              </div>
                            </div>

                            {/* Card 4: Assignment Status */}
                            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between shadow-2xs">
                              <div>
                                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 block mb-1">
                                  Assignment Status
                                </span>
                                <span className={`inline-flex items-center gap-1.5 text-sm sm:text-base font-extrabold ${
                                  isSecAssigned
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                }`}>
                                  {isSecAssigned ? (
                                    <>
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                      <span>Assigned</span>
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                                      <span>Not Assigned</span>
                                    </>
                                  )}
                                </span>
                              </div>
                              <div className={`p-2.5 rounded-xl shrink-0 ${
                                isSecAssigned
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                              }`}>
                                {isSecAssigned ? (
                                  <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                  <Clock className="w-5 h-5" />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Assigned Subjects & Teachers Section */}
                          <section aria-labelledby="overview-assignments-heading">
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                <h3 id="overview-assignments-heading" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                  Assigned Subjects & Teachers
                                </h3>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const sec = viewingSectionStudents.section;
                                  handleCloseSectionStudents();
                                  openGroupModal(sec);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Manage</span>
                              </button>
                            </div>

                            {assignmentList.length === 0 ? (
                              <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/40 dark:bg-slate-900/40">
                                <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                  No Subjects or Teachers Assigned
                                </h4>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-3">
                                  No subjects or faculty members have been allocated to Section {viewingSectionStudents.section.section} yet.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const sec = viewingSectionStudents.section;
                                    handleCloseSectionStudents();
                                    openGroupModal(sec);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                                >
                                  <SlidersHorizontal className="w-3.5 h-3.5" />
                                  <span>Configure Assignments</span>
                                </button>
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                                <table className="w-full text-left text-xs whitespace-nowrap">
                                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                      <th className="px-4 py-3 font-semibold">Subject Code</th>
                                      <th className="px-4 py-3 font-semibold">Subject Name</th>
                                      <th className="px-4 py-3 font-semibold">Assigned Teacher</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {assignmentList.map((asgn, idx) => (
                                      <tr key={asgn._id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                          {asgn.subject?.code || '—'}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                                          {asgn.subject?._id ? (
                                            <Link
                                              to={`/admin/subjects/${asgn.subject._id}`}
                                              className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors font-medium"
                                              title="View subject details"
                                            >
                                              {asgn.subject.name || 'Unnamed Subject'}
                                            </Link>
                                          ) : (
                                            <span>{asgn.subject?.name || '—'}</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                          {asgn.teacher?._id ? (
                                            <Link
                                              to={`/admin/teachers/${asgn.teacher._id}`}
                                              className="text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 hover:underline transition-colors font-medium inline-flex items-center gap-1"
                                              title="View teacher profile"
                                            >
                                              <span>{asgn.teacher?.user?.name || asgn.teacher?.personalInfo?.name || asgn.teacher?.name || asgn.teacher?.teacherId || 'Teacher'}</span>
                                            </Link>
                                          ) : (
                                            <span className="text-slate-400 dark:text-slate-500 italic">
                                              {asgn.teacher?.user?.name || asgn.teacher?.personalInfo?.name || asgn.teacher?.name || 'Unassigned'}
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </section>
                        </div>
                      )}

                      {/* ======================================================== */}
                      {/* TAB 2: STUDENTS TAB (Clicking Students on Card)          */}
                      {/* ======================================================== */}
                      {currentTab === 'students' && (
                        <section aria-labelledby="section-students-heading" className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                <h3 id="section-students-heading" className="text-base font-bold text-slate-900 dark:text-slate-100">
                                  Enrolled Students in Section {viewingSectionStudents.section.section} ({enrolledCount})
                                </h3>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Student roster actively enrolled in Section {viewingSectionStudents.section.section}.
                              </p>
                            </div>

                            <div className="relative w-full sm:w-72">
                              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Search by student name, ID or email..."
                                value={sectionStudentSearch}
                                onChange={(e) => setSectionStudentSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-purple-500"
                              />
                            </div>
                          </div>

                          {modalFilteredStudents.length === 0 ? (
                            <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/40 dark:bg-slate-900/40">
                              <Users className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                No Students Enrolled in Section {viewingSectionStudents.section.section}
                              </h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-3">
                                {sectionStudentSearch
                                  ? 'No enrolled students match your active search term.'
                                  : 'Students are automatically assigned to this section when registered with matching academic criteria.'}
                              </p>
                              <Link
                                to="/admin/students/create"
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Register New Student</span>
                              </Link>
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                              <table className="w-full text-left text-xs whitespace-nowrap">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                                  <tr>
                                    <th className="px-4 py-3 font-semibold">Student Name</th>
                                    <th className="px-4 py-3 font-semibold">Student ID</th>
                                    <th className="px-4 py-3 font-semibold">Email</th>
                                    <th className="px-4 py-3 font-semibold">Department</th>
                                    <th className="px-4 py-3 font-semibold">Section</th>
                                    <th className="px-4 py-3 font-semibold">Academic Year</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                  {modalFilteredStudents.map(student => (
                                    <tr key={student._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                                        <Link
                                          to={`/admin/students/${student._id}`}
                                          className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 group cursor-pointer"
                                          title="Open student profile"
                                        >
                                          <span>{student.user?.name || student.personalInfo?.name || '—'}</span>
                                          <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                                        </Link>
                                      </td>
                                      <td className="px-4 py-3 font-mono font-bold text-purple-600 dark:text-purple-400">
                                        <Link
                                          to={`/admin/students/${student._id}`}
                                          className="hover:underline"
                                          title="Open student profile"
                                        >
                                          {student.studentId}
                                        </Link>
                                      </td>
                                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                                        {student.personalInfo?.email || student.user?.email || '—'}
                                      </td>
                                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                        {student.department || viewingSectionStudents.section.department}
                                      </td>
                                      <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">
                                        Section {student.section || viewingSectionStudents.section.section}
                                      </td>
                                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                        {student.academicYear || viewingSectionStudents.section.academicYear}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                          student.user?.isActive !== false
                                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                        }`}>
                                          {student.user?.isActive !== false ? 'Active' : 'Inactive'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </section>
                      )}

                      {/* ======================================================== */}
                      {/* TAB 3: SUBJECTS TAB (Clicking Subjects on Card)          */}
                      {/* ======================================================== */}
                      {currentTab === 'subjects' && (
                        <section aria-labelledby="section-subjects-heading" className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                <h3 id="section-subjects-heading" className="text-base font-bold text-slate-900 dark:text-slate-100">
                                  Assigned Subjects in Section {viewingSectionStudents.section.section} ({modalDistinctSubjects.length})
                                </h3>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Curriculum subjects currently allocated to Section {viewingSectionStudents.section.section}.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const sec = viewingSectionStudents.section;
                                handleCloseSectionStudents();
                                openGroupModal(sec);
                              }}
                              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                              <span>Manage Assignments</span>
                            </button>
                          </div>

                          {modalDistinctSubjects.length === 0 ? (
                            <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/40 dark:bg-slate-900/40">
                              <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                No Subjects Assigned to Section {viewingSectionStudents.section.section}
                              </h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-3">
                                Assign curriculum subjects to this section to establish course coverage.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  const sec = viewingSectionStudents.section;
                                  handleCloseSectionStudents();
                                  openGroupModal(sec);
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Configure Assignments</span>
                              </button>
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                              <table className="w-full text-left text-xs whitespace-nowrap">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                                  <tr>
                                    <th className="px-4 py-3 font-semibold">Subject Name</th>
                                    <th className="px-4 py-3 font-semibold">Subject Code</th>
                                    <th className="px-4 py-3 font-semibold">Subject Type</th>
                                    <th className="px-4 py-3 font-semibold">Credits</th>
                                    <th className="px-4 py-3 font-semibold">Assigned Teacher</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="px-4 py-3 font-semibold text-right">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                  {modalDistinctSubjects.map(sub => (
                                    <tr key={sub._id || sub.code} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                                        {sub._id ? (
                                          <Link
                                            to={`/admin/subjects/${sub._id}`}
                                            className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors inline-flex items-center gap-1 group"
                                            title="View subject details"
                                          >
                                            <span>{sub.name}</span>
                                            <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                                          </Link>
                                        ) : (
                                          <span>{sub.name}</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                        {sub.code}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                                          {sub.subjectType}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                                        {sub.credits}
                                      </td>
                                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                        {sub.teacherName}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                          sub.status === 'Active'
                                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                        }`}>
                                          {sub.status}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const sec = viewingSectionStudents.section;
                                            handleCloseSectionStudents();
                                            openGroupModal(sec);
                                          }}
                                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer"
                                          title="Manage assignment details"
                                        >
                                          <span>Manage</span>
                                          <ExternalLink className="w-3 h-3" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </section>
                      )}

                      {/* ======================================================== */}
                      {/* TAB 4: TEACHERS TAB (Clicking Teachers on Card)          */}
                      {/* ======================================================== */}
                      {currentTab === 'teachers' && (
                        <section aria-labelledby="section-teachers-heading" className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <GraduationCap className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                                <h3 id="section-teachers-heading" className="text-base font-bold text-slate-900 dark:text-slate-100">
                                  Assigned Teachers in Section {viewingSectionStudents.section.section} ({modalDistinctTeachers.length})
                                </h3>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Faculty members actively teaching subjects in Section {viewingSectionStudents.section.section}.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const sec = viewingSectionStudents.section;
                                handleCloseSectionStudents();
                                openGroupModal(sec);
                              }}
                              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                              <span>Manage Assignments</span>
                            </button>
                          </div>

                          {modalDistinctTeachers.length === 0 ? (
                            <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/40 dark:bg-slate-900/40">
                              <GraduationCap className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                No Teachers Assigned to Section {viewingSectionStudents.section.section}
                              </h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-3">
                                Allocate faculty to subjects in Section {viewingSectionStudents.section.section} to complete teaching assignments.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  const sec = viewingSectionStudents.section;
                                  handleCloseSectionStudents();
                                  openGroupModal(sec);
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Assign Teachers</span>
                              </button>
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                              <table className="w-full text-left text-xs whitespace-nowrap">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                                  <tr>
                                    <th className="px-4 py-3 font-semibold">Teacher Name</th>
                                    <th className="px-4 py-3 font-semibold">Faculty ID</th>
                                    <th className="px-4 py-3 font-semibold">Designation</th>
                                    <th className="px-4 py-3 font-semibold">Assigned Subject(s)</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="px-4 py-3 font-semibold text-right">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                  {modalDistinctTeachers.map(tch => (
                                    <tr key={tch._id || tch.teacherId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                                        {tch._id ? (
                                          <Link
                                            to={`/admin/teachers/${tch._id}`}
                                            className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors inline-flex items-center gap-1 group cursor-pointer"
                                            title="Open teacher profile"
                                          >
                                            <span>{tch.name}</span>
                                            <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400" />
                                          </Link>
                                        ) : (
                                          <span>{tch.name}</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 font-mono font-bold text-teal-600 dark:text-teal-400">
                                        {tch.teacherId}
                                      </td>
                                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                                        {tch.designation}
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1 max-w-xs">
                                          {tch.subjects.map((sub, sIdx) => (
                                            <span
                                              key={sIdx}
                                              className="inline-block px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 text-[11px] font-medium border border-teal-200/60 dark:border-teal-800/40"
                                            >
                                              {sub}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                          tch.status === 'Active'
                                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                        }`}>
                                          {tch.status}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const sec = viewingSectionStudents.section;
                                            handleCloseSectionStudents();
                                            openGroupModal(sec);
                                          }}
                                          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 cursor-pointer"
                                          title="Manage assignments"
                                        >
                                          <span>Manage</span>
                                          <ExternalLink className="w-3 h-3" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </section>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* MODAL: DELETE DEPARTMENT CONFIRMATION (Task 1)                 */}
      {/* ============================================================== */}
      {deleteDeptModal.isOpen && deleteDeptModal.deptCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 overflow-hidden transition-colors">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-xl shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Delete Department
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Are you sure you want to delete <strong className="text-slate-800 dark:text-slate-200">{deleteDeptModal.deptCard.displayName}</strong>?
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Department Name:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{deleteDeptModal.deptCard.departmentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Program / Year:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{deleteDeptModal.deptCard.course} - {deleteDeptModal.deptCard.yearOfStudy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Configured Sections:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{deleteDeptModal.deptCard.sectionCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Enrolled Students:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{deleteDeptModal.deptCard.totalStudents}</span>
              </div>
            </div>

            {deleteDeptModal.deptCard.totalStudents > 0 && (
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  This department currently has <strong>{deleteDeptModal.deptCard.totalStudents} enrolled student(s)</strong>. Deletion will be rejected by backend dependency checks to prevent data loss.
                </span>
              </div>
            )}

            {deleteDeptModal.error && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{deleteDeptModal.error}</span>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteDeptModal({ isOpen: false, deptCard: null, loading: false, error: '' })}
                disabled={deleteDeptModal.loading}
                className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDepartment}
                disabled={deleteDeptModal.loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleteDeptModal.loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Department</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: DELETE SECTION CONFIRMATION (Task 1)                    */}
      {/* ============================================================== */}
      {deleteSectionModal.isOpen && deleteSectionModal.section && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 overflow-hidden transition-colors">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-xl shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Delete Section
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Are you sure you want to delete <strong className="text-slate-800 dark:text-slate-200">Section {deleteSectionModal.section.section}</strong>?
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Section Name:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">Section {deleteSectionModal.section.section}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Department:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{deleteSectionModal.section.department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Academic Year:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{deleteSectionModal.section.academicYear}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Semester:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">Sem {deleteSectionModal.section.semester}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Enrolled Students:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{deleteSectionModal.section.studentCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Subject Assignments:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{deleteSectionModal.section.subjectsCount !== undefined ? deleteSectionModal.section.subjectsCount : (deleteSectionModal.section.assignmentCount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Teacher Assignments:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{deleteSectionModal.section.teachersCount !== undefined ? deleteSectionModal.section.teachersCount : 0}</span>
              </div>
            </div>

            {(() => {
              const studentCount = deleteSectionModal.section.studentCount || 0;
              const assignmentCount = deleteSectionModal.section.assignmentCount || deleteSectionModal.section.subjectsCount || 0;
              const hasDeps = studentCount > 0 || assignmentCount > 0;

              if (!hasDeps) return null;

              return (
                <div className="mt-3 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <span className="leading-relaxed">
                    This section contains enrolled students or academic assignments. Deleting it may affect student enrollments, assignments, and related academic records. This action cannot be undone.
                  </span>
                </div>
              );
            })()}

            {deleteSectionModal.error && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{deleteSectionModal.error}</span>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteSectionModal({ isOpen: false, section: null, deptCard: null, loading: false, error: '' })}
                disabled={deleteSectionModal.loading}
                className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSection}
                disabled={deleteSectionModal.loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleteSectionModal.loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {((deleteSectionModal.section.studentCount || 0) > 0 || (deleteSectionModal.section.assignmentCount || 0) > 0 || (deleteSectionModal.section.subjectsCount || 0) > 0)
                    ? 'Confirm & Delete'
                    : 'Delete Section'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDIT SECTION MODAL                                      */}
      {/* ============================================================== */}
      {editSectionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden transition-colors">
            
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
                      {editSectionModal.course}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      Sem {editSectionModal.semester}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      ({editSectionModal.academicYear})
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100">
                    Edit Section {editSectionModal.sectionName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Update section identity, academic parameters, status, and inspect connected curriculum & enrollments.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseEditSection}
                disabled={editSectionModal.saving}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Cancel and close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Bar */}
            {(() => {
              const isAssigned = editSectionModal.status === 'Assigned';
              return (
                <div className="grid grid-cols-4 gap-2 px-6 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Students</span>
                      <strong className="text-slate-800 dark:text-slate-200 font-bold">
                        {editSectionModal.studentCount} Enrolled
                      </strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-500" />
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Subjects</span>
                      <strong className="text-slate-800 dark:text-slate-200 font-bold">
                        {editSectionModal.subjectsCount || 0}
                      </strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-teal-500" />
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Teachers</span>
                      <strong className="text-slate-800 dark:text-slate-200 font-bold">
                        {editSectionModal.teachersCount || 0}
                      </strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAssigned ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-500" />
                    )}
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Status</span>
                      <span className={`font-semibold ${
                        isAssigned
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {isAssigned ? 'Assigned' : 'Not Assigned'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Navigation Tabs */}
            <div className="px-6 border-b border-slate-200 dark:border-slate-800 flex gap-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setEditSectionModal(prev => ({ ...prev, activeTab: 'details' }))}
                className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                  editSectionModal.activeTab === 'details'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <span>Section Information</span>
              </button>

              <button
                type="button"
                onClick={() => setEditSectionModal(prev => ({ ...prev, activeTab: 'assignments' }))}
                className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                  editSectionModal.activeTab === 'assignments'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Assigned Subjects & Teachers</span>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px]">
                  {editSectionModal.assignmentCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setEditSectionModal(prev => ({ ...prev, activeTab: 'students' }))}
                className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                  editSectionModal.activeTab === 'students'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Student Enrollments</span>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px]">
                  {editSectionModal.studentCount}
                </span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Errors & Alerts */}
              {editSectionModal.error && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editSectionModal.error}</span>
                </div>
              )}

              {/* Move Confirmation Warning Modal / Banner */}
              {editSectionModal.showMoveConfirm && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 rounded-xl text-xs space-y-3">
                  <div className="flex items-start gap-2.5 text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-amber-900 dark:text-amber-100">
                        Confirm Section Reallocation
                      </h4>
                      <p className="mt-1 leading-relaxed">
                        You are changing the <strong>Department, Academic Year, or Semester</strong> for this section.
                      </p>
                      <div className="mt-2 p-2.5 bg-white/70 dark:bg-slate-900/60 rounded-lg border border-amber-200 dark:border-amber-800/50 space-y-1 font-mono text-[11px]">
                        <div>
                          <span className="text-slate-500 font-sans">Current: </span>
                          <strong>{editSectionModal.initialValues?.department}</strong> • {editSectionModal.initialValues?.course} (Sem {editSectionModal.initialValues?.semester}, {editSectionModal.initialValues?.academicYear})
                        </div>
                        <div className="text-indigo-600 dark:text-indigo-400">
                          <span className="text-slate-500 font-sans">New: </span>
                          <strong>{editSectionModal.department === 'Other' ? editSectionModal.customDepartment : editSectionModal.department}</strong> • {editSectionModal.course} (Sem {editSectionModal.semester}, {editSectionModal.academicYear})
                        </div>
                      </div>
                      <p className="mt-2">
                        This change will automatically synchronize <strong>{editSectionModal.studentCount} enrolled student profile(s)</strong> and <strong>{editSectionModal.assignmentCount} subject/teacher assignment(s)</strong> to the new academic term.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-amber-200 dark:border-amber-800/60 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditSectionModal(prev => ({ ...prev, showMoveConfirm: false }))}
                      className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-xs hover:bg-slate-50"
                    >
                      Cancel Move
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEditSection(true)}
                      disabled={editSectionModal.saving}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs shadow-xs"
                    >
                      {editSectionModal.saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Confirm & Update Section</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 1: Section Details */}
              {editSectionModal.activeTab === 'details' && (
                <div className="space-y-4">
                  {/* Grid: Section Name and Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Section Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Section Identifier / Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editSectionModal.sectionName}
                        onChange={(e) => setEditSectionModal(prev => ({ ...prev, sectionName: e.target.value }))}
                        placeholder="e.g. A, B, C, or 1, 2"
                        className={`w-full px-3 py-2 border rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 ${
                          editSectionModal.errors?.sectionName || editSectionModal.errors?.section
                            ? 'border-rose-500'
                            : 'border-slate-300 dark:border-slate-700'
                        }`}
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Identifier for this section (e.g. "A" displays as "Section A").
                      </p>
                    </div>

                    {/* Section Status */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Section Status <span className="text-rose-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setEditSectionModal(prev => ({ ...prev, isActive: true }))}
                          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                            editSectionModal.isActive
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Active</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditSectionModal(prev => ({ ...prev, isActive: false }))}
                          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                            !editSectionModal.isActive
                              ? 'bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-600 text-slate-800 dark:text-slate-200 ring-1 ring-slate-500/20'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          <span>Inactive</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Inactive sections are archived from active enrollment choices.
                      </p>
                    </div>
                  </div>

                  {/* Department Dropdown */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Department <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={editSectionModal.department}
                      onChange={(e) => setEditSectionModal(prev => ({ ...prev, department: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 ${
                        editSectionModal.errors?.department ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {departments.filter(d => d && (d.name || d._id)).map(d => (
                        <option key={d._id || d.name} value={d.name}>
                          {d.code ? `${d.code} — ${d.name}` : d.name}
                        </option>
                      ))}
                      <option value="Other">Other (Custom Department)</option>
                    </select>

                    {editSectionModal.department === 'Other' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          placeholder="Enter custom department name"
                          value={editSectionModal.customDepartment}
                          onChange={(e) => setEditSectionModal(prev => ({ ...prev, customDepartment: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Academic Year & Course */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Academic Year Dropdown */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Academic Calendar Year <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={editSectionModal.academicYear}
                        onChange={(e) => setEditSectionModal(prev => ({ ...prev, academicYear: e.target.value }))}
                        className={`w-full px-3 py-2 border rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 ${
                          editSectionModal.errors?.academicYear ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {academicYears.length > 0 ? (
                          academicYears.map(ay => (
                            <option key={ay._id || ay.year} value={ay.year}>
                              {ay.year} {ay.isActive ? '(Current Active)' : ''}
                            </option>
                          ))
                        ) : (
                          <option value="2026-2027">2026-2027</option>
                        )}
                        {/* Fallback if current value not in configured list */}
                        {editSectionModal.academicYear && !academicYears.some(ay => ay.year === editSectionModal.academicYear) && (
                          <option value={editSectionModal.academicYear}>{editSectionModal.academicYear}</option>
                        )}
                      </select>
                    </div>

                    {/* Course / Program */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Course / Program <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={editSectionModal.course}
                        onChange={(e) => setEditSectionModal(prev => ({ ...prev, course: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="B.Tech">B.Tech</option>
                        <option value="M.Tech">M.Tech</option>
                        <option value="BCA">BCA</option>
                        <option value="MCA">MCA</option>
                        <option value="B.Sc.">B.Sc.</option>
                        <option value="M.Sc.">M.Sc.</option>
                      </select>
                    </div>
                  </div>

                  {/* Semester & Year of Study */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Semester Dropdown */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Semester <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={editSectionModal.semester}
                        onChange={(e) => {
                          const newSem = e.target.value;
                          let derivedYear = editSectionModal.yearOfStudy;
                          if (newSem === '1st' || newSem === '2nd') derivedYear = 'First Year';
                          else if (newSem === '3rd' || newSem === '4th') derivedYear = 'Second Year';
                          else if (newSem === '5th' || newSem === '6th') derivedYear = 'Third Year';
                          else if (newSem === '7th' || newSem === '8th') derivedYear = 'Fourth Year';
                          setEditSectionModal(prev => ({ ...prev, semester: newSem, yearOfStudy: derivedYear }));
                        }}
                        className={`w-full px-3 py-2 border rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 ${
                          editSectionModal.errors?.semester ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <option value="1st">1st Semester (Year 1)</option>
                        <option value="2nd">2nd Semester (Year 1)</option>
                        <option value="3rd">3rd Semester (Year 2)</option>
                        <option value="4th">4th Semester (Year 2)</option>
                        <option value="5th">5th Semester (Year 3)</option>
                        <option value="6th">6th Semester (Year 3)</option>
                        <option value="7th">7th Semester (Year 4)</option>
                        <option value="8th">8th Semester (Year 4)</option>
                      </select>
                    </div>

                    {/* Academic Year of Study */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Year of Study
                      </label>
                      <select
                        value={editSectionModal.yearOfStudy}
                        onChange={(e) => setEditSectionModal(prev => ({ ...prev, yearOfStudy: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="First Year">First Year</option>
                        <option value="Second Year">Second Year</option>
                        <option value="Third Year">Third Year</option>
                        <option value="Fourth Year">Fourth Year</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Assigned Subjects & Teachers */}
              {editSectionModal.activeTab === 'assignments' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Curriculum Mapping ({editSectionModal.assignmentCount} assigned)
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Assigned subjects and faculty for Section {editSectionModal.sectionName}.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const sec = editSectionModal.section;
                        handleCloseEditSection();
                        openGroupModal(sec);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Manage Assignments in Editor</span>
                    </button>
                  </div>

                  {editSectionModal.assignments && editSectionModal.assignments.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-3.5 py-2.5 font-semibold">Code</th>
                            <th className="px-3.5 py-2.5 font-semibold">Subject</th>
                            <th className="px-3.5 py-2.5 font-semibold">Assigned Teacher</th>
                            <th className="px-3.5 py-2.5 font-semibold">Credits</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {editSectionModal.assignments.map((asgn, i) => (
                            <tr key={asgn._id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="px-3.5 py-2 font-mono font-bold text-slate-900 dark:text-slate-100">
                                {asgn.subject?.code || '—'}
                              </td>
                              <td className="px-3.5 py-2 text-slate-800 dark:text-slate-200 font-medium">
                                {asgn.subject?.name || '—'}
                              </td>
                              <td className="px-3.5 py-2 text-slate-600 dark:text-slate-400">
                                {asgn.teacher?.user?.name || asgn.teacher?.personalInfo?.name || asgn.teacher?.teacherId || 'Assigned'}
                              </td>
                              <td className="px-3.5 py-2 text-slate-500 dark:text-slate-400">
                                {asgn.subject?.credits || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      <Clock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">No subjects assigned yet</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-3">
                        Launch the assignment editor to map courses and assign teachers to this section.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const sec = editSectionModal.section;
                          handleCloseEditSection();
                          openGroupModal(sec);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Open Assignment Editor</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Student Enrollments */}
              {editSectionModal.activeTab === 'students' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Enrolled Students ({editSectionModal.studentCount})
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Calculated directly from student records in database. Non-arbitrary.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const sec = editSectionModal.section;
                        handleCloseEditSection();
                        handleOpenSectionStudents(sec);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>View Full Student Roster</span>
                    </button>
                  </div>

                  {editSectionModal.students && editSectionModal.students.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                          <tr>
                            <th className="px-3.5 py-2.5 font-semibold">Student ID</th>
                            <th className="px-3.5 py-2.5 font-semibold">Name</th>
                            <th className="px-3.5 py-2.5 font-semibold">Email</th>
                            <th className="px-3.5 py-2.5 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {editSectionModal.students.map((stu) => (
                            <tr key={stu._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="px-3.5 py-2 font-mono font-medium text-slate-900 dark:text-slate-100">
                                {stu.studentId}
                              </td>
                              <td className="px-3.5 py-2 text-slate-800 dark:text-slate-200">
                                {stu.user?.name || stu.personalInfo?.name || '—'}
                              </td>
                              <td className="px-3.5 py-2 text-slate-500 dark:text-slate-400">
                                {stu.personalInfo?.email || stu.user?.email || '—'}
                              </td>
                              <td className="px-3.5 py-2">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  stu.user?.isActive !== false
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                }`}>
                                  {stu.user?.isActive !== false ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-500 dark:text-slate-400">
                      No students are currently enrolled in Section {editSectionModal.sectionName}.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                {editSectionModal.sectionId ? `ID: ${editSectionModal.sectionId}` : ''}
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseEditSection}
                  disabled={editSectionModal.saving}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEditSection(false)}
                  disabled={editSectionModal.saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {editSectionModal.saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: ADD DEPARTMENT (Task 4)                              */}
      {/* ============================================================== */}
      {addDeptModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden transition-colors">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Add Department to {addDeptModal.yearOfStudy}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure a department and its initial section for this academic year of study.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddDeptModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="p-6 space-y-4">
              {deptFormError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{deptFormError}</span>
                </div>
              )}

              {/* Academic Year of Study (Pre-selected) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Academic Year of Study
                </label>
                <input
                  type="text"
                  value={addDeptModal.yearOfStudy}
                  disabled
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium cursor-not-allowed"
                />
              </div>

              {/* Department Dropdown / Custom */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Department <span className="text-rose-500">*</span>
                </label>
                <select
                  value={addDeptModal.department}
                  onChange={(e) => setAddDeptModal(prev => ({ ...prev, department: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                >
                  {departments.filter(d => d && (d.name || d._id)).map(d => (
                    <option key={d._id || d.name} value={d.name}>
                      {d.code ? `${d.code} — ${d.name}` : d.name}
                    </option>
                  ))}
                  <option value="Other">Other (Custom Department)</option>
                </select>

                {addDeptModal.department === 'Other' && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      placeholder="Enter custom department name"
                      value={addDeptModal.customDepartment}
                      onChange={(e) => setAddDeptModal(prev => ({ ...prev, customDepartment: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* Course / Program */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Course / Program <span className="text-rose-500">*</span>
                </label>
                <select
                  value={addDeptModal.course}
                  onChange={(e) => setAddDeptModal(prev => ({ ...prev, course: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="B.Tech">B.Tech</option>
                  <option value="M.Tech">M.Tech</option>
                  <option value="BCA">BCA</option>
                  <option value="MCA">MCA</option>
                  <option value="B.Sc.">B.Sc.</option>
                  <option value="M.Sc.">M.Sc.</option>
                </select>
              </div>

              {/* Grid: Academic Calendar & Semester */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Academic Calendar <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2026-2027"
                    value={addDeptModal.academicYear}
                    onChange={(e) => setAddDeptModal(prev => ({ ...prev, academicYear: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Semester <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={addDeptModal.semester}
                    onChange={(e) => setAddDeptModal(prev => ({ ...prev, semester: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  >
                    {addDeptModal.yearOfStudy === 'First Year' && (
                      <>
                        <option value="1st">1st Semester</option>
                        <option value="2nd">2nd Semester</option>
                      </>
                    )}
                    {addDeptModal.yearOfStudy === 'Second Year' && (
                      <>
                        <option value="3rd">3rd Semester</option>
                        <option value="4th">4th Semester</option>
                      </>
                    )}
                    {addDeptModal.yearOfStudy === 'Third Year' && (
                      <>
                        <option value="5th">5th Semester</option>
                        <option value="6th">6th Semester</option>
                      </>
                    )}
                    {addDeptModal.yearOfStudy === 'Fourth Year' && (
                      <>
                        <option value="7th">7th Semester</option>
                        <option value="8th">8th Semester</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Initial Section Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Initial Section Identifier <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. A"
                  value={addDeptModal.section}
                  onChange={(e) => setAddDeptModal(prev => ({ ...prev, section: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-bold"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Additional sections can be added anytime inside the created department card.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAddDeptModal(prev => ({ ...prev, isOpen: false }))}
                  disabled={savingDept}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDept}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {savingDept ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Department...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Create Department</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: ADD SECTION (Task 4)                                  */}
      {/* ============================================================== */}
      {addSectionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden transition-colors">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Add Section to {addSectionModal.departmentName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {addSectionModal.yearOfStudy} • {addSectionModal.course}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddSectionModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="p-6 space-y-4">
              {sectionFormError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{sectionFormError}</span>
                </div>
              )}

              {/* Semester Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Semester <span className="text-rose-500">*</span>
                </label>
                <select
                  value={addSectionModal.semester}
                  onChange={(e) => setAddSectionModal(prev => ({ ...prev, semester: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                >
                  {addSectionModal.yearOfStudy === 'First Year' && (
                    <>
                      <option value="1st">1st Semester</option>
                      <option value="2nd">2nd Semester</option>
                    </>
                  )}
                  {addSectionModal.yearOfStudy === 'Second Year' && (
                    <>
                      <option value="3rd">3rd Semester</option>
                      <option value="4th">4th Semester</option>
                    </>
                  )}
                  {addSectionModal.yearOfStudy === 'Third Year' && (
                    <>
                      <option value="5th">5th Semester</option>
                      <option value="6th">6th Semester</option>
                    </>
                  )}
                  {addSectionModal.yearOfStudy === 'Fourth Year' && (
                    <>
                      <option value="7th">7th Semester</option>
                      <option value="8th">8th Semester</option>
                    </>
                  )}
                </select>
              </div>

              {/* Section Identifier */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Section Identifier <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. B, C, D..."
                  value={addSectionModal.section}
                  onChange={(e) => setAddSectionModal(prev => ({ ...prev, section: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-bold"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Example: "B", "C", "D". Duplicate sections within the same term are rejected.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAddSectionModal(prev => ({ ...prev, isOpen: false }))}
                  disabled={savingSection}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSection}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {savingSection ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Adding Section...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Add Section</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: SAFE RECONCILIATION MODAL (Task 5)                    */}
      {/* ============================================================== */}
      {reconcileModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden transition-colors">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Reconcile Student Group Memberships
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Safe, explicit matching for students without valid section associations.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReconcileModal({ isOpen: false, loading: false, result: null })}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
                <p className="font-semibold mb-1">Safe Process Guarantee:</p>
                This operation inspects all students in this institution who are currently missing a section association. It matches them against configured sections using their Program, Department, Semester, and Section. It will <strong>never</strong> modify student marks, attendance records, credentials, or existing valid group assignments.
              </div>

              {reconcileModal.result && (
                <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                  reconcileModal.result.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200'
                }`}>
                  <p className="font-bold flex items-center gap-2">
                    {reconcileModal.result.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                    <span>{reconcileModal.result.message || reconcileModal.result.error}</span>
                  </p>

                  {reconcileModal.result.reconciledStudents && reconcileModal.result.reconciledStudents.length > 0 && (
                    <div className="pt-2">
                      <span className="font-semibold block mb-1">Reconciled Students ({reconcileModal.result.reconciledStudents.length}):</span>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {reconcileModal.result.reconciledStudents.map((s, idx) => (
                          <div key={idx} className="flex items-center justify-between font-mono text-[11px] bg-white/70 dark:bg-slate-800/60 p-1.5 rounded">
                            <span>{s.studentId} ({s.name})</span>
                            <span className="font-sans font-bold">{s.department} • Sec {s.section}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {reconcileModal.result.unmatchedStudents && reconcileModal.result.unmatchedStudents.length > 0 && (
                    <div className="pt-2">
                      <span className="font-semibold block text-amber-700 dark:text-amber-400 mb-1">
                        Unmatched Students ({reconcileModal.result.unmatchedStudents.length} - requires section configuration):
                      </span>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {reconcileModal.result.unmatchedStudents.map((s, idx) => (
                          <div key={idx} className="flex items-center justify-between font-mono text-[11px] bg-amber-100/60 dark:bg-amber-950/40 p-1.5 rounded">
                            <span>{s.studentId}</span>
                            <span className="font-sans">{s.department} Sem {s.semester} Sec {s.section}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setReconcileModal({ isOpen: false, loading: false, result: null })}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleStartReconciliation}
                disabled={reconcileModal.loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {reconcileModal.loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Reconciling Students...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Run Reconciliation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: MANAGE GROUP ASSIGNMENTS (Task 7)                    */}
      {/* ============================================================== */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden transition-colors">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  Manage Assignments — Section {selectedGroup.section}
                </h2>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Department: <strong className="font-semibold text-slate-700 dark:text-slate-300">{selectedGroup.department}</strong>
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span>
                    Academic Year: <strong className="font-semibold text-slate-700 dark:text-slate-300">{selectedGroup.academicYear}</strong>
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span>
                    Semester: <strong className="font-semibold text-slate-700 dark:text-slate-300">Sem {selectedGroup.semester}</strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={closeGroupModal}
                disabled={savingAssignments}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="px-5 sm:px-6 border-b border-slate-200 dark:border-slate-800 flex gap-4 text-xs sm:text-sm font-semibold bg-slate-50/50 dark:bg-slate-800/20 shrink-0">
              <button
                type="button"
                onClick={() => setGroupModalTab('assignments')}
                className={`py-3 px-1 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                  groupModalTab === 'assignments'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-4 h-4 text-indigo-500" />
                <span>Curriculum Mapping</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold">
                  {assignmentRows.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setGroupModalTab('students')}
                className={`py-3 px-1 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                  groupModalTab === 'students'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4 text-purple-500" />
                <span>Enrolled Students</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold">
                  {selectedGroup.students?.length || selectedGroup.studentCount || 0}
                </span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 rounded-xl text-xs sm:text-sm flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{modalError}</span>
                </div>
              )}

              {modalSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs sm:text-sm flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{modalSuccess}</span>
                </div>
              )}

              {groupLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Loading section assignments and roster...</p>
                </div>
              ) : groupModalTab === 'assignments' ? (
                <div>
                  {/* Heading & Add Assignment Button */}
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                      Subject & Teacher Assignments
                    </h3>

                    <button
                      type="button"
                      onClick={handleAddAssignmentRow}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Subject Assignment</span>
                    </button>
                  </div>

                  {assignmentRows.length === 0 ? (
                    <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl my-3 bg-slate-50/40 dark:bg-slate-900/40">
                      <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        No Assignments Added
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-3">
                        No subjects or teachers have been assigned to Section {selectedGroup.section} yet. Click below to add an assignment.
                      </p>
                      <button
                        type="button"
                        onClick={handleAddAssignmentRow}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Subject Assignment</span>
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-4 py-3 font-semibold w-[48%]">Subject</th>
                            <th className="px-4 py-3 font-semibold w-[42%]">Assigned Teacher</th>
                            <th className="px-4 py-3 font-semibold w-[10%] text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {assignmentRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                              {/* Subject Dropdown */}
                              <td className="px-4 py-2.5">
                                <select
                                  value={row.subjectId}
                                  onChange={(e) => handleRowChange(idx, 'subjectId', e.target.value)}
                                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 shadow-2xs h-10 transition-colors cursor-pointer"
                                >
                                  <option value="">-- Select Subject --</option>
                                  {eligibleSubjectsForGroup.map((sub) => (
                                    <option key={sub._id} value={sub._id}>
                                      {sub.code} — {sub.name}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Teacher Dropdown */}
                              <td className="px-4 py-2.5">
                                <select
                                  value={row.teacherId}
                                  onChange={(e) => handleRowChange(idx, 'teacherId', e.target.value)}
                                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 shadow-2xs h-10 transition-colors cursor-pointer"
                                >
                                  <option value="">-- Select Teacher (Unassigned) --</option>
                                  {eligibleTeachersForGroup.map((tch) => {
                                    const tName = tch.user?.name || tch.personalInfo?.name || tch.name || tch.teacherId;
                                    return (
                                      <option key={tch._id} value={tch._id}>
                                        {tName} — {tch.designation || 'Faculty'}
                                      </option>
                                    );
                                  })}
                                </select>
                              </td>

                              {/* Action: Delete Row */}
                              <td className="px-4 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAssignmentRow(idx)}
                                  className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer hover:scale-105 active:scale-95 inline-flex items-center justify-center"
                                  title="Remove assignment row"
                                >
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
              ) : (
                /* Tab 2: Enrolled Students */
                <div>
                  {selectedGroup.students && selectedGroup.students.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Student ID</th>
                            <th className="px-4 py-3 font-semibold">Name</th>
                            <th className="px-4 py-3 font-semibold">Email</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {selectedGroup.students.map((stu) => (
                            <tr key={stu._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="px-4 py-2.5 font-mono font-medium text-slate-900 dark:text-slate-100">
                                {stu.studentId}
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                                {stu.user?.name || stu.personalInfo?.name || '—'}
                              </td>
                              <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                                {stu.personalInfo?.email || stu.user?.email || '—'}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  stu.user?.isActive !== false
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                }`}>
                                  {stu.user?.isActive !== false ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-500 dark:text-slate-400 bg-slate-50/40 dark:bg-slate-900/40">
                      <Users className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        No Students Enrolled
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                        No students are currently enrolled in Section {selectedGroup.section}.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeGroupModal}
                disabled={savingAssignments}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {groupModalTab === 'assignments' && (
                <button
                  type="button"
                  onClick={handleSaveAssignments}
                  disabled={savingAssignments}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {savingAssignments ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Assignments...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Save Assignments</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
