const fs = require('fs');
const path = require('path');

function runTests() {
  console.log('--- STARTING ADMIN SUBJECTS FILTER WIDTHS VERIFICATION ---\n');
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

  // 1. Verify Toolbar Layout and Exact Order: All Years -> All Departments -> Search -> Add Subject
  const allYearsIdx = content.indexOf('aria-label="Filter by Academic Year"');
  const allDeptsIdx = content.indexOf('aria-label="Filter by Department"');
  const searchIdx = content.indexOf('placeholder="Search name or code..."');
  const addSubjectIdx = content.indexOf('>Add Subject<') !== -1 ? content.indexOf('>Add Subject<') : content.indexOf('Add Subject\n');

  assert(allYearsIdx !== -1, 'All Years dropdown exists in toolbar');
  assert(allDeptsIdx !== -1, 'All Departments dropdown exists in toolbar');
  assert(searchIdx !== -1, 'Search input exists in toolbar');
  assert(addSubjectIdx !== -1, 'Add Subject button exists in toolbar');

  assert(
    allYearsIdx < allDeptsIdx && allDeptsIdx < searchIdx && searchIdx < addSubjectIdx,
    'Controls are in exact left-to-right order: All Years -> All Departments -> Search -> Add Subject'
  );

  // 2. Verify All Years dropdown width styling
  assert(
    content.includes('className="w-full sm:flex-1 min-w-[160px] sm:min-w-[180px] px-3 py-2 border'),
    'All Years dropdown has responsive flex-1 and min-w-[180px] to occupy available space without truncation'
  );

  // 3. Verify All Departments dropdown width styling
  assert(
    content.includes('className="w-full sm:w-52 shrink-0 px-3 py-2 border'),
    'All Departments dropdown has controlled sm:w-52 (208px) width, proportionally narrower than All Years'
  );
  assert(
    content.includes('All Departments</option>'),
    'All Departments label option is fully intact'
  );

  // 4. Verify Options in All Years Dropdown
  assert(content.includes('<option value="">All Years</option>'), 'All Years contains "All Years" option');
  assert(content.includes('<option value="First Year">First Year</option>'), 'All Years contains "First Year" option');
  assert(content.includes('<option value="Second Year">Second Year</option>'), 'All Years contains "Second Year" option');
  assert(content.includes('<option value="Third Year">Third Year</option>'), 'All Years contains "Third Year" option');
  assert(content.includes('<option value="Fourth Year">Fourth Year</option>'), 'All Years contains "Fourth Year" option');

  // 5. Verify Filter and Search functionality preserved
  assert(content.includes('value={filterYear}') && content.includes('setFilterYear'), 'filterYear state is properly connected');
  assert(content.includes('value={filterDepartment}') && content.includes('setFilterDepartment'), 'filterDepartment state is properly connected');
  assert(content.includes('value={searchTerm}') && content.includes('setSearchTerm'), 'searchTerm state is properly connected');
  assert(content.includes('onClick={handleOpenCreate}'), 'Add Subject button handler is preserved');

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

