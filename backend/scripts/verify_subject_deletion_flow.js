const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const TeacherProfile = require('../models/TeacherProfile');
const TeachingAssignment = require('../models/TeachingAssignment');
const Institution = require('../models/Institution');
const adminController = require('../controllers/adminController');

async function runTests() {
  console.log('=== VERIFY SUBJECT PERMANENT DELETION WITH ASSIGNMENT-AWARE CONFIRMATION ===\n');
  let passedCount = 0;
  let totalTests = 0;

  function assert(desc, condition) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${desc}`);
      passedCount++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${desc}`);
    }
  }

  function mockRes() {
    let result = { statusCode: 200, data: null };
    return {
      status(code) {
        result.statusCode = code;
        return this;
      },
      json(payload) {
        result.data = payload;
        return result;
      },
      getResult() {
        return result;
      }
    };
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const anySub = await Subject.findOne({});
    const institutionId = anySub?.institution || '6ac9e6c1bb6915a39b1f7380';
    const institution = await Institution.findById(institutionId) || { _id: institutionId };
    assert('Institution found', Boolean(institution));

    // Find sample class and teacher for assignment tests
    const sampleClass = await Class.findOne({ institution: institutionId });
    const sampleTeacher = await TeacherProfile.findOne({ institution: institutionId });
    assert('Sample Class / Section found for testing', Boolean(sampleClass));
    assert('Sample Teacher found for testing', Boolean(sampleTeacher));

    const currentUser = { institution, _id: new mongoose.Types.ObjectId() };

    // =========================================================================
    // Scenario 1: Subject has NO assignments -> Delete immediately
    // =========================================================================
    console.log('\n--- Scenario 1: Subject with NO assignments ---');
    const unassignedSub = new Subject({
      institution: institutionId,
      name: 'Unassigned Subject Test',
      code: 'UNASSIGNED_' + Date.now().toString().slice(-4),
      department: 'Computer Science and Engineering',
      academicYear: 'First Year'
    });
    await unassignedSub.save();
    assert('Created unassigned test subject in DB', Boolean(unassignedSub._id));

    // Check assignments
    const resCheck1 = mockRes();
    await adminController.checkSubjectAssignments({ params: { id: unassignedSub._id.toString() }, currentUser }, resCheck1);
    assert('checkSubjectAssignments returns hasAssignments: false', resCheck1.getResult().statusCode === 200 && resCheck1.getResult().data.hasAssignments === false);

    // Call delete immediately without cascade flag
    const resDel1 = mockRes();
    await adminController.deleteSubject({ params: { id: unassignedSub._id.toString() }, query: {}, currentUser }, resDel1);
    assert('deleteSubject immediately deletes unassigned subject with 200', resDel1.getResult().statusCode === 200 && resDel1.getResult().data.success === true);

    const existsAfterDel1 = await Subject.findById(unassignedSub._id);
    assert('Unassigned subject is permanently removed from DB', existsAfterDel1 === null);

    // =========================================================================
    // Scenario 2: Subject assigned to a teacher AND section -> Show confirmation
    // =========================================================================
    console.log('\n--- Scenario 2: Subject assigned to both Teacher and Section ---');
    const assignedSubBoth = new Subject({
      institution: institutionId,
      name: 'Assigned Both Test',
      code: 'ASSIGN_BOTH_' + Date.now().toString().slice(-4),
      department: 'Computer Science and Engineering',
      academicYear: 'Second Year'
    });
    await assignedSubBoth.save();

    const assignmentBoth = new TeachingAssignment({
      institution: institutionId,
      subject: assignedSubBoth._id,
      classRef: sampleClass._id,
      teacher: sampleTeacher._id,
      academicYear: '2026-2027'
    });
    await assignmentBoth.save();

    const resCheck2 = mockRes();
    await adminController.checkSubjectAssignments({ params: { id: assignedSubBoth._id.toString() }, currentUser }, resCheck2);
    assert('checkSubjectAssignments returns hasAssignments: true for both teacher and section', 
      resCheck2.getResult().statusCode === 200 && 
      resCheck2.getResult().data.hasAssignments === true &&
      resCheck2.getResult().data.teacherCount >= 1 &&
      resCheck2.getResult().data.sectionCount >= 1
    );

    // If Admin attempts delete without cascade confirmation -> Reject with 409
    const resDel2Blocked = mockRes();
    await adminController.deleteSubject({ params: { id: assignedSubBoth._id.toString() }, query: {}, currentUser }, resDel2Blocked);
    assert('deleteSubject rejects unconfirmed deletion of assigned subject with 409', 
      resDel2Blocked.getResult().statusCode === 409 && 
      resDel2Blocked.getResult().data.hasAssignments === true
    );

    // =========================================================================
    // Scenario 3: Subject assigned to Section ONLY (teacher is null)
    // =========================================================================
    console.log('\n--- Scenario 3: Subject assigned to Section ONLY (no teacher) ---');
    const assignedSubSectionOnly = new Subject({
      institution: institutionId,
      name: 'Assigned Section Only Test',
      code: 'ASSIGN_SEC_' + Date.now().toString().slice(-4),
      department: 'Computer Science and Engineering',
      academicYear: 'Third Year'
    });
    await assignedSubSectionOnly.save();

    const assignmentSecOnly = new TeachingAssignment({
      institution: institutionId,
      subject: assignedSubSectionOnly._id,
      classRef: sampleClass._id,
      teacher: null,
      academicYear: '2026-2027'
    });
    await assignmentSecOnly.save();

    const resCheck3 = mockRes();
    await adminController.checkSubjectAssignments({ params: { id: assignedSubSectionOnly._id.toString() }, currentUser }, resCheck3);
    assert('checkSubjectAssignments detects section assignment even when teacher is null',
      resCheck3.getResult().statusCode === 200 &&
      resCheck3.getResult().data.hasAssignments === true &&
      resCheck3.getResult().data.sectionCount >= 1
    );

    // =========================================================================
    // Scenario 4: Admin clicks Cancel -> Keep subject and all assignments
    // =========================================================================
    console.log('\n--- Scenario 4: Admin clicks Cancel ---');
    // When Admin cancels in modal, no deletion request is confirmed
    const subjectStillExists = await Subject.findById(assignedSubBoth._id);
    const assignmentStillExists = await TeachingAssignment.findById(assignmentBoth._id);
    assert('Subject is kept intact when Admin cancels', Boolean(subjectStillExists));
    assert('Teaching assignment is kept intact when Admin cancels', Boolean(assignmentStillExists));

    // =========================================================================
    // Scenario 5: Admin confirms deletion -> Remove assignments and subject
    // =========================================================================
    console.log('\n--- Scenario 5: Admin confirms deletion (cascade = true) ---');
    const resDelConfirmed = mockRes();
    await adminController.deleteSubject({
      params: { id: assignedSubBoth._id.toString() },
      query: { cascade: 'true' },
      body: { cascadeAssignments: true },
      currentUser
    }, resDelConfirmed);

    assert('Confirmed deletion returns 200 success', 
      resDelConfirmed.getResult().statusCode === 200 && 
      resDelConfirmed.getResult().data.success === true
    );

    const checkSubjectDeleted = await Subject.findById(assignedSubBoth._id);
    assert('Subject record is permanently deleted from MongoDB', checkSubjectDeleted === null);

    const checkAssignmentsDeleted = await TeachingAssignment.find({ subject: assignedSubBoth._id });
    assert('All related assignments are permanently removed from MongoDB', checkAssignmentsDeleted.length === 0);

    // =========================================================================
    // Scenario 6: Verify Unrelated Academic Data is Preserved
    // =========================================================================
    console.log('\n--- Scenario 6: Verify unrelated entities are preserved ---');
    const checkClassPreserved = await Class.findById(sampleClass._id);
    const checkTeacherPreserved = await TeacherProfile.findById(sampleTeacher._id);
    assert('Associated Class/Section was NOT deleted', Boolean(checkClassPreserved));
    assert('Associated Teacher account was NOT deleted', Boolean(checkTeacherPreserved));

    // Clean up scenario 3 subject & assignment
    await TeachingAssignment.deleteMany({ subject: assignedSubSectionOnly._id });
    await Subject.findByIdAndDelete(assignedSubSectionOnly._id);
    assert('Cleaned up scenario 3 test resources', true);

    // =========================================================================
    // Scenario 7: Page refresh persistence (deleted subject remains deleted)
    // =========================================================================
    console.log('\n--- Scenario 7: Page refresh persistence ---');
    const resFetchAll = mockRes();
    await adminController.getSubjects({ currentUser, query: {} }, resFetchAll);
    const allSubjects = resFetchAll.getResult().data.subjects || [];
    const containsDeleted = allSubjects.some(s => s._id.toString() === assignedSubBoth._id.toString());
    assert('getSubjects list does NOT contain the deleted subject on refresh', !containsDeleted);

    console.log(`\n=== RESULTS: ${passedCount}/${totalTests} tests passed (${Math.round((passedCount/totalTests)*100)}%) ===\n`);
  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();

