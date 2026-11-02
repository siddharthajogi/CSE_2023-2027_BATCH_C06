const fs = require('fs');
const path = require('path');
const mongoose = require('../node_modules/mongoose');
require('../node_modules/dotenv').config({ path: './backend/.env' });
require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Class = require('../models/Class');

// Replicate exported frontend helper logic
const resolveSectionName = (student) => {
  if (!student) return '—';
  const sec = student.section || student.classRef?.section;
  if (!sec) return '—';
  const cleaned = String(sec).replace(/^(section|sec)\s+/i, '').trim();
  return cleaned || '—';
};

const resolveStudentYear = (student) => {
  if (!student) return '—';

  const rawYear = student.yearOfStudy || student.classRef?.yearOfStudy;
  if (rawYear && typeof rawYear === 'string') {
    const y = rawYear.trim().toLowerCase();
    if (y.includes('first') || y === '1' || y.startsWith('1st')) return 'First';
    if (y.includes('second') || y === '2' || y.startsWith('2nd')) return 'Second';
    if (y.includes('third') || y === '3' || y.startsWith('3rd')) return 'Third';
    if (y.includes('fourth') || y === '4' || y.startsWith('4th')) return 'Fourth';
  }

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

async function runTests() {
  console.log('=== VERIFY ADMIN MANAGE STUDENTS PAGE ENHANCEMENT ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`[PASS] Test ${total}: ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${total}: ${message}`);
      process.exitCode = 1;
    }
  }

  // Section 1: Check AdminLayout.jsx
  console.log('--- 1. Admin Sidebar Navigation Check ---');
  const adminLayoutContent = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/AdminLayout.jsx'), 'utf8');
  assert(!adminLayoutContent.includes("{ name: 'Add Student', icon: UserPlus, path: '/admin/students/create' }"), 'Add Student removed from Admin sidebar menuItems');
  assert(adminLayoutContent.includes("{ name: 'Manage Students', icon: Users, path: '/admin/students' }"), 'Manage Students preserved in Admin sidebar menuItems');
  assert(adminLayoutContent.includes("{ name: 'Manage Teachers', icon: GraduationCap, path: '/admin/teachers' }"), 'Manage Teachers preserved in Admin sidebar menuItems');
  assert(adminLayoutContent.includes("{ name: 'Add Teacher', icon: UserPlus, path: '/admin/teachers/create' }"), 'Add Teacher preserved in Admin sidebar menuItems');
  assert(adminLayoutContent.includes("cleanPath === '/admin/students' || cleanPath.startsWith('/admin/students/')"), 'Manage Students highlighted active on /admin/students and /admin/students/create');

  // Section 2: Check StudentList.jsx Toolbar and Order
  console.log('\n--- 2. Manage Students Toolbar Order & Structure ---');
  const studentListContent = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/StudentList.jsx'), 'utf8');
  
  const searchIndex = studentListContent.indexOf('placeholder="Search students..."');
  const addBtnIndex = studentListContent.indexOf('<Plus className="w-4 h-4" /> Add Student');
  assert(searchIndex !== -1, 'Search Students input exists');
  assert(addBtnIndex !== -1, 'Add Student button exists');
  assert(searchIndex < addBtnIndex, 'Controls in exact required order: 1. Search Students, 2. Add Student');
  assert(studentListContent.includes("navigate('/admin/students/create')"), 'Add Student button triggers navigation to /admin/students/create');

  // Section 3: Check Table Column Headers
  console.log('\n--- 3. Students Table Columns ---');
  assert(studentListContent.includes('<th className="px-6 py-4 font-medium">Student ID</th>'), 'Column 1: Student ID header');
  assert(studentListContent.includes('<th className="px-6 py-4 font-medium">Name</th>'), 'Column 2: Name header');
  assert(studentListContent.includes('<th className="px-6 py-4 font-medium">Department</th>'), 'Column 3: Department header');
  assert(studentListContent.includes('<th className="px-6 py-4 font-medium">Section</th>'), 'Column 4: Section header (replaced Group / Section)');
  assert(!studentListContent.includes('<th className="px-6 py-4 font-medium">Group / Section</th>'), 'Old "Group / Section" header completely removed');
  assert(studentListContent.includes('<th className="px-6 py-4 font-medium">Year</th>'), 'Column 5: Year header');
  assert(studentListContent.includes('<th className="px-6 py-4 font-medium">Status</th>'), 'Column 6: Status header');
  assert(studentListContent.includes('<th className="px-6 py-4 font-medium text-right">Actions</th>'), 'Column 7: Actions header');
  assert(!studentListContent.includes('Sem {s.semester ||'), 'Old "Sem {semester} • Sec {section}" badge removed');

  // Section 4: Section Resolution Unit Tests
  console.log('\n--- 4. Section Column Unit Tests ---');
  assert(resolveSectionName({ section: 'A' }) === 'A', 'Plain section "A" resolves to "A"');
  assert(resolveSectionName({ section: 'B' }) === 'B', 'Plain section "B" resolves to "B"');
  assert(resolveSectionName({ section: 'Section C' }) === 'C', '"Section C" resolves to only "C"');
  assert(resolveSectionName({ section: 'Sec D' }) === 'D', '"Sec D" resolves to only "D"');
  assert(resolveSectionName({ classRef: { section: 'B' } }) === 'B', 'Fallback to classRef.section resolves correctly');

  // Section 5: Year Resolution Unit Tests
  console.log('\n--- 5. Academic Year Resolution Unit Tests ---');
  assert(resolveStudentYear({ semester: '1st' }) === 'First', 'Semester 1st maps to "First"');
  assert(resolveStudentYear({ semester: '2nd' }) === 'First', 'Semester 2nd maps to "First"');
  assert(resolveStudentYear({ semester: '3rd' }) === 'Second', 'Semester 3rd maps to "Second"');
  assert(resolveStudentYear({ semester: '4th' }) === 'Second', 'Semester 4th maps to "Second"');
  assert(resolveStudentYear({ semester: '5th' }) === 'Third', 'Semester 5th maps to "Third"');
  assert(resolveStudentYear({ semester: '6th' }) === 'Third', 'Semester 6th maps to "Third"');
  assert(resolveStudentYear({ semester: '7th' }) === 'Fourth', 'Semester 7th maps to "Fourth"');
  assert(resolveStudentYear({ semester: '8th' }) === 'Fourth', 'Semester 8th maps to "Fourth"');
  assert(resolveStudentYear({ yearOfStudy: 'First Year' }) === 'First', '"First Year" maps to "First"');
  assert(resolveStudentYear({ yearOfStudy: 'Second Year' }) === 'Second', '"Second Year" maps to "Second"');
  assert(resolveStudentYear({ yearOfStudy: 'Third Year' }) === 'Third', '"Third Year" maps to "Third"');
  assert(resolveStudentYear({ yearOfStudy: 'Fourth Year' }) === 'Fourth', '"Fourth Year" maps to "Fourth"');

  // Section 6: Live Database Verification
  console.log('\n--- 6. Live Database Students Verification ---');
  await mongoose.connect(process.env.MONGODB_URI);
  const students = await StudentProfile.find({}).populate('user', 'name isActive').lean();
  assert(students.length > 0, `Loaded ${students.length} students from database`);

  const allowedYears = ['First', 'Second', 'Third', 'Fourth'];
  const allowedSections = ['A', 'B', 'C', 'D'];

  let allSectionsValid = true;
  let allYearsValid = true;

  students.forEach(s => {
    const sec = resolveSectionName(s);
    const yr = resolveStudentYear(s);
    if (!allowedSections.includes(sec)) {
      console.error(`Invalid section resolved for ${s.studentId}: ${sec}`);
      allSectionsValid = false;
    }
    if (!allowedYears.includes(yr)) {
      console.error(`Invalid year resolved for ${s.studentId}: ${yr}`);
      allYearsValid = false;
    }
  });

  assert(allSectionsValid, 'All live students resolve to pure section letters (A, B, C, etc.)');
  assert(allYearsValid, 'All live students resolve to valid academic study years (First, Second, Third, Fourth)');

  // Verify s001 specifically
  const s001 = students.find(s => s.studentId === 's001');
  assert(s001 !== undefined, 'Student s001 found in database');
  assert(resolveSectionName(s001) === 'C', 'Student s001 section resolves strictly to "C"');
  assert(resolveStudentYear(s001) === 'Fourth', 'Student s001 year resolves strictly to "Fourth" (semester 7th)');

  // Section 7: Actions Preservation
  console.log('\n--- 7. Existing Functionality & Actions Preservation ---');
  assert(studentListContent.includes('handleEditClick(s)'), 'Edit action preserved');
  assert(studentListContent.includes('toggleStatus(s)'), 'Deactivate/Activate action preserved');
  assert(studentListContent.includes('resetPassword(s)'), 'Reset Password action preserved');
  assert(studentListContent.includes('openDeleteModal(s)'), 'Delete action preserved');
  assert(studentListContent.includes('filtered.map'), 'Search filtering logic preserved');

  await mongoose.disconnect();

  console.log(`\n=== RESULTS: ${passed}/${total} tests passed (${Math.round((passed / total) * 100)}%) ===`);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

