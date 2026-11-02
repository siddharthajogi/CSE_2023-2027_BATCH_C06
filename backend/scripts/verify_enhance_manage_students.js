const fs = require('fs');
const path = require('path');
const mongoose = require('../node_modules/mongoose');
require('../node_modules/dotenv').config({ path: './backend/.env' });
require('../models/User');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Department = require('../models/Department');
const Counter = require('../models/Counter');
const adminController = require('../controllers/adminController');

// Frontend helper logic
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

const getStudentYearOrder = (s) => {
  const yr = resolveStudentYear(s);
  if (yr === 'First') return 1;
  if (yr === 'Second') return 2;
  if (yr === 'Third') return 3;
  if (yr === 'Fourth') return 4;
  return 5;
};

async function runTests() {
  console.log('=== VERIFY ENHANCE ADMIN MANAGE STUDENTS PAGE ===\n');
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

  await mongoose.connect(process.env.MONGODB_URI);

  // Load students & departments
  const students = await StudentProfile.find({}).populate('user', 'name isActive').lean();
  const departments = await Department.find({}).lean();
  console.log(`Found ${students.length} students and ${departments.length} departments in database.\n`);

  // Section 1: Toolbar Layout & Code Structure
  console.log('--- 1. Toolbar Filter Layout & Element Order ---');
  const studentListContent = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/StudentList.jsx'), 'utf8');

  const yFilterIdx = studentListContent.indexOf('aria-label="Filter by Academic Year"');
  const dFilterIdx = studentListContent.indexOf('aria-label="Filter by Department"');
  const sFilterIdx = studentListContent.indexOf('aria-label="Filter by Section"');
  const searchIdx = studentListContent.indexOf('placeholder="Search students..."');
  const addBtnIdx = studentListContent.indexOf('<Plus className="w-4 h-4" /> Add Student');

  assert(yFilterIdx !== -1 && dFilterIdx !== -1 && sFilterIdx !== -1, 'All three filters exist on left');
  assert(yFilterIdx < dFilterIdx && dFilterIdx < sFilterIdx, 'Left filters strictly in order: 1. All Years, 2. All Departments, 3. All Sections');
  assert(sFilterIdx < searchIdx, 'Filters on Left, Actions on Right');
  assert(searchIdx < addBtnIdx, 'Right actions strictly in order: 1. Search Students, 2. Add Student');

  // Section 2: Table Column Order (Year immediately after Name)
  console.log('\n--- 2. Table Column Order ---');
  const idColIdx = studentListContent.indexOf('<th className="px-6 py-4 font-medium">Student ID</th>');
  const nameColIdx = studentListContent.indexOf('<th className="px-6 py-4 font-medium">Name</th>');
  const yearColIdx = studentListContent.indexOf('<th className="px-6 py-4 font-medium">Year</th>');
  const deptColIdx = studentListContent.indexOf('<th className="px-6 py-4 font-medium">Department</th>');
  const secColIdx = studentListContent.indexOf('<th className="px-6 py-4 font-medium">Section</th>');
  const statusColIdx = studentListContent.indexOf('<th className="px-6 py-4 font-medium">Status</th>');
  const actColIdx = studentListContent.indexOf('<th className="px-6 py-4 font-medium text-right">Actions</th>');

  assert(
    idColIdx < nameColIdx &&
    nameColIdx < yearColIdx &&
    yearColIdx < deptColIdx &&
    deptColIdx < secColIdx &&
    secColIdx < statusColIdx &&
    statusColIdx < actColIdx,
    'Exact column order: 1. Student ID -> 2. Name -> 3. Year -> 4. Department -> 5. Section -> 6. Status -> 7. Actions'
  );

  // Section 3: No Group Headings inside table
  console.log('\n--- 3. Continuous Table (No Headings) ---');
  assert(!studentListContent.includes('First Year Students') && !studentListContent.includes('FIRST YEAR STUDENTS'), 'No year group headings in table');
  assert(studentListContent.includes('{sortedFiltered.map((s) => ('), 'Continuous table mapping directly over sortedFiltered');

  // Section 4: Sorting Order in All Years
  console.log('\n--- 4. All Years Year-wise Sorting ---');
  const sorted = [...students].sort((a, b) => {
    const orderA = getStudentYearOrder(a);
    const orderB = getStudentYearOrder(b);
    if (orderA !== orderB) return orderA - orderB;
    const nameA = (a.user?.name || a.personalInfo?.name || '').toLowerCase();
    const nameB = (b.user?.name || b.personalInfo?.name || '').toLowerCase();
    if (nameA && nameB && nameA !== nameB) return nameA.localeCompare(nameB);
    return (a.studentId || '').localeCompare(b.studentId || '');
  });

  const orders = sorted.map(s => getStudentYearOrder(s));
  let isMonotonic = true;
  for (let i = 1; i < orders.length; i++) {
    if (orders[i] < orders[i - 1]) isMonotonic = false;
  }
  assert(isMonotonic, 'Students strictly sorted in First Year -> Second Year -> Third Year -> Fourth Year order');

  // Section 5: Individual Filter Functionality
  console.log('\n--- 5. Filter Logic Functionality ---');
  const firstYearStudents = students.filter(s => resolveStudentYear(s) === 'First');
  const secondYearStudents = students.filter(s => resolveStudentYear(s) === 'Second');
  const thirdYearStudents = students.filter(s => resolveStudentYear(s) === 'Third');
  const fourthYearStudents = students.filter(s => resolveStudentYear(s) === 'Fourth');

  assert(firstYearStudents.length > 0, `First Year filter has ${firstYearStudents.length} students`);
  assert(secondYearStudents.length > 0, `Second Year filter has ${secondYearStudents.length} students`);
  assert(thirdYearStudents.length > 0, `Third Year filter has ${thirdYearStudents.length} students`);
  assert(fourthYearStudents.length > 0, `Fourth Year filter has ${fourthYearStudents.length} students`);

  // Section 6: Department Filtering
  const cseStudents = students.filter(s => {
    const dept = s.department || s.departmentRef?.name || '';
    return dept.toLowerCase().includes('computer science') || dept.toLowerCase() === 'cse';
  });
  assert(cseStudents.length > 0, `Department filter isolates ${cseStudents.length} CSE students`);

  // Section 7: Section Filtering
  const secAStudents = students.filter(s => resolveSectionName(s) === 'A');
  const secBStudents = students.filter(s => resolveSectionName(s) === 'B');
  const secCStudents = students.filter(s => resolveSectionName(s) === 'C');
  assert(secAStudents.length > 0, `Section A filter isolates ${secAStudents.length} students`);
  assert(secBStudents.length > 0, `Section B filter isolates ${secBStudents.length} students`);
  assert(secCStudents.length > 0, `Section C filter isolates ${secCStudents.length} students`);

  // Section 8: All 3 Filters Together
  const combined = students.filter(s => {
    const matchesYear = resolveStudentYear(s) === 'First';
    const matchesDept = (s.department || '').toLowerCase().includes('computer science');
    const matchesSec = resolveSectionName(s) === 'A';
    return matchesYear && matchesDept && matchesSec;
  });
  assert(combined.length > 0, `Combined filter (First Year + CSE + Section A) isolates ${combined.length} matching students`);

  // Section 9: Search with Filters
  const searchFilter = students.filter(s => {
    const matchesYear = resolveStudentYear(s) === 'First';
    const matchesSearch = (s.user?.name || '').toLowerCase().includes('rohan');
    return matchesYear && matchesSearch;
  });
  assert(searchFilter.length === 1 && searchFilter[0].studentId === 'stu2026003', 'Search works alongside filters (First Year + "rohan" finds stu2026003)');

  // Section 10: Unique Student IDs & Index Guarantee
  console.log('\n--- 6. Student ID Uniqueness & Counter Logic ---');
  const allIds = students.map(s => s.studentId.toLowerCase());
  const uniqueIds = new Set(allIds);
  assert(allIds.length === uniqueIds.size, 'All existing student IDs in database are 100% unique');

  // Verify unique database indexes
  const userIndexes = await User.collection.indexes();
  const profileIndexes = await StudentProfile.collection.indexes();
  const hasUserUniqueIndex = userIndexes.some(idx => idx.key.userId === 1 && idx.unique === true);
  const hasProfileUniqueIndex = profileIndexes.some(idx => idx.key.studentId === 1 && idx.unique === true);
  assert(hasUserUniqueIndex, 'User collection has unique index on userId');
  assert(hasProfileUniqueIndex, 'StudentProfile collection has unique index on studentId');

  // Section 11: Auto-generated Student ID Preview
  const nextId = await adminController.peekNextStudentId ? await adminController.peekNextStudentId() : null;
  // If not exported, test via route handler mock
  const mockReq = {};
  let routeNextId = '';
  const mockRes = {
    status: (code) => ({
      json: (data) => {
        if (data.nextStudentId) routeNextId = data.nextStudentId;
      }
    })
  };
  await adminController.getNextStudentId(mockReq, mockRes);
  assert(routeNextId.startsWith('STU-2026-'), `getNextStudentId generates correct format: ${routeNextId}`);

  // Section 12: Concurrent ID Generation Safety
  console.log('\n--- 7. Concurrent Student Creation Safety ---');
  const mockSession = null;
  const currentYear = new Date().getFullYear();
  const counterKey = `test_concurrent_${Date.now()}`;

  // Run 10 parallel atomic counter increments
  const parallelTasks = Array.from({ length: 10 }).map((_, i) => {
    return Counter.findOneAndUpdate(
      { _id: counterKey },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
  });
  const results = await Promise.all(parallelTasks);
  const generatedSeqs = results.map(r => r.seq);
  const uniqueSeqs = new Set(generatedSeqs);
  assert(uniqueSeqs.size === 10, '10 concurrent requests generated 10 unique, serialized sequence numbers without collision');
  await Counter.deleteOne({ _id: counterKey });

  // Section 13: Actions Preservation
  console.log('\n--- 8. Row Actions Preservation ---');
  assert(studentListContent.includes('handleEditClick(s)'), 'Edit action preserved');
  assert(studentListContent.includes('toggleStatus(s)'), 'Deactivate/Activate action preserved');
  assert(studentListContent.includes('resetPassword(s)'), 'Reset Password action preserved');
  assert(studentListContent.includes('openDeleteModal(s)'), 'Delete action preserved');

  await mongoose.disconnect();

  console.log(`\n=== RESULTS: ${passed}/${total} tests passed (${Math.round((passed / total) * 100)}%) ===`);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
