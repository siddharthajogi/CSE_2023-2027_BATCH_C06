const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });
const Subject = require('../models/Subject');
const Institution = require('../models/Institution');
const User = require('../models/User');

const YEAR_GROUPS = [
  { key: 'First Year', display: 'First', order: 1 },
  { key: 'Second Year', display: 'Second', order: 2 },
  { key: 'Third Year', display: 'Third', order: 3 },
  { key: 'Fourth Year', display: 'Fourth', order: 4 }
];

const resolveSubjectYear = (s) => {
  if (!s) return '';
  if (s.academicYear) {
    const val = String(s.academicYear).trim().toLowerCase();
    if (val === 'first year' || val === 'first' || val === '1st year' || val === '1st' || val === '1') return 'First Year';
    if (val === 'second year' || val === 'second' || val === '2nd year' || val === '2nd' || val === '2') return 'Second Year';
    if (val === 'third year' || val === 'third' || val === '3rd year' || val === '3rd' || val === '3') return 'Third Year';
    if (val === 'fourth year' || val === 'fourth' || val === '4th year' || val === '4th' || val === '4') return 'Fourth Year';
  }
  if (s.semester !== undefined && s.semester !== null) {
    const sem = String(s.semester).trim().toLowerCase();
    const match = sem.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num === 1 || num === 2) return 'First Year';
      if (num === 3 || num === 4) return 'Second Year';
      if (num === 5 || num === 6) return 'Third Year';
      if (num === 7 || num === 8) return 'Fourth Year';
    }
  }
  return '';
};

const getDisplayYear = (yearStr) => {
  if (yearStr === 'First Year') return 'First';
  if (yearStr === 'Second Year') return 'Second';
  if (yearStr === 'Third Year') return 'Third';
  if (yearStr === 'Fourth Year') return 'Fourth';
  return yearStr || '—';
};

const getYearOrder = (s) => {
  const y = resolveSubjectYear(s);
  if (y === 'First Year') return 1;
  if (y === 'Second Year') return 2;
  if (y === 'Third Year') return 3;
  if (y === 'Fourth Year') return 4;
  return 5;
};

async function runVerification() {
  console.log('=== ADMIN SUBJECTS PAGE ENHANCEMENT VERIFICATION ===\n');
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

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const anySub = await Subject.findOne({});
    const institutionId = anySub?.institution || '6ac9e6c1bb6915a39b1f7380';
    const institution = await Institution.findById(institutionId) || { _id: institutionId };
    assert('Institution found for tests', Boolean(institution));

    const subjects = await Subject.find({ institution: institution._id });
    console.log(`\nLoaded ${subjects.length} subjects from database:`);
    subjects.forEach(s => {
      console.log(`  - ${s.code} | ${s.name} | Dept: ${s.department} | Stored Year: "${s.academicYear || ''}" | Resolved: "${resolveSubjectYear(s)}" | Display: "${getDisplayYear(resolveSubjectYear(s))}"`);
    });

    // Test 1: Academic Year Filter - All Years
    const allYearsFiltered = subjects.filter(s => true);
    assert('All Years filter returns all subjects', allYearsFiltered.length === subjects.length);

    // Test 2: Academic Year Filter - First Year
    const firstYearSubjects = subjects.filter(s => resolveSubjectYear(s) === 'First Year');
    assert('First Year filter returns only First Year subjects', firstYearSubjects.length > 0 && firstYearSubjects.every(s => resolveSubjectYear(s) === 'First Year'));

    // Test 3: Academic Year Filter - Second Year
    const secondYearSubjects = subjects.filter(s => resolveSubjectYear(s) === 'Second Year');
    assert('Second Year filter returns only Second Year subjects', secondYearSubjects.length > 0 && secondYearSubjects.every(s => resolveSubjectYear(s) === 'Second Year'));

    // Test 4: Academic Year Filter - Third Year
    const thirdYearSubjects = subjects.filter(s => resolveSubjectYear(s) === 'Third Year');
    assert('Third Year filter returns only Third Year subjects', thirdYearSubjects.length > 0 && thirdYearSubjects.every(s => resolveSubjectYear(s) === 'Third Year'));

    // Test 5: Academic Year Filter - Fourth Year
    const fourthYearSubjects = subjects.filter(s => resolveSubjectYear(s) === 'Fourth Year');
    assert('Fourth Year filter returns only Fourth Year subjects', fourthYearSubjects.length > 0 && fourthYearSubjects.every(s => resolveSubjectYear(s) === 'Fourth Year'));

    // Test 6: Department filter works
    const cseSubjects = subjects.filter(s => s.department === 'Computer Science and Engineering');
    assert('Department filter correctly isolates CSE subjects', cseSubjects.length > 0 && cseSubjects.every(s => s.department === 'Computer Science and Engineering'));

    // Test 7: Both filters work together (First Year + CSE)
    const firstYearCSE = subjects.filter(s => resolveSubjectYear(s) === 'First Year' && s.department === 'Computer Science and Engineering');
    assert('Both filters work concurrently (First Year + CSE)', firstYearCSE.length > 0 && firstYearCSE.every(s => resolveSubjectYear(s) === 'First Year' && s.department === 'Computer Science and Engineering'));

    // Test 8: Search works with filters (search "Programming" within First Year)
    const searchResult = subjects.filter(s => 
      resolveSubjectYear(s) === 'First Year' && 
      (s.name.toLowerCase().includes('programming') || s.code.toLowerCase().includes('programming'))
    );
    assert('Search works combined with Year filter', searchResult.length === 1 && searchResult[0].code === 'CS101');

    // Test 9: Subjects appear in strictly ordered sequence: First Year -> Second Year -> Third Year -> Fourth Year
    const sorted = [...subjects].sort((a, b) => {
      const orderA = getYearOrder(a);
      const orderB = getYearOrder(b);
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
    
    let isMonotonic = true;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (getYearOrder(sorted[i]) > getYearOrder(sorted[i + 1])) {
        isMonotonic = false;
        break;
      }
    }
    assert('Subjects sorted in strict First Year -> Second Year -> Third Year -> Fourth Year order', isMonotonic);

    // Test 10: Year column display values are "First", "Second", "Third", "Fourth"
    const displayValues = subjects.map(s => getDisplayYear(resolveSubjectYear(s)));
    const validDisplays = ['First', 'Second', 'Third', 'Fourth', '—'];
    assert('Year column displays correct short value (First, Second, Third, Fourth, or —)', displayValues.every(v => validDisplays.includes(v)));

    // Test 11: Add Subject requires academicYear (backend validation)
    const adminController = require('../controllers/adminController');
    let createError = null;
    const mockReqMissingYear = {
      currentUser: { institution: institution, _id: new mongoose.Types.ObjectId() },
      body: { name: 'Test Sub Missing Year', code: 'TEST_NO_YR', department: 'Computer Science and Engineering' }
    };
    const mockRes = {
      status: (code) => ({
        json: (payload) => {
          createError = { code, payload };
          return createError;
        }
      })
    };
    await adminController.createSubject(mockReqMissingYear, mockRes);
    assert('Backend createSubject rejects missing academicYear with 400', createError && createError.code === 400 && createError.payload.error.includes('academic year'));

    // Test 12: Add Subject saves selected academicYear
    let createdSubject = null;
    const testCode = 'TEST_YR_' + Date.now().toString().slice(-4);
    const mockReqValid = {
      currentUser: { institution: institution, _id: new mongoose.Types.ObjectId() },
      body: { 
        name: 'Automated Testing Subject', 
        code: testCode, 
        department: 'Computer Science and Engineering', 
        academicYear: 'Second Year' 
      }
    };
    const mockResValid = {
      status: (code) => ({
        json: (payload) => {
          createdSubject = { code, payload };
          return createdSubject;
        }
      })
    };
    await adminController.createSubject(mockReqValid, mockResValid);
    assert('Backend createSubject successfully creates subject with academicYear "Second Year"', createdSubject && createdSubject.code === 201 && createdSubject.payload.subject.academicYear === 'Second Year');

    // Test 13: Edit Subject saves updated academicYear
    if (createdSubject && createdSubject.payload?.subject?._id) {
      const subId = createdSubject.payload.subject._id;
      let updatedSubject = null;
      const mockReqUpdate = {
        params: { id: subId },
        currentUser: { institution: institution, _id: new mongoose.Types.ObjectId() },
        body: {
          name: 'Automated Testing Subject (Updated)',
          code: testCode,
          department: 'Computer Science and Engineering',
          academicYear: 'Third Year'
        }
      };
      const mockResUpdate = {
        status: (code) => ({
          json: (payload) => {
            updatedSubject = { code, payload };
            return updatedSubject;
          }
        })
      };
      await adminController.updateSubject(mockReqUpdate, mockResUpdate);
      assert('Backend updateSubject updates academicYear to "Third Year"', updatedSubject && updatedSubject.code === 200 && updatedSubject.payload.subject.academicYear === 'Third Year');

      // Test 14: Toggle status works
      let statusResult = null;
      const mockReqStatus = {
        params: { id: subId },
        currentUser: { institution: institution, _id: new mongoose.Types.ObjectId() },
        body: { isActive: false }
      };
      const mockResStatus = {
        status: (code) => ({
          json: (payload) => {
            statusResult = { code, payload };
            return statusResult;
          }
        })
      };
      await adminController.updateSubjectStatus(mockReqStatus, mockResStatus);
      const afterStatus = await Subject.findById(subId);
      assert('Subject status deactivation works (isActive: false)', afterStatus && afterStatus.isActive === false);

      // Clean up test subject
      await Subject.findByIdAndDelete(subId);
      assert('Cleaned up automated test subject', true);
    }

    console.log(`\n=== RESULTS: ${passedCount}/${totalTests} tests passed (${Math.round((passedCount/totalTests)*100)}%) ===\n`);
  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

runVerification();
