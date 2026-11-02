const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });
const TeachingAssignment = require('../models/TeachingAssignment');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const TeacherProfile = require('../models/TeacherProfile');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const assignments = await TeachingAssignment.find({})
    .populate('subject')
    .populate('classRef')
    .populate('teacher', 'teacherId personalInfo');

  console.log('Total TeachingAssignments in DB:', assignments.length);
  assignments.forEach(a => {
    console.log(JSON.stringify({
      id: a._id,
      subjectCode: a.subject?.code,
      subjectName: a.subject?.name,
      subjectDept: a.subject?.department,
      subjectAcademicYear: a.subject?.academicYear,
      assignmentAcademicYear: a.academicYear,
      classSection: a.classRef?.section,
      classYearOfStudy: a.classRef?.yearOfStudy,
      classAcademicYear: a.classRef?.academicYear,
      teacherId: a.teacher?.teacherId || null,
      teacherName: a.teacher?.personalInfo?.name || null,
      isActive: a.isActive
    }));
  });
  await mongoose.disconnect();
}
check();

