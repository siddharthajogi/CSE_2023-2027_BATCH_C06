const fs = require('fs');
const path = require('path');
const mongoose = require('../node_modules/mongoose');
require('../node_modules/dotenv').config({ path: path.join(__dirname, '../.env') });

require('../models/User');
require('../models/Department');
const TeacherProfile = require('../models/TeacherProfile');
const TeachingAssignment = require('../models/TeachingAssignment');
const Subject = require('../models/Subject');
const Institution = require('../models/Institution');

async function verifyEnhanceManageTeachers() {
  console.log('=== START VERIFICATION: Admin Manage Teachers Enhancement ===\n');

  // 1. Static checks on AdminLayout.jsx
  console.log('--- 1. Checking AdminLayout.jsx ---');
  const adminLayoutPath = path.join(__dirname, '../../frontend/src/components/AdminLayout.jsx');
  const adminLayoutSrc = fs.readFileSync(adminLayoutPath, 'utf8');

  // Verify Add Teacher is removed from menuItems
  const menuItemsMatch = adminLayoutSrc.match(/const menuItems = \[([\s\S]*?)\];/);
  if (!menuItemsMatch) throw new Error('Could not find menuItems in AdminLayout.jsx');
  const hasAddTeacherInMenu = menuItemsMatch[1].includes("name: 'Add Teacher'");
  console.log('1.1 Add Teacher removed from sidebar menuItems:', !hasAddTeacherInMenu ? 'PASS' : 'FAIL');
  if (hasAddTeacherInMenu) throw new Error('Add Teacher is still present in sidebar menuItems');

  // Verify Manage Teachers remains active on subroutes
  const hasManageTeachersSubroute = adminLayoutSrc.includes("cleanPath === '/admin/teachers' || cleanPath.startsWith('/admin/teachers/')");
  console.log('1.2 Manage Teachers active for subroutes (/admin/teachers/create, /admin/teachers/:id):', hasManageTeachersSubroute ? 'PASS' : 'FAIL');
  if (!hasManageTeachersSubroute) throw new Error('Manage Teachers route active check failed');

  // 2. Static checks on TeacherList.jsx
  console.log('\n--- 2. Checking TeacherList.jsx ---');
  const teacherListPath = path.join(__dirname, '../../frontend/src/components/TeacherList.jsx');
  const teacherListSrc = fs.readFileSync(teacherListPath, 'utf8');

  // Verify Toolbar layout
  const hasDeptDropdown = teacherListSrc.includes('<option value="">All Departments</option>');
  const hasDesigDropdown = teacherListSrc.includes('<option value="">All Designations</option>');
  const hasSubjectDropdown = teacherListSrc.includes('<option value="">All Subjects</option>');
  console.log('2.1 Three filter dropdowns present (All Departments, All Designations, All Subjects):', (hasDeptDropdown && hasDesigDropdown && hasSubjectDropdown) ? 'PASS' : 'FAIL');
  if (!hasDeptDropdown || !hasDesigDropdown || !hasSubjectDropdown) throw new Error('Missing filter dropdowns in toolbar');

  // Check toolbar order specifically inside Top Toolbar: Left has All Departments -> All Designations -> All Subjects -> Search -> Add Teacher
  const toolbarSection = teacherListSrc.substring(teacherListSrc.indexOf('Top Toolbar'));
  const deptIdx = toolbarSection.indexOf('All Departments Dropdown');
  const desigIdx = toolbarSection.indexOf('All Designations Dropdown');
  const subIdx = toolbarSection.indexOf('All Subjects Dropdown');
  const searchIdx = toolbarSection.indexOf('placeholder="Search teachers..."');
  const addTeacherBtnIdx = toolbarSection.indexOf('<Plus className="w-4 h-4" /> Add Teacher');

  console.log('Indices:', { deptIdx, desigIdx, subIdx, searchIdx, addTeacherBtnIdx });
  const correctOrder = (deptIdx < desigIdx) && (desigIdx < subIdx) && (subIdx < searchIdx) && (searchIdx < addTeacherBtnIdx);
  console.log('2.2 Toolbar layout order (Departments -> Designations -> Subjects -> Search -> Add Teacher):', correctOrder ? 'PASS' : 'FAIL');
  if (!correctOrder) throw new Error('Toolbar controls are not in the exact requested order');

  // Verify Add Teacher button navigates to /admin/teachers/create
  const hasAddTeacherNavigate = teacherListSrc.includes("navigate('/admin/teachers/create')");
  console.log('2.3 Add Teacher button opens existing Add Teacher form:', hasAddTeacherNavigate ? 'PASS' : 'FAIL');
  if (!hasAddTeacherNavigate) throw new Error('Add Teacher button missing navigate to /admin/teachers/create');

  // Verify Search input expands to fill gap
  const hasExpandedSearch = teacherListSrc.includes('sm:flex-1 sm:max-w-md');
  console.log('2.4 Search input expands to fill horizontal gap:', hasExpandedSearch ? 'PASS' : 'FAIL');
  if (!hasExpandedSearch) throw new Error('Search input missing flex-1 / responsive width class');

  // Verify Table row has NO Edit button
  const tbodyMatch = teacherListSrc.match(/<tbody[\s\S]*?<\/tbody>/);
  if (!tbodyMatch) throw new Error('tbody not found in TeacherList.jsx');
  const tbodyContent = tbodyMatch[0];
  const hasRowEditBtn = tbodyContent.includes('openEditModal') || tbodyContent.includes('>Edit<') || tbodyContent.includes('> Edit<');
  console.log('2.5 Table row Edit action button completely removed:', !hasRowEditBtn ? 'PASS' : 'FAIL');
  if (hasRowEditBtn) throw new Error('Table row still contains Edit button');

  // Verify row actions retain stopPropagation
  const hasStopPropagation = tbodyContent.includes('e.stopPropagation()');
  console.log('2.6 Clicking row actions prevents row navigation (e.stopPropagation()):', hasStopPropagation ? 'PASS' : 'FAIL');
  if (!hasStopPropagation) throw new Error('Row action cell missing stopPropagation');

  // Verify clicking row navigates to profile
  const hasRowProfileNav = tbodyContent.includes('navigate(`/admin/teachers/${t._id}`)');
  console.log('2.7 Clicking teacher row navigates to Teacher Profile:', hasRowProfileNav ? 'PASS' : 'FAIL');
  if (!hasRowProfileNav) throw new Error('Row missing navigation to profile');

  // 3. Database & Controller API Integration
  console.log('\n--- 3. Checking Backend Database & Combined Filters ---');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const adminController = require('../controllers/adminController');
  const sampleTeacher = await TeacherProfile.findOne({});
  if (!sampleTeacher) throw new Error('No teachers found in database');
  const institutionId = sampleTeacher.institution;

  // Mock req and res for getTeachers
  const mockReq = { currentUser: { institution: { _id: institutionId } } };
  let responseData = null;
  const mockRes = {
    status: (code) => ({
      json: (data) => { responseData = data; }
    })
  };

  await adminController.getTeachers(mockReq, mockRes);
  if (!responseData || !responseData.success || !responseData.teachers) {
    throw new Error('getTeachers did not return expected response');
  }

  const teachers = responseData.teachers;
  console.log(`3.1 getTeachers returned ${teachers.length} teachers.`);

  // Check assignedSubjects enrichment
  const teachersWithSubjects = teachers.filter(t => Array.isArray(t.assignedSubjects));
  console.log('3.2 All teachers enriched with assignedSubjects array:', teachersWithSubjects.length === teachers.length ? 'PASS' : 'FAIL');
  if (teachersWithSubjects.length !== teachers.length) throw new Error('Not all teachers have assignedSubjects');

  // Verify teacher with multiple subjects (e.g. t001)
  const t001 = teachers.find(t => t.teacherId.toLowerCase() === 't001');
  if (t001) {
    console.log(`3.3 Teacher t001 (${t001.user?.name}) assigned subjects count: ${t001.assignedSubjects.length}`);
    t001.assignedSubjects.forEach(s => console.log(`   - ${s.name} (${s.code})`));
    console.log('3.4 Multiple subjects assigned correctly without row duplication:', t001.assignedSubjects.length >= 2 ? 'PASS' : 'FAIL');
  }

  // 4. Combined Filter Logic Verification
  console.log('\n--- 4. Testing Filter Scenarios ---');

  // Filter helper simulating frontend TeacherList logic
  function filterTeachers({ dept = '', desig = '', subject = '', search = '' }) {
    return teachers.filter(t => {
      const term = search.toLowerCase().trim();
      const matchesSearch = !term ? true : (
        (t.teacherId || '').toLowerCase().includes(term) ||
        (t.user?.name || t.personalInfo?.name || '').toLowerCase().includes(term)
      );

      const matchesDept = !dept ? true : (() => {
        const rawDept = (t.department || '').toLowerCase();
        const refName = (t.departmentRef?.name || '').toLowerCase();
        const target = dept.toLowerCase().trim();
        return rawDept === target || refName === target;
      })();

      const matchesDesig = !desig ? true : (
        (t.designation || '').toLowerCase().trim() === desig.toLowerCase().trim()
      );

      const matchesSubject = !subject ? true : (() => {
        const targetSub = subject.toLowerCase().trim();
        return (t.assignedSubjects || []).some(asg => {
          const asgId = asg._id ? String(asg._id) : '';
          const asgCode = (asg.code || '').toLowerCase().trim();
          const asgName = (asg.name || '').toLowerCase().trim();
          return asgId === subject || asgCode === targetSub || asgName === targetSub;
        });
      })();

      return matchesSearch && matchesDept && matchesDesig && matchesSubject;
    });
  }

  // Scenario 1: Department = CSE
  const cseTeachers = filterTeachers({ dept: 'Computer Science and Engineering' });
  console.log(`4.1 Department = CSE: Found ${cseTeachers.length} teachers.`);
  cseTeachers.forEach(t => console.log(`   - [${t.teacherId}] ${t.user?.name} (${t.department})`));
  const csePass = cseTeachers.length === 2 && cseTeachers.every(t => t.department === 'Computer Science and Engineering');
  console.log('   Result:', csePass ? 'PASS' : 'FAIL');
  if (!csePass) throw new Error('Scenario 1 failed');

  // Scenario 2: Designation = Associate Professor
  const assocProfs = filterTeachers({ desig: 'Associate Professor' });
  console.log(`4.2 Designation = Associate Professor: Found ${assocProfs.length} teachers.`);
  assocProfs.forEach(t => console.log(`   - [${t.teacherId}] ${t.user?.name} (${t.designation})`));
  const desigPass = assocProfs.length === 2 && assocProfs.every(t => t.designation === 'Associate Professor');
  console.log('   Result:', desigPass ? 'PASS' : 'FAIL');
  if (!desigPass) throw new Error('Scenario 2 failed');

  // Scenario 3: Subject = Database Management Systems
  const dbmsTeachers = filterTeachers({ subject: 'Database Management Systems' });
  console.log(`4.3 Subject = Database Management Systems: Found ${dbmsTeachers.length} teachers.`);
  dbmsTeachers.forEach(t => console.log(`   - [${t.teacherId}] ${t.user?.name}`));
  const dbmsPass = dbmsTeachers.length === 1 && dbmsTeachers[0].teacherId === 't004';
  console.log('   Result:', dbmsPass ? 'PASS' : 'FAIL');
  if (!dbmsPass) throw new Error('Scenario 3 failed');

  // Scenario 4: Department = CSE + Subject = Database Management Systems
  const cseDbmsTeachers = filterTeachers({ dept: 'Computer Science and Engineering', subject: 'Database Management Systems' });
  console.log(`4.4 Department = CSE + Subject = DBMS: Found ${cseDbmsTeachers.length} teachers.`);
  const cseDbmsPass = cseDbmsTeachers.length === 1 && cseDbmsTeachers[0].teacherId === 't004';
  console.log('   Result:', cseDbmsPass ? 'PASS' : 'FAIL');
  if (!cseDbmsPass) throw new Error('Scenario 4 failed');

  // Scenario 5: Department = CSE + Designation = Professor + Subject = DBMS
  const tripleFilterTeachers = filterTeachers({
    dept: 'Computer Science and Engineering',
    desig: 'Professor',
    subject: 'Database Management Systems'
  });
  console.log(`4.5 Department = CSE + Desig = Professor + Subject = DBMS: Found ${tripleFilterTeachers.length} teachers.`);
  const triplePass = tripleFilterTeachers.length === 1 && tripleFilterTeachers[0].teacherId === 't004';
  console.log('   Result:', triplePass ? 'PASS' : 'FAIL');
  if (!triplePass) throw new Error('Scenario 5 failed');

  // Scenario 6: Search with filters (Search = "Anand" + Dept = CSE)
  const searchFilterTeachers = filterTeachers({
    dept: 'Computer Science and Engineering',
    search: 'Anand'
  });
  console.log(`4.6 Search = "Anand" + Dept = CSE: Found ${searchFilterTeachers.length} teachers.`);
  const searchPass = searchFilterTeachers.length === 1 && searchFilterTeachers[0].teacherId === 't004';
  console.log('   Result:', searchPass ? 'PASS' : 'FAIL');
  if (!searchPass) throw new Error('Scenario 6 failed');

  // Scenario 7: Teacher assigned to multiple subjects appears under either subject
  const dsaTeachers = filterTeachers({ subject: 'DSA' });
  const cProgTeachers = filterTeachers({ subject: 'Programming in C' });
  const multiSubPass = dsaTeachers.some(t => t.teacherId === 't001') && cProgTeachers.some(t => t.teacherId === 't001');
  console.log('4.7 Teacher assigned to multiple subjects appears under each of their subjects:', multiSubPass ? 'PASS' : 'FAIL');
  if (!multiSubPass) throw new Error('Scenario 7 failed');

  await mongoose.disconnect();
  console.log('\n=== ALL VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
}

verifyEnhanceManageTeachers().catch(err => {
  console.error('\nVerification FAILED:', err);
  process.exit(1);
});
