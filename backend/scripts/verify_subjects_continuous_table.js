const fs = require('fs');
const content = fs.readFileSync('./frontend/src/components/SubjectList.jsx', 'utf8');

let pass = 0;
let fail = 0;
function test(desc, cond) {
  if (cond) {
    console.log('[PASS]', desc);
    pass++;
  } else {
    console.error('[FAIL]', desc);
    fail++;
  }
}

console.log('=== VERIFY ADMIN SUBJECTS CONTINUOUS TABLE UPDATE ===\n');

// 1. No separator rows or headings
test('No group.title separator rows', !content.includes('{group.title}'));
test('No divider row classes in table body', !content.includes('uppercase tracking-wider'));
test('No unassigned year divider', !content.includes('Other / Unassigned Year Subjects'));
test('No count badges in table rows', !content.includes('groupSubjects.length'));

// 2. Direct continuous table mapping
test('Table maps directly over sortedFiltered', content.includes('{sortedFiltered.map((s) => ('));

// 3. Year column present and displays individual subject year
test('Year column header present', content.includes('<th className="px-4 py-3 font-medium">Year</th>'));
test('Year column cell calls getDisplayYear(resolveSubjectYear(s))', content.includes('{getDisplayYear(resolveSubjectYear(s))}'));

// 4. Wider All Years dropdown
test('All Years dropdown has flex-1 to fill toolbar space', content.includes('flex-1 min-w-0 px-3 py-2 border'));

// 5. Exact toolbar order
const yIdx = content.indexOf('aria-label="Filter by Academic Year"');
const dIdx = content.indexOf('aria-label="Filter by Department"');
const sIdx = content.indexOf('placeholder="Search name or code..."');
const aIdx = content.indexOf('onClick={handleOpenCreate}');
test('Toolbar order strictly: 1. All Years -> 2. All Departments -> 3. Search -> 4. Add Subject', yIdx !== -1 && yIdx < dIdx && dIdx < sIdx && sIdx < aIdx);

// 6. Year sorting order in sortedFiltered
test('sortedFiltered sort logic orders by getYearOrder', content.includes('const orderA = getYearOrder(a);'));

console.log(`\n=== RESULTS: ${pass}/${pass + fail} tests passed ===`);
if (fail > 0) process.exit(1);
