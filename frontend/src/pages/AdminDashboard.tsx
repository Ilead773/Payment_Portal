import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { 
  Users, AlertCircle, UserMinus, Plus, Upload, Download, 
  Search, Edit, RefreshCw, X, ChevronRight, AlertTriangle, CheckCircle, Trash2, PlusCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useNavigationStore } from '../context/navigationStore';
import { motion, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import BulkEmailPortal from './BulkEmailPortal';
import BulkCounselorAssignTab from './BulkCounselorAssignTab';

export const AdminDashboard: React.FC = () => {
  const { activeTab, setActiveTab } = useNavigationStore();

  // Page states
  const [students, setStudents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalStudents: 0,
    activeCount: 0,
    dropOutCount: 0,
    totalExpected: 0,
    totalCollected: 0,
    totalDue: 0,
    recentStudents: [],
    recentPayments: []
  });
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [counselorFilter, setCounselorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals visibility
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showAddAdjustment, setShowAddAdjustment] = useState(false);
  const [showEditSemesterPlan, setShowEditSemesterPlan] = useState(false);

  // Selected entities for actions
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedSemesterPlan, setSelectedSemesterPlan] = useState<any>(null);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [stdData, usersData, schData, crsData, statsData] = await Promise.all([
        apiRequest('/students'),
        apiRequest('/users'),
        apiRequest('/schools'),
        apiRequest('/schools/courses'),
        apiRequest('/dashboard/admin')
      ]);
      setStudents(stdData);
      setUsers(usersData);
      setSchools(schData);
      setCourses(crsData);
      setStats(statsData);
    } catch (err: any) {
      alert(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered students listing
  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      String(s.phonePrimary).includes(search) ||
      (s.email && s.email.toLowerCase().includes(search.toLowerCase()));
    const matchesSchool = schoolFilter ? s.schoolId === schoolFilter : true;
    const matchesCourse = courseFilter ? s.courseId === courseFilter : true;
    const matchesCounselor = counselorFilter === 'unassigned' 
      ? !s.counselorId 
      : counselorFilter 
        ? s.counselorId === counselorFilter 
        : true;
    const matchesStatus = statusFilter ? s.status === statusFilter : true;

    return matchesSearch && matchesSchool && matchesCourse && matchesCounselor && matchesStatus;
  });

  // Recharts school breakdown calculation
  const schoolChartData = schools.map(sch => {
    const schStudents = students.filter(s => s.schoolId === sch.id);
    let expected = 0;
    let collected = 0;
    let due = 0;
    schStudents.forEach(s => {
      expected += s.totalExpected;
      collected += s.totalCollected;
      due += s.totalDue;
    });

    return {
      name: sch.name,
      Expected: expected,
      Collected: collected,
      Outstanding: due
    };
  });

  // Export full sheet CSV
  const handleExportCSV = () => {
    if (students.length === 0) return;

    const headers = [
      'Student Name', 'School', 'Course',
      '1st Semester Fee', '1st Semester Received', '1st Semester Due',
      '2nd Semester Fee', '2nd Semester Received', '2nd Semester Due',
      '3rd Semester Fee', '3rd Semester Received', '3rd Semester Due',
      '4th Semester Fee', '4th Semester Received', '4th Semester Due',
      '5th Semester Fee', '5th Semester Received', '5th Semester Due',
      '6th Semester Fee', '6th Semester Received', '6th Semester Due',
      '7th Semester Fee', '7th Semester Received', '7th Semester Due',
      '8th Semester Fee', '8th Semester Received', '8th Semester Due',
      'Adjustments', 'TOTAL DUE', 'Email ID', 'Phone Number', 'Re_Mark', 'Exam Cell Remarks'
    ];

    const rows = students.map(s => {
      const semCells: any[] = [];
      s.semesters.forEach((sem: any) => {
        semCells.push(sem.feeAmount !== null ? sem.feeAmount : '-');
        semCells.push(sem.receivedAmount !== null ? sem.receivedAmount : '-');
        semCells.push(sem.due !== null ? sem.due : '-');
      });

      const totalAdj = s.semesters.reduce((sum: number, sem: any) => sum + (sem.adjustmentAmount || 0), 0);
      const phones = [s.phonePrimary, s.phoneSecondary].filter(Boolean).join('/');

      return [
        s.name,
        s.school?.name || '',
        s.course?.name || '',
        ...semCells,
        totalAdj,
        s.totalDue,
        s.email || '',
        phones,
        s.status === 'DROPPED_OUT' ? 'Drop Out' : 'Active',
        s.examCellRemarks || ''
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `student_erp_fee_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const pageTransition = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.2, ease: 'easeInOut' }
  } as const;

  // ================= TAB ROUTING RENDERS =================

  // 1. Overview Dashboard Tab (Editorial Asymmetry Grid)
  if (activeTab === 'dashboard') {
    const collectionsRate = stats.totalExpected > 0 ? (stats.totalCollected / stats.totalExpected) * 100 : 0;
    
    return (
      <motion.div {...pageTransition} className="space-y-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 font-display">Overview</h1>
          <p className="text-gray-500 text-xs mt-1">Aggregated statistics, financial projections, and recent operations.</p>
        </div>

        {/* Asymmetric Hero Cards Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Hero Card (2 columns) */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6 shadow-xs flex flex-col justify-between min-h-[160px]">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Outstanding Collections Dues</span>
              <div className="flex items-baseline gap-2.5 mt-2">
                <span className="text-3xl font-mono font-bold text-gray-900">{formatCurrency(stats.totalDue || 0)}</span>
                <span className="text-xxs font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-0.5 uppercase">
                  Pending Dues
                </span>
              </div>
            </div>
            {/* Minimal Progress Bar */}
            <div className="mt-6 space-y-1.5">
              <div className="flex justify-between text-xxs font-semibold text-gray-450 uppercase">
                <span>Collections Ratio</span>
                <span>{collectionsRate.toFixed(1)}% ({formatCurrency(stats.totalCollected)} / {formatCurrency(stats.totalExpected)})</span>
              </div>
              <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden border border-gray-150">
                <div 
                  className="h-full bg-brand-500 rounded-full transition-all duration-500" 
                  style={{ width: `${collectionsRate}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Side Stacked Stats Cards (1 column, containing sub-widgets) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Active Enrollments</span>
                <span className="text-xl font-mono font-bold text-gray-900 mt-1 block">{stats.totalStudents || 0}</span>
              </div>
              <div className="p-2 bg-brand-50 border border-brand-100 rounded-lg text-brand-650">
                <Users className="w-4 h-4" />
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Student Dropouts</span>
                <span className="text-xl font-mono font-bold text-rose-600 mt-1 block">
                  {stats.dropOutCount || 0}
                  <span className="text-xxs font-sans font-normal text-gray-400 ml-1.5">
                    ({stats.totalStudents > 0 ? Math.round((stats.dropOutCount / stats.totalStudents) * 100) : 0}% rate)
                  </span>
                </span>
              </div>
              <div className="p-2 bg-rose-50 border border-rose-100 rounded-lg text-rose-600">
                <UserMinus className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Technical Data Charts & Timeline Feed Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
            <h3 className="font-semibold text-xs text-gray-800 uppercase tracking-wider mb-5">Ledger Ingestion Breakdown</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={schoolChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={10} fontWeight={550} />
                  <YAxis stroke="#6b7280" fontSize={10} fontWeight={550} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
                    labelClassName="font-bold text-gray-850 text-xs"
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="Expected" fill="#2563eb" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Collected" fill="#16a34a" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Outstanding" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Audit trail activity timeline */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-xs text-gray-800 uppercase tracking-wider mb-5">Audits & Activity Log</h3>
              <div className="space-y-4">
                {stats.recentPayments?.length > 0 ? (
                  stats.recentPayments.map((pay: any) => (
                    <div key={pay.id} className="relative pl-4 border-l border-gray-200 pb-0.5 text-xxs font-medium">
                      <div className="absolute w-2 h-2 rounded-full bg-emerald-500 border border-white -left-1 top-0.5" />
                      <div className="flex justify-between items-start">
                        <p className="text-gray-800 font-bold">{pay.studentName}</p>
                        <p className="font-mono font-bold text-emerald-600">+{formatCurrency(pay.amount)}</p>
                      </div>
                      <p className="text-gray-400 font-bold uppercase tracking-wider text-[8px] mt-0.5">Sem {pay.semesterNumber} receipt</p>
                      <p className="text-gray-400 font-semibold text-[8px] mt-0.5">{new Date(pay.paymentDate).toLocaleDateString()}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 text-center py-12">No recent payment activity</p>
                )}
              </div>
            </div>
            <div className="text-[10px] text-gray-400 pt-4 border-t border-gray-100 mt-4 flex items-center justify-between">
              <span className="font-semibold">Last Sync: {new Date().toLocaleTimeString()}</span>
              <button onClick={fetchData} className="flex items-center gap-1 hover:text-brand-500 transition-all cursor-pointer font-bold uppercase tracking-wider text-[9px]">
                <RefreshCw className="w-2.5 h-2.5 animate-spin-hover" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // 1.5 Executive Reports Tab
  if (activeTab === 'reports') {
    return (
      <motion.div {...pageTransition}>
        <ExecutiveReportsTab stats={stats} />
      </motion.div>
    );
  }

  // 2. CSV Bulk Import Tab
  if (activeTab === 'imports') {
    return (
      <motion.div {...pageTransition}>
        <CsvImportWizard onClose={() => { setActiveTab('students'); fetchData(); }} />
      </motion.div>
    );
  }

  // 2.5 Manual Bulk Student Add Tab
  if (activeTab === 'manual-bulk-add') {
    return (
      <motion.div {...pageTransition}>
        <ManualBulkAddTab schools={schools} courses={courses} users={users} onClose={() => { setActiveTab('students'); fetchData(); }} />
      </motion.div>
    );
  }


  // 4. Staff Registry Tab
  if (activeTab === 'users') {
    return (
      <motion.div {...pageTransition}>
        <StaffDirectoryTab users={users} onRefresh={fetchData} />
      </motion.div>
    );
  }

  // 4.5 Send Emails Tab
  if (activeTab === 'bulk-email') {
    return (
      <motion.div {...pageTransition}>
        <BulkEmailPortal students={students} users={users} schools={schools} courses={courses} />
      </motion.div>
    );
  }

  // 4.6 Bulk Counselor Assign Tab
  if (activeTab === 'bulk-counselor-assign') {
    return (
      <motion.div {...pageTransition}>
        <BulkCounselorAssignTab
          students={students}
          users={users}
          schools={schools}
          courses={courses}
          onRefresh={fetchData}
        />
      </motion.div>
    );
  }

  // 5. Students Directory Tab (Stripe-like Spreadsheet with segment selector)
  return (
    <motion.div {...pageTransition} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 font-display">Student Directory</h1>
          <p className="text-gray-500 text-xs mt-1 font-medium">Excel-style semester ledger. Add, edit, advance, and audit student accounts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all font-semibold text-xs cursor-pointer shadow-xs text-gray-600"
          >
            <Download className="w-3.5 h-3.5 text-gray-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setActiveTab('manual-bulk-add')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-brand-600 hover:bg-gray-50 hover:border-gray-300 font-bold text-xs transition-all cursor-pointer shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5 text-brand-500" />
            <span>Manual Bulk Add</span>
          </button>
          <button
            onClick={() => setShowAddStudent(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet grid filter and ledger card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Segment Selector for status filtering */}
          <div className="flex bg-gray-100/60 p-0.5 rounded-lg border border-gray-200/50 text-[10px] font-bold text-gray-500 uppercase tracking-wider relative">
            {['', 'ACTIVE', 'DROPPED_OUT'].map((status) => {
              const label = status === '' ? 'All Students' : status === 'ACTIVE' ? 'Active' : 'Drop Outs';
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer relative z-10 ${
                    isActive ? 'text-gray-900 font-semibold' : 'hover:text-gray-800'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="status-segment-pill"
                      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                      className="absolute inset-0 bg-white border border-gray-200/40 rounded-md -z-10 shadow-xxs"
                    />
                  )}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by student name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 glass-input"
            />
          </div>
        </div>

        {/* Detailed Column Filter Selects */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200/80">
          <div>
            <label className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-0.5">School</label>
            <select
              value={schoolFilter}
              onChange={(e) => { setSchoolFilter(e.target.value); setCourseFilter(''); }}
              className="w-full bg-white border border-gray-200 rounded-md px-2.5 py-1 text-xs text-gray-700 outline-none hover:border-gray-300"
            >
              <option value="">All Schools</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-0.5">Course</label>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              disabled={!schoolFilter}
              className="w-full bg-white border border-gray-200 rounded-md px-2.5 py-1 text-xs text-gray-700 outline-none hover:border-gray-300 disabled:opacity-40"
            >
              <option value="">All Courses</option>
              {courses
                .filter(c => c.schoolId === schoolFilter)
                .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-0.5">Assigned Counselor</label>
            <select
              value={counselorFilter}
              onChange={(e) => setCounselorFilter(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-md px-2.5 py-1 text-xs text-gray-700 outline-none hover:border-gray-300"
            >
              <option value="">All Staff</option>
              <option value="unassigned">Unassigned</option>
              {users
                .filter(u => u.role === 'COUNSELOR')
                .map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>

        {/* Ledger Grid */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-150 border-collapse text-xxs text-gray-600">
            <thead className="bg-gray-50 uppercase font-semibold text-gray-450 tracking-wider">
              <tr>
                <th scope="col" className="px-3 py-2 text-left border-r border-gray-150 font-bold whitespace-nowrap">Student Name</th>
                <th scope="col" className="px-3 py-2 text-left border-r border-gray-150 font-bold">School</th>
                <th scope="col" className="px-3 py-2 text-left border-r border-gray-150 font-bold">Course</th>
                <th scope="col" className="px-3 py-2 text-left border-r border-gray-150 font-bold">Counselor</th>
                {Array.from({ length: 8 }, (_, i) => (
                  <th key={i} scope="col" className="px-3 py-2 text-center border-r border-gray-150 font-bold whitespace-nowrap min-w-32">
                    Sem {i + 1}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-center border-r border-gray-150 font-bold whitespace-nowrap">Total Due</th>
                <th scope="col" className="px-3 py-2 text-center font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 font-medium bg-white">
              {loading ? (
                <tr>
                  <td colSpan={14} className="px-6 py-12 text-center text-gray-400 font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-brand-500" />
                      <span>Syncing data records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-6 py-12 text-center text-gray-400">
                    No matching student records found
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => {
                  const isDropped = student.status === 'DROPPED_OUT';
                  return (
                    <motion.tr 
                      key={student.id} 
                      className={`hover:bg-gray-50/40 transition-colors border-l-2 ${isDropped ? 'bg-red-50/10 text-gray-500 border-l-red-500/80' : 'border-l-transparent'}`}
                    >
                      <td className="px-3 py-2 font-bold text-gray-800 border-r border-gray-150 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{student.name}</span>
                          {isDropped && <span className="bg-red-50 text-red-650 text-[8px] px-1.5 py-0.5 rounded font-bold border border-red-100 uppercase tracking-wider">Drop Out</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 border-r border-gray-150 whitespace-nowrap">{student.school?.name}</td>
                      <td className="px-3 py-2 border-r border-gray-150 whitespace-nowrap">{student.course?.name}</td>
                      <td className="px-3 py-2 border-r border-gray-150 whitespace-nowrap italic text-gray-400 font-normal">
                        {student.counselor?.name || <span className="text-amber-600 not-italic font-bold">Unassigned</span>}
                      </td>

                      {student.semesters.map((sem: any) => {
                        const hasPlan = sem.feeAmount !== null;
                        return (
                          <td 
                            key={sem.semesterNumber} 
                            className={`px-3 py-1.5 border-r border-gray-150 text-center ${!hasPlan && isDropped ? 'bg-gray-50/30 text-gray-350' : ''}`}
                          >
                             {!hasPlan ? (
                              !isDropped ? (
                                <button
                                  onClick={() => {
                                    setSelectedStudent(student);
                                    setSelectedSemesterPlan(sem);
                                    setShowEditSemesterPlan(true);
                                  }}
                                  className="text-gray-400 hover:text-brand-600 font-bold text-[9px] bg-gray-50 hover:bg-gray-100 border border-gray-200 px-1 py-0.5 rounded cursor-pointer transition-all"
                                >
                                  + Set
                                </button>
                              ) : (
                                <span className="text-gray-300 font-bold">-</span>
                              )
                            ) : (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-gray-500 font-semibold font-mono">₹{sem.feeAmount}</span>
                                <span className="text-emerald-650 font-semibold font-mono">₹{sem.receivedAmount}</span>
                                <span className={`font-mono font-bold ${sem.due > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                  Due: ₹{sem.due}
                                </span>
                                {sem.dueDate && (
                                  <span className="text-gray-400 text-[8px] font-normal leading-none mt-0.5">
                                    Due: {new Date(sem.dueDate).toLocaleDateString()}
                                  </span>
                                )}
                                <div className="flex gap-1 mt-1 border-t border-gray-100 pt-1 w-full justify-center opacity-40 hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      setSelectedStudent(student);
                                      setSelectedSemesterPlan(sem);
                                      setShowAddPayment(true);
                                    }}
                                    className="text-emerald-600 hover:text-white font-bold text-[9px] hover:bg-emerald-600 border border-emerald-200 px-1 py-0.5 rounded cursor-pointer transition-colors"
                                  >
                                    Pay
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedStudent(student);
                                      setSelectedSemesterPlan(sem);
                                      setShowAddAdjustment(true);
                                    }}
                                    className="text-brand-600 hover:text-white font-bold text-[9px] hover:bg-brand-500 border border-brand-200 px-1 py-0.5 rounded cursor-pointer transition-colors"
                                  >
                                    Adj
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedStudent(student);
                                      setSelectedSemesterPlan(sem);
                                      setShowEditSemesterPlan(true);
                                    }}
                                    className="text-amber-600 hover:text-white font-bold text-[9px] hover:bg-amber-600 border border-amber-200 px-1 py-0.5 rounded cursor-pointer transition-colors"
                                  >
                                    Edit
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      <td className="px-3 py-2 text-center font-mono font-bold border-r border-gray-150 text-gray-800">
                        {formatCurrency(student.totalDue)}
                      </td>

                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedStudent(student);
                              setShowAddStudent(true);
                            }}
                            className="p-1 rounded bg-white border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-all cursor-pointer shadow-xs"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          
                          {!isDropped && student.semesters.filter((s: any) => s.feeAmount !== null).length < 8 && (
                            <button
                              onClick={async () => {
                                const fee = prompt('Enter fee amount for the next semester:', '50000');
                                if (fee) {
                                  try {
                                    await apiRequest(`/students/${student.id}/advance`, {
                                      method: 'POST',
                                      bodyData: { feeAmount: parseFloat(fee) }
                                    });
                                    fetchData();
                                  } catch (err: any) {
                                    alert(err.message);
                                  }
                                }
                              }}
                              className="px-1.5 py-0.5 rounded bg-brand-50 border border-brand-100 text-brand-650 hover:bg-brand-500 hover:text-white text-[8px] font-bold transition-all cursor-pointer"
                            >
                              +Sem
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL DIALOGS ================= */}
      <AnimatePresence>
        {showAddStudent && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white border border-gray-200 rounded-xl p-5 relative shadow-xl"
            >
              <button
                onClick={() => { setShowAddStudent(false); setSelectedStudent(null); }}
                className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-750 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">{selectedStudent ? 'Edit Student Profile' : 'Add New Student'}</h3>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const payload = {
                    name: formData.get('name') as string,
                    schoolId: formData.get('schoolId') as string,
                    courseId: formData.get('courseId') as string,
                    email: formData.get('email') as string || undefined,
                    phonePrimary: formData.get('phonePrimary') as string,
                    phoneSecondary: formData.get('phoneSecondary') as string || undefined,
                    counselorId: formData.get('counselorId') as string || undefined,
                    status: selectedStudent ? formData.get('status') as string : 'ACTIVE',
                    examCellRemarks: formData.get('examCellRemarks') as string || undefined,
                    initialSemesterFee: selectedStudent ? undefined : parseFloat(formData.get('initialSemesterFee') as string) || 0,
                  };

                  try {
                    if (selectedStudent) {
                      await apiRequest(`/students/${selectedStudent.id}`, {
                        method: 'PUT',
                        bodyData: payload,
                      });
                    } else {
                      await apiRequest('/students', {
                        method: 'POST',
                        bodyData: payload,
                      });
                    }
                    setShowAddStudent(false);
                    setSelectedStudent(null);
                    fetchData();
                  } catch (err: any) {
                    alert(err.message);
                  }
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-wider mb-1 ml-0.5">Student Full Name</label>
                  <input
                    name="name"
                    type="text"
                    required
                    defaultValue={selectedStudent?.name || ''}
                    className="w-full premium-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-wider mb-1 ml-0.5">School</label>
                    <select
                      name="schoolId"
                      required
                      defaultValue={selectedStudent?.schoolId || ''}
                      className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-gray-700 outline-none hover:border-gray-300"
                    >
                      <option value="">Select School</option>
                      {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-wider mb-1 ml-0.5">Course</label>
                    <select
                      name="courseId"
                      required
                      defaultValue={selectedStudent?.courseId || ''}
                      className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-gray-700 outline-none hover:border-gray-300"
                    >
                      <option value="">Select Course</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.school?.name})</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-555 uppercase tracking-wider mb-1 ml-0.5">Primary Phone</label>
                    <input
                      name="phonePrimary"
                      type="text"
                      required
                      defaultValue={selectedStudent?.phonePrimary || ''}
                      className="w-full premium-input"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-555 uppercase tracking-wider mb-1 ml-0.5">Secondary Phone</label>
                    <input
                      name="phoneSecondary"
                      type="text"
                      defaultValue={selectedStudent?.phoneSecondary || ''}
                      className="w-full premium-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-555 uppercase tracking-wider mb-1 ml-0.5">Email ID</label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={selectedStudent?.email || ''}
                    className="w-full premium-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-555 uppercase tracking-wider mb-1 ml-0.5">Assigned Counselor</label>
                    <select
                      name="counselorId"
                      defaultValue={selectedStudent?.counselorId || ''}
                      className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-gray-700 outline-none hover:border-gray-300"
                    >
                      <option value="">Unassigned</option>
                      {users.filter(u => u.role === 'COUNSELOR').map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  {selectedStudent ? (
                    <div>
                      <label className="block text-[10px] font-bold text-gray-555 uppercase tracking-wider mb-1 ml-0.5">Academic Status</label>
                      <select
                        name="status"
                        defaultValue={selectedStudent?.status || 'ACTIVE'}
                        className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-gray-700 outline-none hover:border-gray-300"
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="DROPPED_OUT">Drop Out</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-bold text-gray-555 uppercase tracking-wider mb-1 ml-0.5">1st Sem Fee (₹)</label>
                      <input
                        name="initialSemesterFee"
                        type="number"
                        placeholder="50000"
                        className="w-full premium-input"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-555 uppercase tracking-wider mb-1 ml-0.5">Exam Cell Remarks</label>
                  <textarea
                    name="examCellRemarks"
                    rows={2}
                    defaultValue={selectedStudent?.examCellRemarks || ''}
                    className="w-full premium-input"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowAddStudent(false); setSelectedStudent(null); }}
                    className="px-4 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold cursor-pointer shadow-xs"
                  >
                    {selectedStudent ? 'Save Changes' : 'Create Student'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddPayment && selectedStudent && selectedSemesterPlan && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-white border border-gray-200 rounded-xl p-5 relative shadow-lg"
            >
              <button
                onClick={() => { setShowAddPayment(false); setSelectedStudent(null); setSelectedSemesterPlan(null); }}
                className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-750 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Record Received Payment</h3>
              <p className="text-xs text-gray-500 mb-6 font-medium">
                Posting payment for <span className="text-brand-500 font-bold">{selectedStudent.name}</span> against <span className="text-brand-500 font-bold">Semester {selectedSemesterPlan.semesterNumber}</span>.
              </p>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const payload = {
                    studentId: selectedStudent.id,
                    semesterPlanId: selectedSemesterPlan.id,
                    amount: parseFloat(formData.get('amount') as string),
                    idempotencyKey: `manual_${selectedSemesterPlan.id}_${Date.now()}`,
                    paymentDate: new Date().toISOString(),
                  };

                  try {
                    await apiRequest('/payments', {
                      method: 'POST',
                      bodyData: payload,
                    });
                    setShowAddPayment(false);
                    setSelectedStudent(null);
                    setSelectedSemesterPlan(null);
                    fetchData();
                  } catch (err: any) {
                    alert(err.message);
                  }
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 ml-0.5">Payment Amount (₹)</label>
                  <input
                    name="amount"
                    type="number"
                    required
                    max={selectedSemesterPlan.due}
                    placeholder={`Maximum due: ₹${selectedSemesterPlan.due}`}
                    className="w-full premium-input"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowAddPayment(false); setSelectedStudent(null); setSelectedSemesterPlan(null); }}
                    className="px-4 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-750 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer shadow-xs"
                  >
                    Log Payment
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddAdjustment && selectedStudent && selectedSemesterPlan && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-5 relative shadow-xl text-xs animate-in fade-in duration-200"
            >
              <button
                onClick={() => { setShowAddAdjustment(false); setSelectedStudent(null); setSelectedSemesterPlan(null); }}
                className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-750 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Apply Credit / scholarship</h3>
              <p className="text-gray-500 mb-4 font-medium">
                Applying scholarship waiver or credit adjustment for <span className="text-brand-500 font-bold">{selectedStudent.name}</span> in <span className="text-brand-500 font-bold">Semester {selectedSemesterPlan.semesterNumber}</span>.
              </p>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const payload = {
                    semesterPlanId: selectedSemesterPlan.id,
                    amount: parseFloat(formData.get('amount') as string) || 0,
                    reason: formData.get('reason') as string,
                  };

                  try {
                    await apiRequest('/payments/adjustments', {
                      method: 'POST',
                      bodyData: payload,
                    });
                    setShowAddAdjustment(false);
                    setSelectedStudent(null);
                    setSelectedSemesterPlan(null);
                    fetchData();
                  } catch (err: any) {
                    alert(err.message);
                  }
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 ml-0.5">Adjustment Credit Amount (₹)</label>
                  <input
                    name="amount"
                    type="number"
                    required
                    placeholder="e.g. 5000 for ₹5,000 scholarship discount"
                    className="w-full premium-input"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 ml-0.5">Mandatory Audit Trail Reason</label>
                  <textarea
                    name="reason"
                    required
                    rows={3}
                    placeholder="e.g. 10% Academic Scholarship applied"
                    className="w-full premium-input"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowAddAdjustment(false); setSelectedStudent(null); setSelectedSemesterPlan(null); }}
                    className="px-4 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-750 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold cursor-pointer shadow-xs"
                  >
                    Apply Credit
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showEditSemesterPlan && selectedStudent && selectedSemesterPlan && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-5 relative shadow-xl text-xs"
            >
              <button
                onClick={() => { setShowEditSemesterPlan(false); setSelectedStudent(null); setSelectedSemesterPlan(null); }}
                className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-750 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Configure Semester Fee & Due Date</h3>
              <p className="text-gray-500 mb-4 font-medium">
                Setting fee plan for <span className="text-brand-500 font-bold">{selectedStudent.name}</span> - <span className="text-brand-500 font-bold">Semester {selectedSemesterPlan.semesterNumber}</span>.
              </p>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const feeAmount = parseFloat(formData.get('feeAmount') as string) || 0;
                  const dueDateVal = formData.get('dueDate') as string;
                  const dueDate = dueDateVal ? new Date(dueDateVal).toISOString() : null;

                  try {
                    await apiRequest(`/students/${selectedStudent.id}/semesters/${selectedSemesterPlan.semesterNumber}`, {
                      method: 'POST',
                      bodyData: { feeAmount, dueDate },
                    });
                    setShowEditSemesterPlan(false);
                    setSelectedStudent(null);
                    setSelectedSemesterPlan(null);
                    fetchData();
                  } catch (err: any) {
                    alert(err.message);
                  }
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-wider mb-1 ml-0.5">Fee Amount (₹)</label>
                  <input
                    name="feeAmount"
                    type="number"
                    min="0"
                    required
                    defaultValue={selectedSemesterPlan.feeAmount || ''}
                    placeholder="e.g. 50000"
                    className="w-full premium-input"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-wider mb-1 ml-0.5">Due Date</label>
                  <input
                    name="dueDate"
                    type="date"
                    defaultValue={selectedSemesterPlan.dueDate ? new Date(selectedSemesterPlan.dueDate).toISOString().split('T')[0] : ''}
                    className="w-full premium-input"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowEditSemesterPlan(false); setSelectedStudent(null); setSelectedSemesterPlan(null); }}
                    className="px-4 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-750 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold cursor-pointer shadow-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Helper to get row value case-insensitively and ignoring non-alphanumeric chars (like BOM)
const getRowValue = (row: any, possibleKeys: string[]): string => {
  if (!row) return '';
  const normalizedPossibles = possibleKeys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const rawKey of Object.keys(row)) {
    const normKey = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedPossibles.includes(normKey)) {
      return String(row[rawKey] ?? '').trim();
    }
  }
  return '';
};

// ================= SUB-PAGE: CSV IMPORT WIZARD =================
const CsvImportWizard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [previewStats, setPreviewStats] = useState<any>({ total: 0, new: 0, updates: 0, warnings: 0, errors: 0 });
  const [warningList, setWarningList] = useState<string[]>([]);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [workbook, setWorkbook] = useState<any>(null);
  
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobState, setJobState] = useState('');
  const [jobResult, setJobResult] = useState<any>(null);

  const handleDownloadTemplate = async () => {
    try {
      const csvContent = await apiRequest('/imports/template');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "student_ledger_import_template.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(`Failed to fetch template: ${err.message}`);
    }
  };

  const loadExcelSheet = (wb: any, sheetName: string) => {
    try {
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
      
      let warnings = 0;
      let errors = 0;
      const warns: string[] = [];

      data.forEach((row: any, i: number) => {
        const rowNum = i + 2;
        const name = getRowValue(row, ['Student Name', 'student_name', 'name', 'student']);
        const school = getRowValue(row, ['School', 'school', 'sch']);
        const course = getRowValue(row, ['Course', 'course', 'crs', 'stream']);
        const phone = getRowValue(row, ['Phone Number', 'phone_number', 'phone', 'mobile']);

        if (!name || !school || !course) {
          const isRowEmpty = Object.values(row).every(val => val === undefined || val === null || String(val).trim() === '');
          if (!isRowEmpty) {
            errors++;
          }
        }
        if (phone) {
          const phoneParts = phone.split(/[\/,;\s\|]+/).map(p => p.trim()).filter(Boolean);
          if (phoneParts.some(p => {
            const digits = p.replace(/\D/g, '');
            return digits.length > 0 && digits.length < 7;
          })) {
            warnings++;
            warns.push(`Row ${rowNum}: Phone number may be invalid (too short).`);
          }
        }
      });

      setPreviewRows(data.slice(0, 10));
      setPreviewStats({
        total: data.length,
        new: data.length,
        updates: 0,
        warnings,
        errors
      });
      setWarningList(warns);
    } catch (err: any) {
      alert(`Failed to preview sheet: ${err.message}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          setWorkbook(wb);
          
          const sheetNames = wb.SheetNames;
          setSheets(sheetNames);
          
          const defaultSheet = sheetNames.find(name => name.toUpperCase().includes('BATCH')) || sheetNames[0];
          setSelectedSheet(defaultSheet);
          
          loadExcelSheet(wb, defaultSheet);
          setStep(2);
        } catch (err: any) {
          alert(`Failed to parse Excel file: ${err.message}`);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setWorkbook(null);
      setSheets([]);
      setSelectedSheet('');

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data;
          let warnings = 0;
          let errors = 0;
          const warns: string[] = [];

          rows.forEach((row: any, i: number) => {
            const rowNum = i + 2;
            const name = getRowValue(row, ['Student Name', 'student_name', 'name', 'student']);
            const school = getRowValue(row, ['School', 'school', 'sch']);
            const course = getRowValue(row, ['Course', 'course', 'crs', 'stream']);
            const phone = getRowValue(row, ['Phone Number', 'phone_number', 'phone', 'mobile']);

            if (!name || !school || !course) {
              errors++;
            }
            if (phone) {
              const phoneParts = phone.split(/[\/,;\s\|]+/).map(p => p.trim()).filter(Boolean);
              if (phoneParts.some(p => {
                const digits = p.replace(/\D/g, '');
                return digits.length > 0 && digits.length < 7;
              })) {
                warnings++;
                warns.push(`Row ${rowNum}: Phone number may be invalid (too short).`);
              }
            }
          });

          setPreviewRows(rows.slice(0, 10));
          setPreviewStats({
            total: rows.length,
            new: rows.length,
            updates: 0,
            warnings,
            errors
          });
          setWarningList(warns);
          setStep(2);
        }
      });
    }
  };

  const handleConfirmImport = async () => {
    if (!csvFile) return;
    setStep(3);

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const res = await fetch(`${apiBase}/imports/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('erp_token')}`
        },
        body: formData
      });

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setJobId(data.jobId);
    } catch (err: any) {
      setJobState('failed');
      alert(`Import failed to enqueue: ${err.message}`);
    }
  };

  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const status = await apiRequest(`/imports/status/${jobId}`);
        setJobProgress(status.progress || 0);
        setJobState(status.state);
        if (status.state === 'completed') {
          setJobResult(status.result);
          clearInterval(interval);
        } else if (status.state === 'failed') {
          clearInterval(interval);
        }
      } catch (err) {
        clearInterval(interval);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [jobId]);

  return (
    <div className="bg-white border border-gray-250 rounded-xl p-6 space-y-6 max-w-4xl mx-auto shadow-xs">
      <div>
        <h2 className="text-base font-bold text-gray-900 font-display">CSV Bulk Ingestion Wizard</h2>
        <p className="text-xs text-gray-500 mt-1 font-medium">Ingest, parse, split cell phone columns, and update semester ledgers in bulk.</p>
      </div>

      <div className="flex items-center gap-2 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
        <span className={step === 1 ? 'text-brand-500' : 'text-gray-400'}>1. Upload File</span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
        <span className={step === 2 ? 'text-brand-500' : 'text-gray-400'}>2. Ingestion Preview</span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
        <span className={step === 3 ? 'text-brand-500' : 'text-gray-400'}>3. Processing Queue</span>
      </div>

      <div className="min-h-[220px] bg-gray-50 rounded-lg p-4 border border-gray-200">
        {step === 1 && (
          <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
            <Upload className="w-9 h-9 text-gray-350 mb-3" />
            <p className="font-bold text-gray-800 text-sm mb-1">Select spreadsheet export file</p>
            <p className="text-gray-450 text-xs mb-6 font-medium">Only standard comma-separated values (.csv) UTF-8 file format supported.</p>
            
            <div className="flex gap-3">
              <button
                onClick={handleDownloadTemplate}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-655 font-bold text-xs cursor-pointer shadow-xs transition-colors"
              >
                Get Template Schema
              </button>
              <label className="px-3.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors">
                Choose File
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            <div className="grid grid-cols-4 gap-3 p-3 rounded-lg bg-white border border-gray-200 text-center text-xs">
              <div>
                <span className="text-[9px] text-gray-450 uppercase font-bold tracking-wider">Total Rows</span>
                <span className="text-lg font-mono font-bold block mt-1 text-gray-800">{previewStats.total}</span>
              </div>
              <div>
                <span className="text-[9px] text-gray-450 uppercase font-bold tracking-wider">Warnings</span>
                <span className="text-lg font-mono font-bold block mt-1 text-amber-600">{previewStats.warnings}</span>
              </div>
              <div>
                <span className="text-[9px] text-gray-450 uppercase font-bold tracking-wider">Errors</span>
                <span className="text-lg font-mono font-bold block mt-1 text-rose-600">{previewStats.errors}</span>
              </div>
              <div>
                <span className="text-[9px] text-gray-455 uppercase font-bold tracking-wider">Status</span>
                <span className="text-lg font-bold block mt-1 text-emerald-600">Ready</span>
              </div>
            </div>

            {warningList.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xxs font-medium max-h-24 overflow-y-auto space-y-1">
                <p className="font-bold flex items-center gap-1.5 mb-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Parse warnings before upload:</p>
                {warningList.map((w, idx) => <p key={idx}>• {w}</p>)}
              </div>
            )}

            {sheets.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-b border-gray-150 pb-2.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase self-center mr-1">Sheets in Workbook:</span>
                {sheets.map((sheetName) => (
                  <button
                    key={sheetName}
                    onClick={() => {
                      setSelectedSheet(sheetName);
                      loadExcelSheet(workbook, sheetName);
                    }}
                    className={`px-2.5 py-1 rounded text-xxs font-bold cursor-pointer transition-colors ${
                      selectedSheet === sheetName
                        ? 'bg-brand-500 text-white shadow-xs'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {sheetName}
                  </button>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-gray-200 overflow-x-auto bg-white">
              <table className="min-w-full divide-y divide-gray-150 text-xxs text-gray-500">
                <thead className="bg-gray-50 uppercase font-bold text-left">
                  <tr>
                    <th className="px-3 py-2 border-r border-gray-150">Student Name</th>
                    <th className="px-3 py-2 border-r border-gray-150">School</th>
                    <th className="px-3 py-2 border-r border-gray-150">Course</th>
                    <th className="px-3 py-2 border-r border-gray-150">Phone Number</th>
                    <th className="px-3 py-2 border-r border-gray-150">Re_Mark</th>
                    <th className="px-3 py-2">Counselor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 font-medium">
                  {previewRows.map((r, idx) => {
                    const name = getRowValue(r, ['Student Name', 'student_name', 'name', 'student']);
                    const sch = getRowValue(r, ['School', 'school', 'sch']);
                    const crs = getRowValue(r, ['Course', 'course', 'crs', 'stream']);
                    const phone = getRowValue(r, ['Phone Number', 'phone_number', 'phone', 'mobile']);
                    const remark = getRowValue(r, ['Re_Mark', 're_mark', 'remark', 'remarks']);
                    const counselor = getRowValue(r, ['Counselor', 'counselor']);
                    const isErr = !name || !sch || !crs;
                    return (
                      <tr key={idx} className={isErr ? 'bg-red-50/50' : ''}>
                        <td className="px-3 py-2 text-gray-800 font-bold border-r border-gray-150">{name || '[MISSING]'}</td>
                        <td className="px-3 py-2 border-r border-gray-150">{sch || '[MISSING]'}</td>
                        <td className="px-3 py-2 border-r border-gray-150">{crs || '[MISSING]'}</td>
                        <td className="px-3 py-2 border-r border-gray-150">{phone}</td>
                        <td className="px-3 py-2 border-r border-gray-150">{remark}</td>
                        <td className="px-3 py-2">{counselor}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setStep(1)}
                className="px-3.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-650 font-bold text-xs cursor-pointer shadow-xs"
              >
                Back
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={previewStats.errors > 0}
                className="px-3.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                Confirm & Import
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center justify-center p-6 space-y-6">
            {!jobId ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-brand-500" />
                <span className="font-bold text-xs text-gray-500">Queuing job...</span>
              </div>
            ) : jobState === 'completed' && jobResult ? (
              <div className="space-y-6 w-full max-w-lg animate-fade-in">
                <div className="flex items-center gap-2 text-emerald-600 font-bold justify-center">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-xs">Batch Ingestion Completed Successfully!</span>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-white border border-gray-200 text-center text-xs animate-fade-in">
                  <div>
                    <p className="text-gray-400 font-bold uppercase tracking-wider">New Students</p>
                    <p className="text-lg font-mono font-bold text-emerald-600">+{jobResult.newCount}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-bold uppercase tracking-wider">Updated Profiles</p>
                    <p className="text-lg font-mono font-bold text-brand-500">+{jobResult.updateCount}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-bold uppercase tracking-wider">Warnings Logged</p>
                    <p className="text-lg font-mono font-bold text-amber-600">{jobResult.warningCount}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-bold uppercase tracking-wider">Errors Rejected</p>
                    <p className="text-lg font-mono font-bold text-rose-600">{jobResult.errorCount}</p>
                  </div>
                </div>

                {jobResult.rowReports?.filter((r: any) => r.status !== 'success').length > 0 && (
                  <div className="rounded-lg border border-gray-200 max-h-36 overflow-y-auto p-3 text-xxs text-gray-500 space-y-2 bg-gray-50">
                    <p className="font-bold text-gray-700">Import Exceptions Log:</p>
                    {jobResult.rowReports
                      .filter((r: any) => r.status !== 'success')
                      .map((rep: any, idx: number) => (
                        <div key={idx} className={`p-2 rounded border ${rep.status === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                          <p className="font-bold text-xs">Row {rep.rowNumber} ({rep.studentName}): {rep.message}</p>
                          {rep.details.map((d: string, dIdx: number) => <p key={dIdx} className="ml-3 font-normal opacity-85">• {d}</p>)}
                        </div>
                      ))}
                  </div>
                )}
                
                <div className="text-center">
                  <button onClick={onClose} className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg cursor-pointer shadow-xs">
                    Return to Directory
                  </button>
                </div>
              </div>
            ) : jobState === 'failed' ? (
              <div className="flex items-center gap-2 text-rose-600 font-bold">
                <AlertCircle className="w-5 h-5" />
                <span>The import job failed. Please verify CSV encoding.</span>
              </div>
            ) : (
              <div className="w-full max-w-sm space-y-4">
                <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                  <span className="uppercase tracking-wider">Ingesting records ({jobProgress}%)</span>
                  <span className="text-brand-500">{jobState}...</span>
                </div>
                <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden border border-gray-150">
                  <div
                    className="h-full bg-brand-500 transition-all duration-300 rounded-full"
                    style={{ width: `${jobProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ================= SUB-PAGE: STAFF MANAGEMENT TAB =================
const StaffDirectoryTab: React.FC<{ users: any[], onRefresh: () => void }> = ({ users, onRefresh }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('COUNSELOR');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/users', {
        method: 'POST',
        bodyData: { name, email, passwordHash: password, role }
      });
      setName('');
      setEmail('');
      setPassword('');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 text-xs">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-gray-900 font-display">Staff Registry</h1>
        <p className="text-gray-500 text-xs mt-1 font-medium">Manage logins, Counselor scoping assignments, and Admin demotion overrides.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Add user form */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 md:col-span-1 h-fit shadow-xs">
          <h3 className="font-semibold text-xs text-gray-805 uppercase tracking-wider mb-2">Create Staff Login</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-550 font-bold mb-1">Full Name</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full premium-input" />
            </div>
            <div>
              <label className="block text-gray-550 font-bold mb-1">Email ID</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full premium-input" />
            </div>
            <div>
              <label className="block text-gray-555 font-bold mb-1">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full premium-input" />
            </div>
            <div>
              <label className="block text-gray-555 font-bold mb-1">Role Group</label>
              <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-gray-700 outline-none hover:border-gray-300">
                <option value="COUNSELOR">Counselor</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </div>
            <button type="submit" className="w-full py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg cursor-pointer shadow-xs transition-colors">
              Register User
            </button>
          </form>
        </div>

        {/* User directory table */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 md:col-span-2 space-y-4 shadow-xs">
          <h3 className="font-semibold text-xs text-gray-850 uppercase tracking-wider">Active Staff Listing</h3>
          
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="min-w-full divide-y divide-gray-150 text-slate-700">
              <thead className="bg-gray-50 font-bold text-gray-500 uppercase tracking-wider text-[9px]">
                <tr>
                  <th className="px-4 py-2 text-left">Staff Member</th>
                  <th className="px-4 py-2 text-left">Email Address</th>
                  <th className="px-4 py-2 text-center">Role Group</th>
                  <th className="px-4 py-2 text-center">Deactivate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-bold text-gray-800">{u.name}</td>
                    <td className="px-4 py-2.5">{u.email}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                        u.role === 'ADMIN' 
                          ? 'bg-blue-50 border-blue-200 text-brand-600' 
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={async () => {
                          if (confirm('Deactivate this staff login?')) {
                            try {
                              await apiRequest(`/users/${u.id}`, {
                                method: 'PUT',
                                bodyData: { isActive: false }
                              });
                              onRefresh();
                            } catch (err: any) {
                              alert(err.message);
                            }
                          }
                        }}
                        className="text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                      >
                        Archive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ================= SUB-PAGE: EXECUTIVE REPORTS TAB =================
const ExecutiveReportsTab: React.FC<{ stats: any }> = ({ stats }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const reports = stats?.executiveReports || {
    evenReport: { totalStudents: 0, paidCount: 0, pendingCount: 0, receivables: 0, received: 0, suspense: 0, due: 0 },
    oddReport: { totalStudents: 0, paidCount: 0, pendingCount: 0, receivables: 0, received: 0, suspense: 0, due: 0 },
    dailyBreakdown: { admissions: 0, evenSemester: 0, oddSemester: 0, totalReceived: 0 }
  };

  const ledger = stats?.cohortLedger || {
    cohorts: [
      {
        name: '2025 BATCH',
        id: '2025',
        studentCount: 0,
        semesters: Array.from({ length: 8 }, (_, i) => ({ semesterNumber: i + 1, fees: 0, received: 0, due: 0, nosDue: 0 })),
        totals: { fees: 0, received: 0, due: 0 }
      },
      {
        name: '2024 BATCH',
        id: '2024',
        studentCount: 0,
        semesters: Array.from({ length: 8 }, (_, i) => ({ semesterNumber: i + 1, fees: 0, received: 0, due: 0, nosDue: 0 })),
        totals: { fees: 0, received: 0, due: 0 }
      },
      {
        name: '2023 BATCH',
        id: '2023',
        studentCount: 0,
        semesters: Array.from({ length: 8 }, (_, i) => ({ semesterNumber: i + 1, fees: 0, received: 0, due: 0, nosDue: 0 })),
        totals: { fees: 0, received: 0, due: 0 }
      }
    ],
    semesterTotals: Array.from({ length: 8 }, (_, i) => ({ semesterNumber: i + 1, totalDue: 0 })),
    grandTotalDue: 0
  };

  const { evenReport, oddReport, dailyBreakdown } = reports;
  const { cohorts, semesterTotals, grandTotalDue } = ledger;

  const getSemesterLabel = (semNum: number) => {
    if (semNum === 1) return '1st Sem / OTP';
    if (semNum === 2) return '2nd Sem';
    if (semNum === 3) return '3rd Sem';
    return `${semNum}th Sem`;
  };

  const formatNumberForTable = (amount: number | null) => {
    if (amount === null || amount === 0) return '—';
    return new Intl.NumberFormat('en-IN').format(amount);
  };

  const handleExportCohortCSV = () => {
    const headers = [
      'Semester',
      '2025 Fees', '2025 Received', '2025 Due', '2025 Nos Due',
      '2024 Fees', '2024 Received', '2024 Due', '2024 Nos Due',
      '2023 Fees', '2023 Received', '2023 Due', '2023 Nos Due',
      'TOTAL DUE'
    ];

    const rows = Array.from({ length: 8 }, (_, i) => {
      const semNum = i + 1;
      const semLabel = getSemesterLabel(semNum);
      const rowCells = [semLabel];

      cohorts.forEach((c: any) => {
        const sem = c.semesters[i];
        rowCells.push(sem.fees || 0);
        rowCells.push(sem.received || 0);
        rowCells.push(sem.due || 0);
        rowCells.push(sem.nosDue || 0);
      });

      rowCells.push(semesterTotals[i]?.totalDue || 0);
      return rowCells;
    });

    const totalsRow = ['TOTALS'];
    cohorts.forEach((c: any) => {
      totalsRow.push(c.totals.fees);
      totalsRow.push(c.totals.received);
      totalsRow.push(c.totals.due);
      totalsRow.push('');
    });
    totalsRow.push(grandTotalDue);
    rows.push(totalsRow);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `executive_cohort_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const evenRate = evenReport.receivables > 0 ? Math.round((evenReport.received / evenReport.receivables) * 100) : 0;
  const oddRate = oddReport.receivables > 0 ? Math.round((oddReport.received / oddReport.receivables) * 100) : 0;

  return (
    <div className="space-y-8 animate-fade-in p-1">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 font-display">Executive Financial Reports</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time ledger analysis and cohort-based financial performance monitoring.</p>
        </div>
        <button
          onClick={handleExportCohortCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white transition-all font-semibold text-xs shadow-md cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Ledger</span>
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden ring-1 ring-gray-950/5">
        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="font-bold text-gray-900">Cohort Ledger & Outstanding Analysis</h3>
          <span className="text-[10px] font-bold text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200 uppercase tracking-widest shadow-sm">
            Live Data
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px] font-medium text-gray-600">
            <thead>
              {/* Batch name row */}
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left border-r border-gray-100 bg-gray-50/80 w-[130px]">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Semester</span>
                </th>
                {cohorts.map((cohort: any, idx: number) => {
                  const headerBg = idx === 0 ? 'from-blue-600 to-indigo-600' : idx === 1 ? 'from-rose-500 to-pink-600' : 'from-violet-600 to-purple-600';
                  return (
                    <th key={cohort.name} colSpan={4} className="px-0 py-0 border-l border-gray-200">
                      <div className={`bg-gradient-to-r ${headerBg} px-4 py-2.5 text-center`}>
                        <span className="text-xs font-bold text-white tracking-wide font-display block">{cohort.name}</span>
                        <span className="text-[9px] font-semibold text-white/70 block mt-0.5">{cohort.studentCount} students</span>
                      </div>
                    </th>
                  );
                })}
                <th className="px-4 py-0 border-l border-gray-200 bg-slate-800">
                  <div className="px-2 py-2.5 text-center">
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest block">Total</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Due</span>
                  </div>
                </th>
              </tr>
              {/* Sub-column header row */}
              <tr className="border-b-2 border-gray-200 bg-gray-50/40">
                <th className="px-4 py-2 border-r border-gray-100" />
                {cohorts.map((cohort: any, idx: number) => {
                  const subColors = idx === 0 ? 'text-blue-600 bg-blue-50/60' : idx === 1 ? 'text-rose-600 bg-rose-50/60' : 'text-violet-600 bg-violet-50/60';
                  return (
                    <React.Fragment key={cohort.name + '-sub'}>
                      <th className={`px-3 py-2 text-center border-l border-gray-100 ${subColors}`}>
                        <span className="text-[8px] font-bold uppercase tracking-wider">Fees</span>
                      </th>
                      <th className="px-3 py-2 text-center bg-emerald-50/60">
                        <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-600">Rcvd</span>
                      </th>
                      <th className="px-3 py-2 text-center bg-amber-50/60">
                        <span className="text-[8px] font-bold uppercase tracking-wider text-amber-600">Due</span>
                      </th>
                      <th className="px-3 py-2 text-center bg-slate-50">
                        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Nos</span>
                      </th>
                    </React.Fragment>
                  );
                })}
                <th className="px-4 py-2 bg-slate-100/80 border-l border-gray-200" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Array.from({ length: 8 }).map((_, semIdx) => {
                const semNum = semIdx + 1;
                return (
                  <tr key={semNum} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-900">{getSemesterLabel(semNum)}</td>
                    {cohorts.map((cohort: any) => {
                      const sem = cohort.semesters[semIdx] || { fees: 0, received: 0, due: 0, nosDue: 0 };
                      return (
                        <React.Fragment key={cohort.name + '-sem-' + semIdx}>
                          <td className="px-4 py-4 text-right border-l border-gray-100">{formatNumberForTable(sem.fees)}</td>
                          <td className="px-4 py-4 text-right text-emerald-600 font-semibold">{formatNumberForTable(sem.received)}</td>
                          <td className={`px-4 py-4 text-right font-semibold ${sem.due > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{formatNumberForTable(sem.due)}</td>
                          <td className="px-4 py-4 text-center text-rose-500 font-bold">{sem.nosDue > 0 ? sem.nosDue : '—'}</td>
                        </React.Fragment>
                      );
                    })}
                    <td className="px-6 py-4 text-right border-l border-gray-100 font-bold text-gray-900">{formatCurrency(semesterTotals[semIdx]?.totalDue || 0)}</td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td className="px-4 py-3.5 border-r border-gray-200 bg-gray-100">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Totals</span>
                </td>
                {cohorts.map((cohort: any) => (
                  <React.Fragment key={cohort.name + '-totals'}>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-gray-700 font-bold border-l border-gray-100">
                      {formatNumberForTable(cohort.totals.fees)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-emerald-700 font-bold">
                      {formatNumberForTable(cohort.totals.received)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-amber-700 font-bold">
                      {formatNumberForTable(cohort.totals.due)}
                    </td>
                    <td className="px-4 py-3.5 bg-gray-100/60" />
                  </React.Fragment>
                ))}
                <td className="px-4 py-3.5 text-right border-l border-gray-300 bg-slate-800 text-white font-mono text-sm font-bold">
                  {formatCurrency(grandTotalDue)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SEMESTER FEE REPORT CARDS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Even Semester Card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 px-6 pt-5 pb-6 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }} />
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[9px] font-bold text-blue-200 uppercase tracking-widest block">Even Semester</span>
                  <h3 className="text-base font-bold text-white mt-0.5 font-display">DEC – 2025</h3>
                </div>
                <span className="shrink-0 text-[8px] font-bold bg-white/20 border border-white/30 text-white px-2 py-0.5 rounded-md uppercase tracking-wider mt-0.5">
                  Active
                </span>
              </div>
              <p className="text-[10px] text-blue-200 font-medium mt-2">Batch 2025 (Sem 2) · Batch 2024 (Sem 4) · Batch 2023 (Sem 6)</p>
            </div>
            <div className="relative z-10 grid grid-cols-3 gap-3 mt-5">
              <div className="bg-white/15 border border-white/20 rounded-xl p-3 text-center">
                <span className="text-[8px] font-bold text-blue-200 uppercase tracking-wider block">Students</span>
                <span className="text-xl font-mono font-bold text-white block mt-0.5">{evenReport.totalStudents}</span>
              </div>
              <div className="bg-emerald-500/30 border border-emerald-400/40 rounded-xl p-3 text-center">
                <span className="text-[8px] font-bold text-emerald-200 uppercase tracking-wider block">Paid</span>
                <span className="text-xl font-mono font-bold text-white block mt-0.5">{evenReport.paidCount}</span>
              </div>
              <div className="bg-amber-500/30 border border-amber-400/40 rounded-xl p-3 text-center">
                <span className="text-[8px] font-bold text-amber-200 uppercase tracking-wider block">Pending</span>
                <span className="text-xl font-mono font-bold text-white block mt-0.5">{evenReport.pendingCount}</span>
              </div>
            </div>
          </div>

          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Collection Rate</span>
              <span className="text-[10px] font-bold text-brand-600">{evenRate}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all" style={{ width: `${Math.min(evenRate, 100)}%` }} />
            </div>
          </div>

          <div className="p-6 space-y-3 flex-1">
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Total Expected</span>
              <span className="font-mono text-gray-900 font-bold text-xs">{formatCurrency(evenReport.receivables)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Total Received (Net)</span>
              </div>
              <span className="font-mono text-emerald-600 font-bold text-xs">+{formatCurrency(evenReport.received)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Suspense Received</span>
              </div>
              <span className="font-mono text-indigo-600 font-bold text-xs">+{formatCurrency(evenReport.suspense)}</span>
            </div>
            <div className="flex justify-between items-center pt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Total Outstanding Due</span>
              </div>
              <span className="font-mono text-rose-600 font-bold text-sm">{formatCurrency(evenReport.due)}</span>
            </div>
          </div>
        </div>

        {/* Odd Semester Card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 px-6 pt-5 pb-6 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }} />
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[9px] font-bold text-emerald-200 uppercase tracking-widest block">Odd Semester</span>
                  <h3 className="text-base font-bold text-white mt-0.5 font-display">JUNE – 2026</h3>
                </div>
                <span className="shrink-0 text-[8px] font-bold bg-white/20 border border-white/30 text-white px-2 py-0.5 rounded-md uppercase tracking-wider mt-0.5">
                  Active
                </span>
              </div>
              <p className="text-[10px] text-emerald-200 font-medium mt-2">Batch 2025 (Sem 3) · Batch 2024 (Sem 5)</p>
            </div>
            <div className="relative z-10 grid grid-cols-3 gap-3 mt-5">
              <div className="bg-white/15 border border-white/20 rounded-xl p-3 text-center">
                <span className="text-[8px] font-bold text-emerald-200 uppercase tracking-wider block">Students</span>
                <span className="text-xl font-mono font-bold text-white block mt-0.5">{oddReport.totalStudents}</span>
              </div>
              <div className="bg-emerald-400/30 border border-emerald-300/40 rounded-xl p-3 text-center">
                <span className="text-[8px] font-bold text-emerald-100 uppercase tracking-wider block">Paid</span>
                <span className="text-xl font-mono font-bold text-white block mt-0.5">{oddReport.paidCount}</span>
              </div>
              <div className="bg-amber-500/30 border border-amber-400/40 rounded-xl p-3 text-center">
                <span className="text-[8px] font-bold text-amber-200 uppercase tracking-wider block">Pending</span>
                <span className="text-xl font-mono font-bold text-white block mt-0.5">{oddReport.pendingCount}</span>
              </div>
            </div>
          </div>

          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Collection Rate</span>
              <span className="text-[10px] font-bold text-emerald-600">{oddRate}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all" style={{ width: `${Math.min(oddRate, 100)}%` }} />
            </div>
          </div>

          <div className="p-6 space-y-3 flex-1">
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Total Expected</span>
              <span className="font-mono text-gray-900 font-bold text-xs">{formatCurrency(oddReport.receivables)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Total Received (Net)</span>
              </div>
              <span className="font-mono text-emerald-600 font-bold text-xs">+{formatCurrency(oddReport.received)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Suspense Received</span>
              </div>
              <span className="font-mono text-gray-700 font-bold text-xs">
                {oddReport.suspense > 0 ? `+${formatCurrency(oddReport.suspense)}` : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center pt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Total Outstanding Due</span>
              </div>
              <span className="font-mono text-rose-600 font-bold text-sm">{formatCurrency(oddReport.due)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── DAILY COLLECTION BREAKDOWN ── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-emerald-500 to-teal-500" />
            <div>
              <h4 className="font-bold text-xs text-gray-800 tracking-tight">Daily Collection Breakdown</h4>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">Categorised transactions received on the query / current day</p>
            </div>
          </div>
          <span className="bg-brand-50 border border-brand-100 text-brand-700 text-[9px] font-bold px-3 py-1 rounded-lg uppercase tracking-wider">
            Query Date
          </span>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 hover:border-slate-300 hover:shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Admissions 2026</span>
                <div className="w-7 h-7 rounded-lg bg-slate-200/80 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                </div>
              </div>
              <span className="text-xl font-mono font-bold text-slate-800">{formatCurrency(dailyBreakdown.admissions)}</span>
            </div>
            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 flex flex-col gap-3 hover:border-blue-200 hover:shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">Even Sem Fees</span>
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                  <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                </div>
              </div>
              <span className="text-xl font-mono font-bold text-blue-700">{formatCurrency(dailyBreakdown.evenSemester)}</span>
            </div>
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 flex flex-col gap-3 hover:border-emerald-200 hover:shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Odd Sem Fees</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                </div>
              </div>
              <span className="text-xl font-mono font-bold text-emerald-700">{formatCurrency(dailyBreakdown.oddSemester)}</span>
            </div>
            <div className="bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-700 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 10%, white 0%, transparent 55%)' }} />
              <div className="relative flex items-center justify-between">
                <span className="text-[9px] font-bold text-brand-200 uppercase tracking-widest">Total Received</span>
                <div className="w-7 h-7 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center">
                  <AlertCircle className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <span className="relative text-xl font-mono font-bold text-white">{formatCurrency(dailyBreakdown.totalReceived)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ================= SUB-PAGE: MANUAL BULK STUDENT ADD TAB =================
interface ManualBulkAddTabProps {
  schools: any[];
  courses: any[];
  users: any[];
  onClose: () => void;
}

interface SemesterFeeConfig {
  semesterNumber: number;
  feeAmount: number;
  receivedAmount: number;
  dueDate?: string | null;
}

interface StudentRow {
  key: string;
  name: string;
  schoolId: string;
  courseId: string;
  phonePrimary: string;
  phoneSecondary: string;
  email: string;
  counselorId: string;
  examCellRemarks: string;
  semesters: SemesterFeeConfig[];
}

const ManualBulkAddTab: React.FC<ManualBulkAddTabProps> = ({ schools, courses, users, onClose }) => {
  const [rows, setRows] = useState<StudentRow[]>([
    {
      key: Math.random().toString(),
      name: '',
      schoolId: '',
      courseId: '',
      phonePrimary: '',
      phoneSecondary: '',
      email: '',
      counselorId: '',
      examCellRemarks: '',
      semesters: [],
    },
  ]);

  const [configuringRowKey, setConfiguringRowKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any | null>(null);

  const handleAddRow = () => {
    setRows([
      ...rows,
      {
        key: Math.random().toString(),
        name: '',
        schoolId: '',
        courseId: '',
        phonePrimary: '',
        phoneSecondary: '',
        email: '',
        counselorId: '',
        examCellRemarks: '',
        semesters: [],
      },
    ]);
  };

  const handleRemoveRow = (key: string) => {
    if (rows.length === 1) return;
    setRows(rows.filter((r) => r.key !== key));
  };

  const handleFieldChange = (key: string, field: keyof StudentRow, value: any) => {
    setRows(
      rows.map((row) => {
        if (row.key === key) {
          const updated = { ...row, [field]: value };
          // Reset courseId if schoolId changes
          if (field === 'schoolId') {
            updated.courseId = '';
          }
          return updated;
        }
        return row;
      })
    );
  };

  const handleOpenFeeConfig = (key: string) => {
    setConfiguringRowKey(key);
  };

  const handleSaveFeeConfig = (semesters: SemesterFeeConfig[]) => {
    if (!configuringRowKey) return;
    setRows(
      rows.map((row) => {
        if (row.key === configuringRowKey) {
          return { ...row, semesters };
        }
        return row;
      })
    );
    setConfiguringRowKey(null);
  };

  const configuringRow = rows.find((r) => r.key === configuringRowKey);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic frontend validations
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.name.trim()) {
        alert(`Row ${i + 1} is missing Student Name.`);
        return;
      }
      if (!row.schoolId) {
        alert(`Row ${i + 1} (${row.name || 'Unknown'}) is missing School.`);
        return;
      }
      if (!row.courseId) {
        alert(`Row ${i + 1} (${row.name || 'Unknown'}) is missing Course.`);
        return;
      }
      if (!row.phonePrimary.trim()) {
        alert(`Row ${i + 1} (${row.name || 'Unknown'}) is missing Primary Phone.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = rows.map((r) => ({
        name: r.name,
        schoolId: r.schoolId,
        courseId: r.courseId,
        email: r.email || undefined,
        phonePrimary: r.phonePrimary,
        phoneSecondary: r.phoneSecondary || undefined,
        counselorId: r.counselorId || undefined,
        examCellRemarks: r.examCellRemarks || undefined,
        semesters: r.semesters
          .filter((sem) => sem.feeAmount > 0)
          .map((sem) => ({
            semesterNumber: sem.semesterNumber,
            feeAmount: sem.feeAmount,
            receivedAmount: sem.receivedAmount || undefined,
            dueDate: sem.dueDate || undefined,
          })),
      }));

      const res = await apiRequest('/students/bulk', {
        method: 'POST',
        bodyData: { students: payload },
      });
      setSubmitResult(res);
    } catch (err: any) {
      alert(`Submission failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const counselors = users.filter((u) => u.role === 'COUNSELOR');

  if (submitResult) {
    return (
      <div className="bg-white border border-gray-250 rounded-xl p-6 space-y-6 max-w-2xl mx-auto shadow-xs text-xs">
        <div>
          <h2 className="text-base font-bold text-gray-905 font-display">Manual Ingestion Results</h2>
          <p className="text-xs text-gray-500 mt-1 font-medium">Batch execution statistics and error stack for row manual inserts.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-gray-50 border border-gray-200 text-center text-xs">
          <div>
            <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Succeeded Rows</p>
            <p className="text-xl font-mono font-bold text-emerald-600">+{submitResult.successCount}</p>
          </div>
          <div>
            <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Failed Rows</p>
            <p className="text-xl font-mono font-bold text-rose-600">+{submitResult.failedCount}</p>
          </div>
        </div>

        {submitResult.errors && submitResult.errors.length > 0 && (
          <div className="rounded-lg border border-red-150 max-h-48 overflow-y-auto p-3 text-xxs text-red-700 bg-red-50/50 space-y-1.5 font-medium">
            <p className="font-bold flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-red-650" /> Failed Insert Exceptions:</p>
            {submitResult.errors.map((err: string, idx: number) => (
              <p key={idx}>• {err}</p>
            ))}
          </div>
        )}

        <div className="text-center pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg cursor-pointer shadow-xs transition-colors"
          >
            Return to Directory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-250 rounded-xl p-6 space-y-6 shadow-xs text-xs relative">
      <div>
        <h2 className="text-base font-bold text-gray-900 font-display">Manual Bulk Student Addition</h2>
        <p className="text-xs text-gray-500 mt-1 font-medium">Manually input multiple students, select courses, assign counselors, and pre-configure semester budgets.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-150 border-collapse text-xxs text-gray-650">
            <thead className="bg-gray-50 uppercase font-bold text-gray-500 tracking-wider">
              <tr>
                <th className="px-3 py-2.5 text-left border-r border-gray-150 font-bold w-12 text-center">Row</th>
                <th className="px-3 py-2.5 text-left border-r border-gray-150 font-bold min-w-[140px]">Student Name *</th>
                <th className="px-3 py-2.5 text-left border-r border-gray-150 font-bold min-w-[120px]">School *</th>
                <th className="px-3 py-2.5 text-left border-r border-gray-150 font-bold min-w-[120px]">Course *</th>
                <th className="px-3 py-2.5 text-left border-r border-gray-150 font-bold min-w-[110px]">Primary Phone *</th>
                <th className="px-3 py-2.5 text-left border-r border-gray-150 font-bold min-w-[110px]">Secondary Phone</th>
                <th className="px-3 py-2.5 text-left border-r border-gray-150 font-bold min-w-[140px]">Email ID</th>
                <th className="px-3 py-2.5 text-left border-r border-gray-150 font-bold min-w-[120px]">Counselor</th>
                <th className="px-3 py-2.5 text-left border-r border-gray-150 font-bold min-w-[110px]">Semester Fees</th>
                <th className="px-3 py-2.5 text-left border-r border-gray-150 font-bold min-w-[120px]">Remarks</th>
                <th className="px-3 py-2.5 text-center font-bold w-12">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 font-medium bg-white">
              {rows.map((row, index) => {
                const rowCourses = courses.filter((c) => c.schoolId === row.schoolId);
                const configuredSemsCount = row.semesters.filter((s) => s.feeAmount > 0).length;

                return (
                  <tr key={row.key} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-3 py-2 border-r border-gray-150 text-center text-gray-400 font-bold font-mono">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2 border-r border-gray-150">
                      <input
                        type="text"
                        placeholder="Full Name"
                        required
                        value={row.name}
                        onChange={(e) => handleFieldChange(row.key, 'name', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-brand-500"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-gray-150">
                      <select
                        required
                        value={row.schoolId}
                        onChange={(e) => handleFieldChange(row.key, 'schoolId', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded px-1.5 py-1 outline-none focus:border-brand-500"
                      >
                        <option value="">Select School</option>
                        {schools.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 border-r border-gray-150">
                      <select
                        required
                        disabled={!row.schoolId}
                        value={row.courseId}
                        onChange={(e) => handleFieldChange(row.key, 'courseId', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded px-1.5 py-1 outline-none focus:border-brand-500 disabled:opacity-40"
                      >
                        <option value="">Select Course</option>
                        {rowCourses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 border-r border-gray-150">
                      <input
                        type="text"
                        placeholder="Primary Phone"
                        required
                        value={row.phonePrimary}
                        onChange={(e) => handleFieldChange(row.key, 'phonePrimary', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-brand-500"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-gray-150">
                      <input
                        type="text"
                        placeholder="Secondary Phone"
                        value={row.phoneSecondary}
                        onChange={(e) => handleFieldChange(row.key, 'phoneSecondary', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-brand-500"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-gray-150">
                      <input
                        type="email"
                        placeholder="email@example.com"
                        value={row.email}
                        onChange={(e) => handleFieldChange(row.key, 'email', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-brand-500"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-gray-150">
                      <select
                        value={row.counselorId}
                        onChange={(e) => handleFieldChange(row.key, 'counselorId', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded px-1.5 py-1 outline-none focus:border-brand-500"
                      >
                        <option value="">Unassigned</option>
                        {counselors.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 border-r border-gray-150 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenFeeConfig(row.key)}
                        className={`px-2 py-1 rounded font-bold text-[9px] border transition-all cursor-pointer ${
                          configuredSemsCount > 0
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-gray-100 border-gray-200 text-gray-650 hover:bg-gray-200'
                        }`}
                      >
                        {configuredSemsCount > 0 ? `Configured (${configuredSemsCount} Sem)` : 'Set Fees'}
                      </button>
                    </td>
                    <td className="px-3 py-2 border-r border-gray-150">
                      <input
                        type="text"
                        placeholder="Remarks"
                        value={row.examCellRemarks}
                        onChange={(e) => handleFieldChange(row.key, 'examCellRemarks', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-brand-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        disabled={rows.length === 1}
                        onClick={() => handleRemoveRow(row.key)}
                        className="p-1 text-gray-400 hover:text-rose-650 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center pt-2">
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3.5 py-1.5 border border-brand-200 rounded-lg text-brand-650 hover:bg-brand-50 bg-white font-bold cursor-pointer transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer shadow-xs transition-all"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting Batch...</span>
                </>
              ) : (
                <span>Submit {rows.length} Students</span>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Inline Semester Fee Modal */}
      <AnimatePresence>
        {configuringRow && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-5 relative shadow-xl text-xs"
            >
              <button
                type="button"
                onClick={() => setConfiguringRowKey(null)}
                className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Configure Semester Budgets</h3>
              <p className="text-gray-500 mb-4 font-medium">
                Set manual ledger plans for <span className="text-brand-500 font-bold">{configuringRow.name || 'Unnamed Student'}</span>.
              </p>

              <FeeConfigForm
                initialSemesters={configuringRow.semesters}
                onSave={handleSaveFeeConfig}
                onCancel={() => setConfiguringRowKey(null)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ================= FEE CONFIG FORM SUBCOMPONENT =================
interface FeeConfigFormProps {
  initialSemesters: SemesterFeeConfig[];
  onSave: (semesters: SemesterFeeConfig[]) => void;
  onCancel: () => void;
}

const FeeConfigForm: React.FC<FeeConfigFormProps> = ({ initialSemesters, onSave, onCancel }) => {
  const [sems, setSems] = useState<SemesterFeeConfig[]>(() => {
    return Array.from({ length: 8 }, (_, idx) => {
      const semNum = idx + 1;
      const existing = initialSemesters.find((s) => s.semesterNumber === semNum);
      return (
        existing || {
          semesterNumber: semNum,
          feeAmount: 0,
          receivedAmount: 0,
          dueDate: null,
        }
      );
    });
  });

  const handleValueChange = (semNum: number, field: keyof SemesterFeeConfig, value: any) => {
    setSems(
      sems.map((sem) => {
        if (sem.semesterNumber === semNum) {
          return { ...sem, [field]: value };
        }
        return sem;
      })
    );
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(sems.filter((s) => s.feeAmount > 0));
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1 border-y border-gray-100 py-3">
        <div className="grid grid-cols-4 text-[9px] uppercase tracking-wider font-bold text-gray-400 mb-1 ml-0.5 text-center">
          <div className="text-left">Semester</div>
          <div>Fee Amount (₹)</div>
          <div>Received (₹)</div>
          <div>Due Date</div>
        </div>
        {sems.map((sem) => (
          <div key={sem.semesterNumber} className="grid grid-cols-4 gap-2 items-center text-center">
            <div className="text-left font-semibold text-gray-700">Sem {sem.semesterNumber}</div>
            <div>
              <input
                type="number"
                min="0"
                placeholder="e.g. 50000"
                value={sem.feeAmount || ''}
                onChange={(e) => handleValueChange(sem.semesterNumber, 'feeAmount', parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-gray-200 rounded px-2 py-1 outline-none text-center focus:border-brand-500"
              />
            </div>
            <div>
              <input
                type="number"
                min="0"
                max={sem.feeAmount}
                placeholder="e.g. 20000"
                value={sem.receivedAmount || ''}
                onChange={(e) => handleValueChange(sem.semesterNumber, 'receivedAmount', parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-gray-200 rounded px-2 py-1 outline-none text-center focus:border-brand-500 disabled:opacity-40"
                disabled={!sem.feeAmount}
              />
            </div>
            <div>
              <input
                type="date"
                value={sem.dueDate && !isNaN(Date.parse(sem.dueDate.toString())) ? new Date(sem.dueDate).toISOString().split('T')[0] : ''}
                onChange={(e) => handleValueChange(sem.semesterNumber, 'dueDate', e.target.value || null)}
                className="w-full bg-white border border-gray-200 rounded px-2 py-1 outline-none text-center focus:border-brand-500 disabled:opacity-40 text-xs"
                disabled={!sem.feeAmount}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 rounded bg-gray-100 hover:bg-gray-250 text-gray-700 font-bold cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-1.5 rounded bg-brand-500 hover:bg-brand-600 text-white font-bold cursor-pointer shadow-xs"
        >
          Apply configurations
        </button>
      </div>
    </form>
  );
};

export default AdminDashboard;
