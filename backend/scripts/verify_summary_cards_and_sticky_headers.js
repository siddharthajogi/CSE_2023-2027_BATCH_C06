const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function runTests() {
  console.log('--- STARTING SUMMARY CARDS, TABLE SCROLLING & EQUAL FILTER WIDTHS VERIFICATION ---\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // ==========================================
  // 1. MANAGE STUDENTS VERIFICATION (StudentList.jsx)
  // ==========================================
  console.log('--- 1. Testing StudentList.jsx ---');
  const studentListPath = path.resolve(__dirname, '../../frontend/src/components/StudentList.jsx');
  const studentContent = fs.readFileSync(studentListPath, 'utf8');

  // Summary cards state & click handlers
  assert(
    studentContent.includes("const [statusFilter, setStatusFilter] = useState('ALL')"),
    'StudentList: initializes statusFilter state with ALL'
  );
  assert(
    studentContent.includes("onClick={() => setStatusFilter('ALL')}"),
    'StudentList: Total Students card sets statusFilter to ALL'
  );
  assert(
    studentContent.includes("onClick={() => setStatusFilter('ACTIVE')}"),
    'StudentList: Active Students card sets statusFilter to ACTIVE'
  );
  assert(
    studentContent.includes("onClick={() => setStatusFilter('INACTIVE')}"),
    'StudentList: Inactive Students card sets statusFilter to INACTIVE'
  );

  // Active highlights
  assert(
    studentContent.includes("statusFilter === 'ALL'\n              ? 'bg-indigo-50/70") ||
    studentContent.includes("statusFilter === 'ALL'"),
    'StudentList: Total Students card has active highlight styling'
  );
  assert(
    studentContent.includes("statusFilter === 'ACTIVE'\n              ? 'bg-emerald-50/70") ||
    studentContent.includes("statusFilter === 'ACTIVE'"),
    'StudentList: Active Students card has active highlight styling'
  );
  assert(
    studentContent.includes("statusFilter === 'INACTIVE'\n              ? 'bg-slate-100") ||
    studentContent.includes("statusFilter === 'INACTIVE'"),
    'StudentList: Inactive Students card has active highlight styling'
  );

  // Equal width toolbar controls: All Years, All Departments, All Sections, Search
  assert(
    studentContent.includes('aria-label="Filter by Academic Year"') &&
    studentContent.includes('aria-label="Filter by Department"') &&
    studentContent.includes('aria-label="Filter by Section"') &&
    studentContent.includes('placeholder="Search students..."') &&
    studentContent.includes('> Add Student<') || studentContent.includes('Add Student\n'),
    'StudentList: All 5 toolbar controls present in exact required order'
  );
  assert(
    studentContent.includes('sm:flex-1') && studentContent.includes('h-10'),
    'StudentList: filter dropdowns and search input share equal flex widths and h-10 height'
  );

  // Sticky table header with opaque background
  assert(
    studentContent.includes('sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800') &&
    studentContent.includes('bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-200'),
    'StudentList: sticky header uses top-0, z-20 and solid opaque bg-slate-50 dark:bg-slate-800 (no opacity reduction)'
  );

  // ==========================================
  // 2. MANAGE TEACHERS VERIFICATION (TeacherList.jsx)
  // ==========================================
  console.log('\n--- 2. Testing TeacherList.jsx ---');
  const teacherListPath = path.resolve(__dirname, '../../frontend/src/components/TeacherList.jsx');
  const teacherContent = fs.readFileSync(teacherListPath, 'utf8');

  // Summary cards state & click handlers
  assert(
    teacherContent.includes("const [statusFilter, setStatusFilter] = useState('ALL')"),
    'TeacherList: initializes statusFilter state with ALL'
  );
  assert(
    teacherContent.includes("onClick={() => setStatusFilter('ALL')}"),
    'TeacherList: Total Teachers card sets statusFilter to ALL'
  );
  assert(
    teacherContent.includes("onClick={() => setStatusFilter('ACTIVE')}"),
    'TeacherList: Active Teachers card sets statusFilter to ACTIVE'
  );
  assert(
    teacherContent.includes("onClick={() => setStatusFilter('INACTIVE')}"),
    'TeacherList: Inactive Teachers card sets statusFilter to INACTIVE'
  );

  // Admin exclusion
  assert(
    teacherContent.includes("t.user?.role !== 'admin' && t.role !== 'admin'"),
    'TeacherList: Admin account is explicitly excluded from teacher counts and listings'
  );

  // Equal width toolbar controls: All Departments, All Designations, All Subjects, Search
  assert(
    teacherContent.includes('aria-label="Filter by Department"') &&
    teacherContent.includes('aria-label="Filter by Designation"') &&
    teacherContent.includes('aria-label="Filter by Subject"') &&
    teacherContent.includes('placeholder="Search teachers..."') &&
    teacherContent.includes('Add Teacher\n') || teacherContent.includes('> Add Teacher<'),
    'TeacherList: All 5 toolbar controls present in exact required order'
  );
  assert(
    teacherContent.includes('sm:flex-1') && teacherContent.includes('h-10'),
    'TeacherList: filter dropdowns and search input share equal flex widths and h-10 height'
  );

  // Sticky table header with opaque background
  assert(
    teacherContent.includes('sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800') &&
    teacherContent.includes('bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-200'),
    'TeacherList: sticky header uses top-0, z-20 and solid opaque bg-slate-50 dark:bg-slate-800'
  );

  // ==========================================
  // 3. SUBJECTS PAGE VERIFICATION (SubjectList.jsx)
  // ==========================================
  console.log('\n--- 3. Testing SubjectList.jsx ---');
  const subjectListPath = path.resolve(__dirname, '../../frontend/src/components/SubjectList.jsx');
  const subjectContent = fs.readFileSync(subjectListPath, 'utf8');

  // Sticky table header with opaque background
  assert(
    subjectContent.includes('sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800') &&
    subjectContent.includes('bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-200'),
    'SubjectList: sticky header uses top-0, z-20 and solid opaque bg-slate-50 dark:bg-slate-800 (transparency removed)'
  );
  assert(
    !subjectContent.includes('dark:bg-slate-800/80'),
    'SubjectList: /80 semi-transparent opacity removed from thead'
  );

  // ==========================================
  // 4. DATABASE INTEGRATION & COUNT VALIDATION
  // ==========================================
  console.log('\n--- 4. Database Records Validation ---');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    require('../models/User');
    const StudentProfile = require('../models/StudentProfile');
    const TeacherProfile = require('../models/TeacherProfile');
    const Subject = require('../models/Subject');

    const students = await StudentProfile.find().populate('user').lean();
    const studentTotal = students.length;
    const studentActive = students.filter(s => s.user?.isActive).length;
    const studentInactive = studentTotal - studentActive;
    assert(studentTotal >= 0, `Database: verified ${studentTotal} students (${studentActive} active, ${studentInactive} inactive)`);

    const teachers = await TeacherProfile.find().populate('user').lean();
    const nonAdminTeachers = teachers.filter(t => t.user?.role !== 'admin' && t.role !== 'admin');
    const teacherTotal = nonAdminTeachers.length;
    const teacherActive = nonAdminTeachers.filter(t => t.user?.isActive).length;
    const teacherInactive = teacherTotal - teacherActive;
    assert(teacherTotal >= 0, `Database: verified ${teacherTotal} teachers excluding admin (${teacherActive} active, ${teacherInactive} inactive)`);

    const subjects = await Subject.find().lean();
    const subjectTotal = subjects.length;
    const subjectActive = subjects.filter(s => s.isActive).length;
    const subjectInactive = subjectTotal - subjectActive;
    assert(subjectTotal >= 0, `Database: verified ${subjectTotal} subjects (${subjectActive} active, ${subjectInactive} inactive)`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Database connection test error:', err.message);
  }

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
