const fs = require('fs');
const path = require('path');

function runTests() {
  console.log('--- STARTING SUBJECTS EQUAL WIDTH CONTROLS VERIFICATION ---\n');
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

  const subjectListPath = path.resolve(__dirname, '../../frontend/src/components/SubjectList.jsx');
  const content = fs.readFileSync(subjectListPath, 'utf8');

  // 1. Verify Toolbar Layout and Order
  const allYearsIdx = content.indexOf('aria-label="Filter by Academic Year"');
  const allDeptsIdx = content.indexOf('aria-label="Filter by Department"');
  const searchIdx = content.indexOf('placeholder="Search name or code..."');
  const addSubjectIdx = content.indexOf('Add Subject\n');

  assert(allYearsIdx !== -1, 'All Years dropdown exists in toolbar');
  assert(allDeptsIdx !== -1, 'All Departments dropdown exists in toolbar');
  assert(searchIdx !== -1, 'Search input exists in toolbar');
  assert(addSubjectIdx !== -1, 'Add Subject button exists in toolbar');

  assert(
    allYearsIdx < allDeptsIdx && allDeptsIdx < searchIdx && searchIdx < addSubjectIdx,
    'Controls are in exact left-to-right order: All Years -> All Departments -> Search -> Add Subject'
  );

  // 2. Verify Equal Width Styling on All Three Controls
  // All Years, All Departments, and Search Wrapper must all have sm:flex-1 and sm:min-w-0
  const allYearsBlock = content.slice(allYearsIdx - 400, allYearsIdx + 100);
  assert(
    allYearsBlock.includes('sm:flex-1') && allYearsBlock.includes('sm:min-w-0'),
    'All Years dropdown has sm:flex-1 and sm:min-w-0 for equal space distribution'
  );

  const allDeptsBlock = content.slice(allDeptsIdx - 400, allDeptsIdx + 100);
  assert(
    allDeptsBlock.includes('sm:flex-1') && allDeptsBlock.includes('sm:min-w-0'),
    'All Departments dropdown has sm:flex-1 and sm:min-w-0 for equal space distribution'
  );

  const searchBlock = content.slice(searchIdx - 300, searchIdx);
  assert(
    searchBlock.includes('sm:flex-1') && searchBlock.includes('sm:min-w-0'),
    'Search input wrapper has sm:flex-1 and sm:min-w-0 for equal space distribution'
  );

  // 3. Verify Equal Height (h-10) and consistent padding/styling across all controls
  assert(allYearsBlock.includes('h-10'), 'All Years dropdown has h-10 height');
  assert(allDeptsBlock.includes('h-10'), 'All Departments dropdown has h-10 height');
  assert(content.includes('w-full h-10 pl-10 pr-4 py-2 border'), 'Search input has h-10 height with proper padding');

  // 4. Verify Add Subject button maintains dimensions and shrink-0
  const addSubjectBlock = content.slice(addSubjectIdx - 150, addSubjectIdx + 50);
  assert(
    addSubjectBlock.includes('shrink-0'),
    'Add Subject button retains shrink-0 and preserves its dimensions'
  );

  // 5. Verify filter options and functionality
  assert(content.includes('<option value="">All Years</option>'), 'All Years option present');
  assert(content.includes('<option value="">All Departments</option>'), 'All Departments option present');
  assert(content.includes('value={filterYear}') && content.includes('setFilterYear'), 'filterYear state connected');
  assert(content.includes('value={filterDepartment}') && content.includes('setFilterDepartment'), 'filterDepartment state connected');
  assert(content.includes('value={searchTerm}') && content.includes('setSearchTerm'), 'searchTerm state connected');

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
