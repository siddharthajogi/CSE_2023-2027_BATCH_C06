const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const TeacherProfile = require('../models/TeacherProfile');
const TeachingAssignment = require('../models/TeachingAssignment');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const User = require('../models/User');
const Department = require('../models/Department');
const Institution = require('../models/Institution');
const adminController = require('../controllers/adminController');

async function runTests() {
  console.log('--- STARTING ADMIN TEACHER PROFILE VERIFICATION ---\n');
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

  // 1. Inspect frontend TeacherProfile.jsx
  console.log('\n--- 1. Frontend Code Inspection ---');
  const teacherProfilePath = path.resolve(__dirname, '../../frontend/src/components/TeacherProfile.jsx');
  assert(fs.existsSync(teacherProfilePath), 'TeacherProfile.jsx exists');
  const content = fs.readFileSync(teacherProfilePath, 'utf8');

  // Verify Account Information card is completely removed
  assert(!content.includes('Account Information'), 'Account Information card title is completely removed');
  assert(!content.includes('System Role'), 'System Role field is completely removed');
  assert(!content.includes('Created On'), 'Created On field is completely removed from profile card');

  // Verify Specialization is removed from Professional Information card and edit modal
  assert(!content.includes('>Specialization<'), 'Specialization field label is completely removed from view');
  assert(!content.includes('specializationSelect'), 'Specialization dropdown state is removed from component');

  // Verify Experience (Years) label
  assert(content.includes('Experience (Years)'), 'Experience (Years) label is correctly present');

  // Verify Joined Date field
  assert(content.includes('Joined Date'), 'Joined Date label is present');

  // Verify field order in Professional Information card:
  // 1. Department -> 2. Designation -> 3. Qualifications -> 4. Experience (Years) -> 5. Joined Date
  const profHeaderIdx = content.indexOf('Professional Information');
  const deptIdx = content.indexOf('Department', profHeaderIdx);
  const desigIdx = content.indexOf('Designation', deptIdx);
  const qualIdx = content.indexOf('Qualifications', desigIdx);
  const expIdx = content.indexOf('Experience (Years)', qualIdx);
  const joinedIdx = content.indexOf('Joined Date', expIdx);

  assert(profHeaderIdx !== -1, 'Professional Information card exists');
  assert(deptIdx > profHeaderIdx, '1. Department is after Professional Information header');
  assert(desigIdx > deptIdx, '2. Designation is after Department');
  assert(qualIdx > desigIdx, '3. Qualifications is after Designation');
  assert(expIdx > qualIdx, '4. Experience (Years) is after Qualifications');
  assert(joinedIdx > expIdx, '5. Joined Date is immediately after Experience (Years)');

  // Verify Subjects Assigned section and exact column sequence:
  // 1. Subject Name -> 2. Subject Code -> 3. Year -> 4. Department -> 5. Assigned Section(s)
  assert(content.includes('Subjects Assigned'), 'Subjects Assigned section title is present');
  assert(content.includes('>Subject Name</th>'), '1. Subject Name column header is present');
  assert(content.includes('>Subject Code</th>'), '2. Subject Code column header is present');
  assert(content.includes('>Year</th>'), '3. Year column header is present (renamed from Academic Year)');
  assert(!content.includes('>Academic Year</th>'), 'Academic Year is not in table headers');
  assert(content.includes('>Department</th>'), '4. Department column header is present');
  assert(content.includes('>Assigned Section(s)</th>'), '5. Assigned Section(s) column header is present');

  const subNameIdx = content.indexOf('>Subject Name</th>');
  const subCodeIdx = content.indexOf('>Subject Code</th>', subNameIdx);
  const yearIdx = content.indexOf('>Year</th>', subCodeIdx);
  const tableDeptIdx = content.indexOf('>Department</th>', yearIdx);
  const secIdx = content.indexOf('>Assigned Section(s)</th>', tableDeptIdx);

  assert(subCodeIdx > subNameIdx, 'Column 1 (Subject Name) is before Column 2 (Subject Code)');
  assert(yearIdx > subCodeIdx, 'Column 2 (Subject Code) is before Column 3 (Year)');
  assert(tableDeptIdx > yearIdx, 'Column 3 (Year) is before Column 4 (Department)');
  assert(secIdx > tableDeptIdx, 'Column 4 (Department) is before Column 5 (Assigned Section(s))');

  // Verify visually distinct header styling
  assert(
    content.includes('bg-slate-100 dark:bg-slate-800/90') &&
    content.includes('border-b-2 border-slate-200 dark:border-slate-700') &&
    content.includes('font-bold text-slate-800 dark:text-slate-100'),
    'Header row has distinct contrasting background, subtle bottom border, and bold readable column names'
  );

  // Verify subjects assigned section and empty state
  assert(
    content.includes('No subjects assigned to this teacher yet.'),
    'Clear empty state message is present: "No subjects assigned to this teacher yet."'
  );

  // Verify Faculty ID is editable in TeacherProfile.jsx
  assert(!content.includes('(Read-only)'), 'Read-only tag is removed from Edit Teacher Profile modal');
  assert(content.includes('name="teacherId"'), 'Teacher / Faculty ID input exists in Edit Teacher Profile form');
  assert(!content.includes('<input\n                      type="text"\n                      value={editFormData.teacherId}\n                      disabled'), 'Teacher ID input is not disabled');

  // Verify TeacherList.jsx also has editable Faculty ID
  const teacherListPath = path.resolve(__dirname, '../../frontend/src/components/TeacherList.jsx');
  assert(fs.existsSync(teacherListPath), 'TeacherList.jsx exists');
  const teacherListContent = fs.readFileSync(teacherListPath, 'utf8');
  assert(!teacherListContent.includes('Teacher/Faculty ID (Read-only)'), 'Read-only label removed from TeacherList.jsx');
  assert(teacherListContent.includes('name="teacherId"'), 'Teacher / Faculty ID input exists in TeacherList.jsx');
  assert(teacherListContent.includes('teacherId: editFormData.teacherId.trim()'), 'teacherId is included in TeacherList.jsx update payload');

  // 2. Scope verification: TeacherProfilePage.jsx is untouched
  console.log('\n--- 2. Scope Boundary Verification ---');
  const teacherPortalPagePath = path.resolve(__dirname, '../../frontend/src/components/TeacherProfilePage.jsx');
  assert(fs.existsSync(teacherPortalPagePath), 'Teacher portal own profile page exists and was preserved');
  const teacherPortalContent = fs.readFileSync(teacherPortalPagePath, 'utf8');
  assert(!teacherPortalContent.includes('Subjects Assigned'), 'Teacher portal own profile was not modified with Admin section');

  // 3. Backend API Verification with Real Database Data
  console.log('\n--- 3. Backend API & Data Integrity Verification ---');
  await mongoose.connect(process.env.MONGODB_URI);

  try {
    // Find teacher t001 (Jogi Umadevi) who has multiple assignments (CSE101, CS101 in Sec A, CS101 in Sec B)
    const t001 = await TeacherProfile.findOne({ teacherId: 't001' });
    assert(!!t001, `Found teacher t001: ${t001?.personalInfo?.name}`);

    const institution = t001 ? await Institution.findById(t001.institution) : await Institution.findOne();
    assert(!!institution, `Found institution: ${institution?.name || 'Default'}`);

    const adminUser = await User.findOne({ role: 'admin', institution: institution._id });
    assert(!!adminUser, `Found admin user: ${adminUser?.name}`);

    // Mock Express req & res
    const mockReq = (params = {}, body = {}) => ({
      currentUser: {
        _id: adminUser._id,
        role: 'admin',
        institution: { _id: institution._id }
      },
      params,
      body
    });

    const mockRes = () => {
      const res = {};
      res.statusCode = 200;
      res.status = function(code) {
        this.statusCode = code;
        return this;
      };
      res.json = function(data) {
        this.data = data;
        return this;
      };
      return res;
    };

    if (t001) {
      // Test getTeacherById
      const req = mockReq({ id: String(t001._id) });
      const res = mockRes();
      await adminController.getTeacherById(req, res);

      assert(res.statusCode === 200, `getTeacherById returns status 200`);
      assert(res.data && res.data.success === true, `getTeacherById returns success: true`);
      assert(Array.isArray(res.data.teacher?.assignedSubjects), `assignedSubjects is returned as an array`);

      const subjects = res.data.teacher.assignedSubjects;
      console.log(`Teacher ${t001.teacherId} assigned subjects count: ${subjects.length}`);
      subjects.forEach(s => {
        console.log(`  - ${s.name} (${s.code}): Year="${s.year}", Dept="${s.department}", Sections=[${s.sections.join(', ')}]`);
      });

      // Verification of study year values:
      // Must be 'First Year', 'Second Year', 'Third Year', or 'Fourth Year'
      // Must NOT contain calendar year '2026-2027' or any 4-digit number
      const validStudyYears = ['First Year', 'Second Year', 'Third Year', 'Fourth Year'];
      subjects.forEach(s => {
        assert(
          validStudyYears.includes(s.year),
          `Subject ${s.code} has valid study year: "${s.year}"`
        );
        assert(
          !/^\d{4}/.test(s.year),
          `Subject ${s.code} does NOT display calendar year in Year column (value: "${s.year}")`
        );
      });

      // Check specific expected years for t001
      const cs101 = subjects.find(s => s.code === 'CS101');
      assert(!!cs101 && cs101.year === 'First Year', 'CS101 shows correct assigned study year: "First Year"');
      if (cs101) {
        assert(cs101.sections.length >= 2, `CS101 has multiple sections consolidated (${cs101.sections.join(', ')})`);
        assert(
          cs101.sections.some(s => s.includes('A')) && cs101.sections.some(s => s.includes('B')),
          'CS101 contains both Section A and Section B within the same study year'
        );
      }

      const cse101 = subjects.find(s => s.code === 'CSE101');
      assert(!!cse101 && cse101.year === 'Fourth Year', 'CSE101 shows correct assigned study year: "Fourth Year"');

      // Ensure no duplicate subject rows within the same year
      const uniqueKeys = new Set(subjects.map(s => `${s._id}_${s.year}`));
      assert(uniqueKeys.size === subjects.length, 'No duplicate subject rows within the same study year');

      // Verify Joined Date fallback
      assert(!!res.data.teacher.joinedDate, `Joined Date is populated: ${res.data.teacher.joinedDate}`);
    }

    // Verify all other teachers in the DB to test across First, Second, Third, and Fourth study years
    console.log('\n--- Testing All Other Teachers for Study Years ---');
    const teachersList = await TeacherProfile.find({ institution: institution._id });
    for (const t of teachersList) {
      const req = mockReq({ id: String(t._id) });
      const res = mockRes();
      await adminController.getTeacherById(req, res);
      const subs = res.data.teacher?.assignedSubjects || [];
      for (const s of subs) {
        assert(
          ['First Year', 'Second Year', 'Third Year', 'Fourth Year'].includes(s.year),
          `Teacher ${t.teacherId} (${t.personalInfo?.name}) subject ${s.code} has valid study year: "${s.year}"`
        );
        assert(
          !/^\d{4}/.test(s.year),
          `Teacher ${t.teacherId} subject ${s.code} does NOT have calendar year in Year column`
        );
      }
    }

    // Test a teacher with NO assigned subjects -> verify empty state data
    const allTeachers = await TeacherProfile.find({ institution: institution._id });
    const assignments = await TeachingAssignment.find({ institution: institution._id, isActive: true });
    const assignedTeacherIds = new Set(assignments.map(a => String(a.teacher)));
    const unassignedTeacher = allTeachers.find(t => !assignedTeacherIds.has(String(t._id)));

    if (unassignedTeacher) {
      console.log(`\nTesting unassigned teacher: ${unassignedTeacher.teacherId} (${unassignedTeacher.personalInfo?.name})`);
      const req = mockReq({ id: String(unassignedTeacher._id) });
      const res = mockRes();
      await adminController.getTeacherById(req, res);

      assert(res.statusCode === 200, 'getTeacherById succeeds for unassigned teacher');
      assert(
        Array.isArray(res.data.teacher?.assignedSubjects) && res.data.teacher.assignedSubjects.length === 0,
        'assignedSubjects is an empty array [] for unassigned teacher (triggers empty state UI)'
      );
    }

    // 4. Test Update Teacher Profile (Edit functionality remains intact)
    console.log('\n--- 4. Update Teacher Profile Functional Check ---');
    if (t001) {
      const testJoinedDate = '2023-08-15';
      const testExperience = 8;
      const updateReq = mockReq(
        { id: String(t001._id) },
        {
          department: t001.department,
          designation: t001.designation,
          personalInfo: {
            name: t001.personalInfo.name,
            email: t001.personalInfo.email,
            phone: t001.personalInfo.phone,
            address: t001.personalInfo.address
          },
          professionalInfo: {
            qualifications: t001.professionalInfo.qualifications,
            highestQualification: t001.professionalInfo.highestQualification,
            yearsOfExperience: testExperience,
            joinedDate: testJoinedDate
          },
          joinedDate: testJoinedDate
        }
      );
      const updateRes = mockRes();
      await adminController.updateTeacher(updateReq, updateRes);

      assert(updateRes.statusCode === 200, `updateTeacher returned status 200`);
      assert(updateRes.data?.success === true, `updateTeacher returned success: true`);

      // Re-fetch teacher using getTeacherById to confirm persistence
      const refetchReq = mockReq({ id: String(t001._id) });
      const refetchRes = mockRes();
      await adminController.getTeacherById(refetchReq, refetchRes);

      assert(
        Number(refetchRes.data.teacher?.professionalInfo?.yearsOfExperience) === testExperience,
        `Experience (Years) persisted latest saved value: ${testExperience}`
      );
      assert(
        new Date(refetchRes.data.teacher?.joinedDate).toISOString().startsWith('2023-08-15'),
        `Joined Date persisted latest saved value: 2023-08-15`
      );
    }

    // 5. Test Teacher / Faculty ID Editing
    console.log('\n--- 5. Teacher / Faculty ID Editing Functional & Security Verification ---');
    if (t001) {
      // 5.1 Test Empty Teacher ID
      const emptyIdReq = mockReq(
        { id: String(t001._id) },
        {
          teacherId: '',
          department: t001.department,
          designation: t001.designation,
          personalInfo: {
            name: t001.personalInfo.name,
            email: t001.personalInfo.email,
            phone: t001.personalInfo.phone,
            address: t001.personalInfo.address
          },
          professionalInfo: {
            qualifications: t001.professionalInfo.qualifications,
            highestQualification: t001.professionalInfo.highestQualification,
            yearsOfExperience: 5
          }
        }
      );
      const emptyIdRes = mockRes();
      await adminController.updateTeacher(emptyIdReq, emptyIdRes);
      assert(emptyIdRes.statusCode === 400, 'Empty teacherId returns 400 Bad Request');
      assert(!!emptyIdRes.data?.errors?.teacherId, 'Validation error mentions teacherId is required');

      // 5.2 Test Duplicate Teacher ID with another teacher
      const otherTeacher = await TeacherProfile.findOne({ _id: { $ne: t001._id } });
      if (otherTeacher) {
        const duplicateIdReq = mockReq(
          { id: String(t001._id) },
          {
            teacherId: otherTeacher.teacherId,
            department: t001.department,
            designation: t001.designation,
            personalInfo: {
              name: t001.personalInfo.name,
              email: t001.personalInfo.email,
              phone: t001.personalInfo.phone,
              address: t001.personalInfo.address
            },
            professionalInfo: {
              qualifications: t001.professionalInfo.qualifications,
              highestQualification: t001.professionalInfo.highestQualification,
              yearsOfExperience: 5
            }
          }
        );
        const duplicateIdRes = mockRes();
        await adminController.updateTeacher(duplicateIdReq, duplicateIdRes);
        assert(duplicateIdRes.statusCode === 400, 'Duplicate teacherId returns 400 Bad Request');
        assert(
          duplicateIdRes.data?.error?.includes('already exists') || duplicateIdRes.data?.errors?.teacherId?.includes('already exists'),
          'Duplicate teacherId returns clear "already exists" error message'
        );
      }

      // 5.3 Test Successful Update of Teacher ID to a new unique ID
      const originalTeacherId = t001.teacherId;
      const initialUser = await User.findById(t001.user);
      const originalUserId = initialUser?.userId;
      const originalPasswordHash = initialUser?.password;
      const initialAssignmentCount = await TeachingAssignment.countDocuments({ teacher: t001._id });
      const newTestTeacherId = `t001_edited`;

      const updateIdReq = mockReq(
        { id: String(t001._id) },
        {
          teacherId: newTestTeacherId,
          department: t001.department,
          designation: t001.designation,
          personalInfo: {
            name: t001.personalInfo.name,
            email: t001.personalInfo.email,
            phone: t001.personalInfo.phone,
            address: t001.personalInfo.address
          },
          professionalInfo: {
            qualifications: t001.professionalInfo.qualifications,
            highestQualification: t001.professionalInfo.highestQualification,
            yearsOfExperience: 5
          }
        }
      );
      const updateIdRes = mockRes();
      await adminController.updateTeacher(updateIdReq, updateIdRes);

      assert(updateIdRes.statusCode === 200, 'updateTeacher with new unique teacherId returns 200');
      assert(updateIdRes.data?.teacher?.teacherId === newTestTeacherId, `TeacherProfile.teacherId is updated to "${newTestTeacherId}"`);

      // Verify DB documents directly
      const updatedTeacherDoc = await TeacherProfile.findById(t001._id);
      const updatedUserDoc = await User.findById(t001.user);
      assert(updatedTeacherDoc.teacherId === newTestTeacherId, `Direct DB check: TeacherProfile.teacherId is "${newTestTeacherId}"`);
      assert(updatedUserDoc.userId === newTestTeacherId.toLowerCase(), `Direct DB check: User.userId is updated to "${newTestTeacherId.toLowerCase()}"`);

      // Verify teaching assignments remain 100% intact
      const postAssignmentCount = await TeachingAssignment.countDocuments({ teacher: t001._id });
      assert(postAssignmentCount === initialAssignmentCount, `Teaching assignments preserved: ${postAssignmentCount} assignments intact`);

      // Verify teacher account credentials/password hash intact
      assert(updatedUserDoc.password === originalPasswordHash, 'Teacher account password hash remains identical, intact, and untouched after ID update');

      // 5.4 Test Restoring back to original teacher ID
      const restoreIdReq = mockReq(
        { id: String(t001._id) },
        {
          teacherId: originalTeacherId,
          department: t001.department,
          designation: t001.designation,
          personalInfo: {
            name: t001.personalInfo.name,
            email: t001.personalInfo.email,
            phone: t001.personalInfo.phone,
            address: t001.personalInfo.address
          },
          professionalInfo: {
            qualifications: t001.professionalInfo.qualifications,
            highestQualification: t001.professionalInfo.highestQualification,
            yearsOfExperience: 5
          }
        }
      );
      const restoreIdRes = mockRes();
      await adminController.updateTeacher(restoreIdReq, restoreIdRes);

      assert(restoreIdRes.statusCode === 200, 'updateTeacher restored original teacherId with status 200');
      const restoredTeacherDoc = await TeacherProfile.findById(t001._id);
      const restoredUserDoc = await User.findById(t001.user);
      assert(restoredTeacherDoc.teacherId === originalTeacherId, `TeacherProfile restored to "${originalTeacherId}"`);
      assert(restoredUserDoc.userId === originalUserId, `User.userId restored to "${originalUserId}"`);
    }

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await mongoose.disconnect();
  }

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
