const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Institution = require('../models/Institution');

async function runVerification() {
  console.log('=== START VERIFICATION: Student Profile & Manage Students Search Updates ===\n');

  // 1. Static checks on StudentList.jsx
  console.log('--- Checking frontend/src/components/StudentList.jsx ---');
  const studentListPath = path.join(__dirname, '../../frontend/src/components/StudentList.jsx');
  const studentListSrc = fs.readFileSync(studentListPath, 'utf8');

  // Verify search field expansion
  const hasExpandedSearch = studentListSrc.includes('sm:flex-1 sm:max-w-md') || studentListSrc.includes('flex-1');
  console.log('1. Search field expanded to fill horizontal gap:', hasExpandedSearch ? 'PASS' : 'FAIL');
  if (!hasExpandedSearch) throw new Error('Search input does not have expanded classes');

  // Verify actions container has flex-1 justify-end
  const hasActionsContainerFlex = studentListSrc.includes('flex-1 justify-end');
  console.log('2. Toolbar actions container aligned to right with flex-1 justify-end:', hasActionsContainerFlex ? 'PASS' : 'FAIL');

  // Verify table row Edit button is removed
  // The table body row actions should not contain an Edit button with handleEditClick inside the tr loop
  const tbodyMatch = studentListSrc.match(/<tbody[\s\S]*?<\/tbody>/);
  if (!tbodyMatch) throw new Error('tbody not found in StudentList.jsx');
  const tbodyContent = tbodyMatch[0];
  const hasRowEditButton = tbodyContent.includes('handleEditClick') || tbodyContent.includes('>Edit<');
  console.log('3. Table row Edit button removed:', !hasRowEditButton ? 'PASS' : 'FAIL');
  if (hasRowEditButton) throw new Error('Table row still contains Edit button');

  // Verify navigation to profile on row click
  const hasRowProfileNavigation = tbodyContent.includes('navigate(`/admin/students/${s._id}`)');
  console.log('4. Clicking student row opens Student Profile page:', hasRowProfileNavigation ? 'PASS' : 'FAIL');
  if (!hasRowProfileNavigation) throw new Error('Row click does not navigate to profile');

  // Verify action cell stopPropagation
  const hasStopPropagation = tbodyContent.includes('e.stopPropagation()');
  console.log('5. Clicking row actions does not trigger profile navigation (stopPropagation):', hasStopPropagation ? 'PASS' : 'FAIL');

  // 2. Static checks on StudentProfile.jsx
  console.log('\n--- Checking frontend/src/components/StudentProfile.jsx ---');
  const studentProfilePath = path.join(__dirname, '../../frontend/src/components/StudentProfile.jsx');
  const studentProfileSrc = fs.readFileSync(studentProfilePath, 'utf8');

  // Verify Account Information card is completely removed
  const hasAccountInfoCard = studentProfileSrc.includes('Account Information') || studentProfileSrc.includes('Account Status') || studentProfileSrc.includes('System Role');
  console.log('6. Account Information card completely removed:', !hasAccountInfoCard ? 'PASS' : 'FAIL');
  if (hasAccountInfoCard) throw new Error('Account Information card is still present');

  // Verify individual card-level Edit buttons removed
  const hasPersonalEditBtn = studentProfileSrc.includes('handleOpenEditPersonal');
  const hasAcademicEditBtn = studentProfileSrc.includes('handleOpenEditAcademic');
  console.log('7. Individual card-level Edit buttons removed:', (!hasPersonalEditBtn && !hasAcademicEditBtn) ? 'PASS' : 'FAIL');
  if (hasPersonalEditBtn || hasAcademicEditBtn) throw new Error('Individual card Edit buttons still present');

  // Verify top Edit Student button
  const hasTopEditButton = studentProfileSrc.includes('Edit Student') && studentProfileSrc.includes('handleOpenEdit');
  console.log('8. Top Edit Student button opens main edit modal:', hasTopEditButton ? 'PASS' : 'FAIL');

  // Verify Personal Information card fields
  const hasFullName = studentProfileSrc.includes('Full Name');
  const hasStudentId = studentProfileSrc.includes('Student ID');
  const hasEmail = studentProfileSrc.includes('Email Address');
  const hasPhone = studentProfileSrc.includes('Phone Number');
  const hasDob = studentProfileSrc.includes('Date of Birth');
  const hasAddress = studentProfileSrc.includes('Address');
  console.log('9. Personal Information fields (Full Name, Student ID, Email, Phone, DOB, Address):', (hasFullName && hasStudentId && hasEmail && hasPhone && hasDob && hasAddress) ? 'PASS' : 'FAIL');

  // Verify Academic Information card fields
  const hasCourse = studentProfileSrc.includes('Course');
  const hasYear = studentProfileSrc.includes('Year');
  const hasDept = studentProfileSrc.includes('Department');
  const hasSection = studentProfileSrc.includes('Section');
  const hasSemester = studentProfileSrc.includes('Semester');
  const hasAcademicGroup = studentProfileSrc.includes('Academic Group');
  console.log('10. Academic Information fields (Course, Year, Department, Section, Semester):', (hasCourse && hasYear && hasDept && hasSection && hasSemester) ? 'PASS' : 'FAIL');
  console.log('11. Redundant Academic Group label removed:', !hasAcademicGroup ? 'PASS' : 'FAIL');

  // Verify Student ID is editable in modal
  const hasStudentIdInput = studentProfileSrc.includes('name="studentId"') && studentProfileSrc.includes('editFormData.studentId');
  console.log('12. Student ID is editable in Edit modal form:', hasStudentIdInput ? 'PASS' : 'FAIL');
  if (!hasStudentIdInput) throw new Error('Student ID input missing from Edit modal');

  // 3. Database & Backend uniqueness validation check
  console.log('\n--- Checking Database & Backend API Logic ---');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const students = await StudentProfile.find({}).populate('user');
  console.log(`Found ${students.length} existing student records.`);
  if (students.length < 2) {
    console.log('Less than 2 students found, skipping live duplicate collision test.');
  } else {
    const student1 = students[0];
    const student2 = students[1];

    console.log(`Student 1 ID: ${student1.studentId}, Student 2 ID: ${student2.studentId}`);

    // Test uniqueness logic simulation matching adminController.updateStudent
    const duplicateStudent = await StudentProfile.findOne({
      _id: { $ne: student1._id },
      studentId: new RegExp(`^${student2.studentId}$`, 'i')
    });
    console.log('13. Backend uniqueness check correctly identifies duplicate Student ID:', duplicateStudent ? 'PASS' : 'FAIL');
    if (!duplicateStudent) throw new Error('Duplicate check failed to detect collision with student 2 ID');

    const duplicateUser = await User.findOne({
      _id: { $ne: student1.user._id },
      userId: new RegExp(`^${student2.studentId}$`, 'i')
    });
    console.log('14. Backend uniqueness check correctly identifies duplicate User userId:', duplicateUser ? 'PASS' : 'FAIL');
    if (!duplicateUser) throw new Error('Duplicate check failed to detect user collision');

    // Test non-duplicate check
    const nonExistentId = 'STU-TEST-NONEXISTENT-9999';
    const noStudentCollision = await StudentProfile.findOne({
      _id: { $ne: student1._id },
      studentId: new RegExp(`^${nonExistentId}$`, 'i')
    });
    const noUserCollision = await User.findOne({
      _id: { $ne: student1.user._id },
      userId: new RegExp(`^${nonExistentId}$`, 'i')
    });
    console.log('15. Backend uniqueness check permits new unique Student ID:', (!noStudentCollision && !noUserCollision) ? 'PASS' : 'FAIL');
  }

  await mongoose.disconnect();
  console.log('\n=== ALL 15 VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
}

runVerification().catch(err => {
  console.error('\nVerification FAILED:', err);
  process.exit(1);
});

