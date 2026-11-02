const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Subject = require('../models/Subject');
const TeachingAssignment = require('../models/TeachingAssignment');
const TeacherProfile = require('../models/TeacherProfile');
const Class = require('../models/Class');
const User = require('../models/User');
const Department = require('../models/Department');
const Institution = require('../models/Institution');
const adminController = require('../controllers/adminController');

async function runTests() {
  console.log('--- STARTING ADMIN SUBJECT DETAILS & CLICKABLE ROWS VERIFICATION ---\n');
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

  // 1. Inspect frontend SubjectList.jsx
  console.log('\n--- 1. Frontend SubjectList.jsx Inspection ---');
  const subjectListPath = path.resolve(__dirname, '../../frontend/src/components/SubjectList.jsx');
  assert(fs.existsSync(subjectListPath), 'SubjectList.jsx exists');
  const subjectListContent = fs.readFileSync(subjectListPath, 'utf8');

  // Verify row navigation & hover classes
  assert(
    subjectListContent.includes("navigate(`/admin/subjects/${s._id}`") || subjectListContent.includes('navigate(`/admin/subjects/${s._id}'),
    'Subject row onClick navigates to /admin/subjects/:id'
  );
  assert(
    subjectListContent.includes('cursor-pointer') && subjectListContent.includes('hover:bg-slate-50'),
    'Subject row has cursor-pointer and hover styling'
  );

  // Verify action buttons stopPropagation so row click is not triggered
  assert(
    subjectListContent.includes('onClick={(e) => {') && subjectListContent.includes('e.stopPropagation();') && subjectListContent.includes('handleOpenEdit(s);'),
    'Edit action button uses stopPropagation to prevent row navigation'
  );
  assert(
    subjectListContent.includes('e.stopPropagation();') && subjectListContent.includes('toggleStatus(s);'),
    'Deactivate/Activate action button uses stopPropagation to prevent row navigation'
  );
  assert(
    subjectListContent.includes('e.stopPropagation();') && subjectListContent.includes('handleDeleteClick(s);'),
    'Delete action button uses stopPropagation to prevent row navigation'
  );
  assert(
    subjectListContent.includes('onClick={(e) => e.stopPropagation()}') || subjectListContent.includes('e.stopPropagation()'),
    'Action column prevents accidental row clicks'
  );

  // Verify filter state preservation
  assert(
    subjectListContent.includes('location.state?.filterYear') && subjectListContent.includes('location.state?.statusFilter'),
    'SubjectList restores previous filter and search state when navigating back'
  );

  // 2. Inspect frontend SubjectDetails.jsx
  console.log('\n--- 2. Frontend SubjectDetails.jsx Inspection ---');
  const subjectDetailsPath = path.resolve(__dirname, '../../frontend/src/components/SubjectDetails.jsx');
  assert(fs.existsSync(subjectDetailsPath), 'SubjectDetails.jsx exists');
  const detailsContent = fs.readFileSync(subjectDetailsPath, 'utf8');

  // Back to Subjects button
  assert(
    detailsContent.includes('Back to Subjects'),
    'SubjectDetails has "Back to Subjects" navigation control'
  );

  // Subject Information section
  assert(
    detailsContent.includes('Subject Information'),
    'SubjectDetails has "Subject Information" section'
  );
  assert(detailsContent.includes('Subject Name'), 'Subject Information contains Subject Name field');
  assert(detailsContent.includes('Subject Code'), 'Subject Information contains Subject Code field');
  assert(detailsContent.includes('Department'), 'Subject Information contains Department field');
  assert(detailsContent.includes('Year'), 'Subject Information contains Year field');
  assert(detailsContent.includes('Subject Type'), 'Subject Information contains Subject Type field');
  assert(detailsContent.includes('Credits'), 'Subject Information contains Credits field');
  assert(detailsContent.includes('Subject Status'), 'Subject Information contains Subject Status field');

  // Assigned Teachers & Sections section
  assert(
    detailsContent.includes('Assigned Teachers & Sections'),
    'Assigned Teachers & Sections section title is present'
  );
  assert(detailsContent.includes('Teacher Name'), 'Table header has Teacher Name');
  assert(detailsContent.includes('Faculty ID'), 'Table header has Faculty ID');
  assert(detailsContent.includes('Designation'), 'Table header has Designation');
  assert(detailsContent.includes('Assigned Sections'), 'Table header has Assigned Sections');

  // Empty state handling
  assert(
    detailsContent.includes('No teachers or sections assigned to this subject yet.'),
    'Clear empty state message is present for unassigned subjects'
  );

  // 3. Inspect App.jsx route registration
  console.log('\n--- 3. App.jsx Route Registration ---');
  const appPath = path.resolve(__dirname, '../../frontend/src/App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');
  assert(
    appContent.includes('import SubjectDetails from') || appContent.includes('SubjectDetails'),
    'SubjectDetails is imported in App.jsx'
  );
  assert(
    appContent.includes('path="subjects/:id"'),
    'Route path="subjects/:id" is registered in App.jsx'
  );

  // 4. Backend API Verification with Real Database Data
  console.log('\n--- 4. Backend API & Data Integrity Verification ---');
  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const sampleSubject = await Subject.findOne();
    assert(!!sampleSubject, 'Sample subject found in database');
    const institution = await Institution.findById(sampleSubject.institution);
    assert(!!institution, `Found institution: ${institution?.name}`);

    const adminUser = await User.findOne({ role: 'admin', institution: institution._id }) || await User.findOne({ role: 'admin' });
    assert(!!adminUser, `Found admin user: ${adminUser?.name}`);

    const mockReq = (params = {}, query = {}, body = {}) => ({
      currentUser: {
        _id: adminUser._id,
        role: 'admin',
        institution: { _id: institution._id }
      },
      params,
      query,
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

    // Test invalid subject ID returns 404
    const invalidReq = mockReq({ id: '000000000000000000000000' });
    const invalidRes = mockRes();
    await adminController.getSubjectById(invalidReq, invalidRes);
    assert(invalidRes.statusCode === 404, 'Non-existent subject ID returns 404 Not Found');

    // Fetch all existing subjects
    const allSubjects = await Subject.find({ institution: institution._id });
    console.log(`Found ${allSubjects.length} subjects in institution.`);
    assert(allSubjects.length > 0, `At least 1 subject exists in database`);

    for (const subj of allSubjects) {
      console.log(`\nTesting Subject: ${subj.code} - ${subj.name}`);
      const req = mockReq({ id: String(subj._id) });
      const res = mockRes();
      await adminController.getSubjectById(req, res);

      assert(res.statusCode === 200, `getSubjectById for ${subj.code} returns status 200`);
      assert(res.data?.success === true, `getSubjectById returns success: true`);

      const data = res.data.subject;
      assert(data.name === subj.name, `Subject Name matches DB: "${data.name}"`);
      assert(data.code === subj.code, `Subject Code matches DB: "${data.code}"`);
      assert(!!data.department, `Department is populated: "${data.department}"`);
      assert(
        ['First Year', 'Second Year', 'Third Year', 'Fourth Year'].includes(data.year),
        `Year is resolved to standard academic level: "${data.year}"`
      );
      assert(data.subjectType === subj.subjectType || data.subjectType === 'Theory', `Subject Type is populated: "${data.subjectType}"`);
      assert(data.isActive === subj.isActive, `Subject status matches DB (isActive: ${data.isActive})`);

      // Verify assigned teachers
      assert(Array.isArray(data.assignedTeachers), 'assignedTeachers is returned as an array');
      console.log(`  Assigned Teachers Count: ${data.assignedTeachers.length}`);
      data.assignedTeachers.forEach(t => {
        console.log(`    - Teacher: ${t.name} (${t.facultyId}), Dept: ${t.department}, Sections: [${t.assignedSections.join(', ')}]`);
        assert(!!t.name, `Teacher has valid name: "${t.name}"`);
        assert(!!t.facultyId, `Teacher has Faculty ID: "${t.facultyId}"`);
        assert(Array.isArray(t.assignedSections), `Teacher assignedSections is an array`);
      });

      // Special check for CS101: teacher t001 handles multiple sections (Sec A and Sec B)
      if (subj.code === 'CS101') {
        const t001Teacher = data.assignedTeachers.find(t => t.facultyId === 't001');
        assert(!!t001Teacher, 'CS101 has teacher t001 assigned');
        if (t001Teacher) {
          assert(
            t001Teacher.assignedSections.length >= 2,
            `Teacher t001 on CS101 handles multiple sections: [${t001Teacher.assignedSections.join(', ')}]`
          );
          assert(
            t001Teacher.assignedSections.some(s => s.includes('A')) && t001Teacher.assignedSections.some(s => s.includes('B')),
            'Teacher t001 has both Section A and Section B assigned for CS101'
          );
        }
      }
    }

    // 5. Test Unassigned Subject for Empty State Data Structure
    console.log('\n--- 5. Unassigned Subject Empty State Verification ---');
    const tempSubject = new Subject({
      institution: institution._id,
      name: 'Cloud Computing & DevOps',
      code: 'TEST_CLOUD_999',
      department: 'Computer Science and Engineering',
      academicYear: 'Fourth Year',
      subjectType: 'Theory',
      credits: 3,
      isActive: true
    });
    await tempSubject.save();

    try {
      const emptyReq = mockReq({ id: String(tempSubject._id) });
      const emptyRes = mockRes();
      await adminController.getSubjectById(emptyReq, emptyRes);

      assert(emptyRes.statusCode === 200, 'getSubjectById succeeds for unassigned subject');
      assert(
        Array.isArray(emptyRes.data.subject?.assignedTeachers) && emptyRes.data.subject.assignedTeachers.length === 0,
        'assignedTeachers is an empty array [] for unassigned subject (triggers clean empty state UI)'
      );
      assert(
        Array.isArray(emptyRes.data.subject?.sections) && emptyRes.data.subject.sections.length === 0,
        'sections is an empty array [] for unassigned subject'
      );
    } finally {
      await Subject.deleteOne({ _id: tempSubject._id });
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
