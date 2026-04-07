import * as mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/talentlens';

const userSchema = new mongoose.Schema({
  email: String, password: String, firstName: String, lastName: String,
  role: String, company: String, isActive: Boolean, lastLoginAt: Date,
}, { timestamps: true });

const jobSchema = new mongoose.Schema({
  title: String, description: String, department: String, location: String,
  employmentType: String, requiredSkills: [{ name: String, weight: Number, required: Boolean }],
  experienceLevel: String, minExperienceYears: Number, maxExperienceYears: Number,
  educationRequirements: [{ level: String, field: String, required: Boolean }],
  status: String, recruiterId: mongoose.Types.ObjectId,
  totalApplicants: Number, totalScreenings: Number,
}, { timestamps: true });

const applicantSchema = new mongoose.Schema({
  jobId: mongoose.Types.ObjectId, source: String,
  firstName: String, lastName: String, email: String, phone: String,
  skills: [{ name: String, yearsOfExperience: Number }],
  totalExperienceYears: Number, currentTitle: String, currentCompany: String,
  workHistory: [{ title: String, company: String, description: String }],
  education: [{ degree: String, field: String, institution: String, graduationYear: Number }],
  certifications: [String], rawData: {},
}, { timestamps: true });

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const User = mongoose.model('User', userSchema, 'users');
  const Job = mongoose.model('Job', jobSchema, 'jobs');
  const Applicant = mongoose.model('Applicant', applicantSchema, 'applicants');

  // Clear existing data
  await User.deleteMany({});
  await Job.deleteMany({});
  await Applicant.deleteMany({});

  // Create demo recruiter
  const password = await bcrypt.hash('Demo123!', 12);
  const recruiter = await User.create({
    email: 'demo@talentlens.ai',
    password,
    firstName: 'Demo',
    lastName: 'Recruiter',
    role: 'RECRUITER',
    company: 'TechCorp Rwanda',
    isActive: true,
  });
  console.log('Created recruiter: demo@talentlens.ai / Demo123!');

  // Create sample jobs
  const jobs = await Job.insertMany([
    {
      title: 'Senior Frontend Developer',
      description: 'We are looking for an experienced frontend developer to lead our React-based product team. The ideal candidate has deep expertise in modern React patterns, TypeScript, and building performant user interfaces. You will work closely with designers and backend engineers to deliver exceptional user experiences.',
      department: 'Engineering',
      location: 'Kigali, Rwanda',
      employmentType: 'FULL_TIME',
      experienceLevel: 'SENIOR',
      minExperienceYears: 5,
      maxExperienceYears: 10,
      requiredSkills: [
        { name: 'React', weight: 5, required: true },
        { name: 'TypeScript', weight: 5, required: true },
        { name: 'Next.js', weight: 4, required: false },
        { name: 'Tailwind CSS', weight: 3, required: false },
        { name: 'GraphQL', weight: 3, required: false },
        { name: 'Testing', weight: 4, required: true },
      ],
      educationRequirements: [{ level: 'BACHELORS', field: 'Computer Science', required: false }],
      status: 'OPEN',
      recruiterId: recruiter._id,
      totalApplicants: 15,
      totalScreenings: 0,
    },
    {
      title: 'Data Scientist',
      description: 'Join our data team to build ML models that power our recommendation engine. You will work with large datasets, design experiments, and deploy models to production. Strong Python skills and experience with deep learning frameworks required.',
      department: 'Data Science',
      location: 'Remote',
      employmentType: 'FULL_TIME',
      experienceLevel: 'MID',
      minExperienceYears: 3,
      maxExperienceYears: 7,
      requiredSkills: [
        { name: 'Python', weight: 5, required: true },
        { name: 'Machine Learning', weight: 5, required: true },
        { name: 'TensorFlow/PyTorch', weight: 4, required: true },
        { name: 'SQL', weight: 4, required: true },
        { name: 'Statistics', weight: 4, required: true },
        { name: 'NLP', weight: 3, required: false },
      ],
      educationRequirements: [{ level: 'MASTERS', field: 'Computer Science or Statistics', required: false }],
      status: 'OPEN',
      recruiterId: recruiter._id,
      totalApplicants: 10,
      totalScreenings: 0,
    },
  ]);
  console.log(`Created ${jobs.length} jobs`);

  // Create sample applicants for the frontend job
  const frontendJobId = jobs[0]._id;
  const frontendApplicants = [
    { firstName: 'Jean', lastName: 'Habimana', email: 'jean@example.com', skills: [{ name: 'React', yearsOfExperience: 6 }, { name: 'TypeScript', yearsOfExperience: 4 }, { name: 'Next.js', yearsOfExperience: 3 }, { name: 'Tailwind CSS', yearsOfExperience: 3 }], totalExperienceYears: 8, currentTitle: 'Lead Frontend Developer', currentCompany: 'Kigali Tech', education: [{ degree: 'BACHELORS', field: 'Computer Science', institution: 'University of Rwanda', graduationYear: 2016 }] },
    { firstName: 'Aline', lastName: 'Uwimana', email: 'aline@example.com', skills: [{ name: 'React', yearsOfExperience: 4 }, { name: 'TypeScript', yearsOfExperience: 3 }, { name: 'Vue.js', yearsOfExperience: 2 }, { name: 'GraphQL', yearsOfExperience: 2 }], totalExperienceYears: 5, currentTitle: 'Senior Frontend Engineer', currentCompany: 'Africa Fintech', education: [{ degree: 'BACHELORS', field: 'Software Engineering', institution: 'ALU', graduationYear: 2019 }] },
    { firstName: 'Patrick', lastName: 'Niyonzima', email: 'patrick@example.com', skills: [{ name: 'React', yearsOfExperience: 7 }, { name: 'TypeScript', yearsOfExperience: 5 }, { name: 'Next.js', yearsOfExperience: 4 }, { name: 'Testing', yearsOfExperience: 5 }, { name: 'GraphQL', yearsOfExperience: 3 }], totalExperienceYears: 9, currentTitle: 'Staff Engineer', currentCompany: 'Global SaaS Corp', education: [{ degree: 'MASTERS', field: 'Computer Science', institution: 'Carnegie Mellon Africa', graduationYear: 2015 }] },
    { firstName: 'Grace', lastName: 'Mukeshimana', email: 'grace@example.com', skills: [{ name: 'React', yearsOfExperience: 3 }, { name: 'JavaScript', yearsOfExperience: 4 }, { name: 'CSS', yearsOfExperience: 4 }], totalExperienceYears: 4, currentTitle: 'Frontend Developer', currentCompany: 'StartupHub', education: [{ degree: 'DIPLOMA', field: 'Web Development', institution: 'Rwanda Coding Academy', graduationYear: 2020 }] },
    { firstName: 'Eric', lastName: 'Ndayisaba', email: 'eric@example.com', skills: [{ name: 'React', yearsOfExperience: 5 }, { name: 'TypeScript', yearsOfExperience: 4 }, { name: 'Node.js', yearsOfExperience: 5 }, { name: 'Next.js', yearsOfExperience: 2 }, { name: 'Testing', yearsOfExperience: 3 }], totalExperienceYears: 7, currentTitle: 'Fullstack Developer', currentCompany: 'DigiPay Rwanda', education: [{ degree: 'BACHELORS', field: 'Information Technology', institution: 'KIST', graduationYear: 2017 }] },
    { firstName: 'Claudine', lastName: 'Ingabire', email: 'claudine@example.com', skills: [{ name: 'Angular', yearsOfExperience: 5 }, { name: 'TypeScript', yearsOfExperience: 5 }, { name: 'RxJS', yearsOfExperience: 4 }], totalExperienceYears: 6, currentTitle: 'Angular Developer', currentCompany: 'Enterprise Solutions', education: [{ degree: 'BACHELORS', field: 'Computer Engineering', institution: 'University of Rwanda', graduationYear: 2018 }] },
    { firstName: 'David', lastName: 'Mugisha', email: 'david@example.com', skills: [{ name: 'React', yearsOfExperience: 2 }, { name: 'JavaScript', yearsOfExperience: 3 }, { name: 'HTML/CSS', yearsOfExperience: 3 }], totalExperienceYears: 3, currentTitle: 'Junior Developer', currentCompany: 'Web Agency Kigali', education: [{ degree: 'CERTIFICATE', field: 'Web Development', institution: 'Andela', graduationYear: 2021 }] },
    { firstName: 'Diane', lastName: 'Uwera', email: 'diane@example.com', skills: [{ name: 'React', yearsOfExperience: 5 }, { name: 'TypeScript', yearsOfExperience: 4 }, { name: 'Next.js', yearsOfExperience: 3 }, { name: 'Tailwind CSS', yearsOfExperience: 2 }, { name: 'Testing', yearsOfExperience: 4 }, { name: 'CI/CD', yearsOfExperience: 3 }], totalExperienceYears: 7, currentTitle: 'Senior Frontend Engineer', currentCompany: 'Irembo', education: [{ degree: 'BACHELORS', field: 'Computer Science', institution: 'University of Rwanda', graduationYear: 2017 }] },
    { firstName: 'Samuel', lastName: 'Bizimana', email: 'samuel@example.com', skills: [{ name: 'React Native', yearsOfExperience: 4 }, { name: 'React', yearsOfExperience: 3 }, { name: 'TypeScript', yearsOfExperience: 2 }], totalExperienceYears: 5, currentTitle: 'Mobile Developer', currentCompany: 'MoMo Tech', education: [{ degree: 'BACHELORS', field: 'Computer Science', institution: 'INES Ruhengeri', graduationYear: 2019 }] },
    { firstName: 'Alice', lastName: 'Kamikazi', email: 'alice@example.com', skills: [{ name: 'React', yearsOfExperience: 6 }, { name: 'TypeScript', yearsOfExperience: 5 }, { name: 'Next.js', yearsOfExperience: 4 }, { name: 'Testing', yearsOfExperience: 4 }, { name: 'Tailwind CSS', yearsOfExperience: 3 }, { name: 'GraphQL', yearsOfExperience: 3 }], totalExperienceYears: 8, currentTitle: 'Tech Lead', currentCompany: 'Awesomity Lab', education: [{ degree: 'BACHELORS', field: 'Software Engineering', institution: 'ALU', graduationYear: 2016 }], certifications: ['AWS Certified Developer'] },
  ];

  await Applicant.insertMany(
    frontendApplicants.map((a) => ({ ...a, jobId: frontendJobId, source: 'UMURAVA_PROFILE' }))
  );

  // Create applicants for data science job
  const dsJobId = jobs[1]._id;
  const dsApplicants = [
    { firstName: 'Emmanuel', lastName: 'Nkurunziza', skills: [{ name: 'Python', yearsOfExperience: 5 }, { name: 'Machine Learning', yearsOfExperience: 4 }, { name: 'TensorFlow', yearsOfExperience: 3 }, { name: 'SQL', yearsOfExperience: 4 }], totalExperienceYears: 5, currentTitle: 'ML Engineer', currentCompany: 'Data Labs Africa', education: [{ degree: 'MASTERS', field: 'Data Science', institution: 'African Institute of Mathematical Sciences', graduationYear: 2019 }] },
    { firstName: 'Clarisse', lastName: 'Mutoni', skills: [{ name: 'Python', yearsOfExperience: 4 }, { name: 'Statistics', yearsOfExperience: 5 }, { name: 'R', yearsOfExperience: 3 }, { name: 'SQL', yearsOfExperience: 4 }, { name: 'NLP', yearsOfExperience: 2 }], totalExperienceYears: 5, currentTitle: 'Data Scientist', currentCompany: 'MTN Rwanda', education: [{ degree: 'MASTERS', field: 'Statistics', institution: 'University of Cape Town', graduationYear: 2019 }] },
    { firstName: 'Bosco', lastName: 'Hakizimana', skills: [{ name: 'Python', yearsOfExperience: 3 }, { name: 'Machine Learning', yearsOfExperience: 2 }, { name: 'SQL', yearsOfExperience: 3 }], totalExperienceYears: 3, currentTitle: 'Junior Data Analyst', currentCompany: 'BK Group', education: [{ degree: 'BACHELORS', field: 'Mathematics', institution: 'University of Rwanda', graduationYear: 2021 }] },
    { firstName: 'Jeanne', lastName: 'Umutesi', skills: [{ name: 'Python', yearsOfExperience: 6 }, { name: 'PyTorch', yearsOfExperience: 4 }, { name: 'Machine Learning', yearsOfExperience: 5 }, { name: 'NLP', yearsOfExperience: 3 }, { name: 'SQL', yearsOfExperience: 5 }, { name: 'Statistics', yearsOfExperience: 5 }], totalExperienceYears: 7, currentTitle: 'Senior Data Scientist', currentCompany: 'Google Research Africa', education: [{ degree: 'PHD', field: 'Machine Learning', institution: 'Makerere University', graduationYear: 2018 }] },
    { firstName: 'Vincent', lastName: 'Nsengiyumva', skills: [{ name: 'Python', yearsOfExperience: 4 }, { name: 'TensorFlow', yearsOfExperience: 3 }, { name: 'Machine Learning', yearsOfExperience: 3 }, { name: 'Statistics', yearsOfExperience: 3 }, { name: 'SQL', yearsOfExperience: 3 }], totalExperienceYears: 4, currentTitle: 'ML Engineer', currentCompany: 'Zipline', education: [{ degree: 'MASTERS', field: 'Computer Science', institution: 'CMU Africa', graduationYear: 2020 }] },
  ];

  await Applicant.insertMany(
    dsApplicants.map((a) => ({ ...a, email: `${a.firstName.toLowerCase()}@example.com`, jobId: dsJobId, source: 'UMURAVA_PROFILE' }))
  );

  await Job.findByIdAndUpdate(frontendJobId, { totalApplicants: frontendApplicants.length });
  await Job.findByIdAndUpdate(dsJobId, { totalApplicants: dsApplicants.length });

  console.log(`Created ${frontendApplicants.length + dsApplicants.length} applicants`);
  console.log('\nSeed complete! Login with: demo@talentlens.ai / Demo123!');

  await mongoose.disconnect();
}

seed().catch(console.error);
