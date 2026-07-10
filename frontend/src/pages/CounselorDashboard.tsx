import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { 
  Calendar, AlertCircle, Phone, Search, RefreshCw, 
  MessageSquare, ArrowRight, Clock, TrendingUp
} from 'lucide-react';
import { useNavigationStore } from '../context/navigationStore';
import { motion, AnimatePresence } from 'framer-motion';

export const CounselorDashboard: React.FC = () => {
  const { activeTab, setActiveTab } = useNavigationStore();

  // Scoped states
  const [students, setStudents] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalStudents: 0,
    totalPending: 0,
    dueNowCount: 0,
    overdueCount: 0,
    upcomingFollowUps: []
  });
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentDetails, setStudentDetails] = useState<any>(null);

  // Daily checklist state for counselor targets
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Complete morning callback schedule', completed: true },
    { id: 2, text: 'Verify 5 pending dues collections', completed: false },
    { id: 3, text: 'Audit outstanding ledger accounts over ₹50,000', completed: false },
    { id: 4, text: 'Follow up with unassigned calling queue', completed: false }
  ]);

  // Call Outcomes
  const callOutcomes = [
    { value: 'CONNECTED', label: 'Connected' },
    { value: 'DID_NOT_ANSWER', label: "Didn't Answer" },
    { value: 'BUSY', label: 'Busy' },
    { value: 'SWITCHED_OFF', label: 'Switched Off' },
    { value: 'WRONG_NUMBER', label: 'Wrong Number' },
    { value: 'WILL_PAY_TODAY', label: 'Will Pay Today' },
    { value: 'WILL_PAY_TOMORROW', label: 'Will Pay Tomorrow' },
    { value: 'WILL_PAY_THIS_WEEK', label: 'Will Pay This Week' },
    { value: 'PARENT_WILL_PAY', label: 'Parent Will Pay' },
    { value: 'FOLLOW_UP_REQUIRED', label: 'Follow-up Required' }
  ];

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [stdData, statsData, schData, crsData] = await Promise.all([
        apiRequest('/students'),
        apiRequest('/dashboard/counselor'),
        apiRequest('/schools'),
        apiRequest('/schools/courses')
      ]);
      setStudents(stdData);
      setStats(statsData);
      setSchools(schData);
      setCourses(crsData);
    } catch (err: any) {
      alert(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchStudentDetails = async (studentId: string) => {
    try {
      const data = await apiRequest(`/students/${studentId}`);
      setStudentDetails(data);
    } catch (err: any) {
      alert(`Failed to load student details: ${err.message}`);
    }
  };

  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student);
    setStudentDetails(null);
    fetchStudentDetails(student.id);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const pageTransition = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.18, ease: 'easeInOut' }
  } as const;

  // ================= TAB ROUTING RENDERS =================

  // 1. Overview Dashboard Tab
  if (activeTab === 'dashboard') {
    return (
      <motion.div {...pageTransition} className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 font-display">Counselor Overview</h1>
          <p className="text-gray-500 text-xs mt-1 font-medium">Real-time outstanding balances, callback schedules, and assigned metrics.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between shadow-xs min-h-[140px]">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Assigned Dues Portfolio</span>
              <span className="text-2xl font-mono font-bold text-gray-900 mt-2 block">{formatCurrency(stats.totalPending || 0)}</span>
            </div>
            <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xxs font-semibold text-gray-400 uppercase">
              <span>Managed Account Base</span>
              <span className="font-mono text-gray-700 font-bold">{stats.totalStudents || 0} enrolled students</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Due-Now Accounts</span>
                <span className="text-lg font-mono font-bold text-emerald-600 mt-1 block">{stats.dueNowCount || 0}</span>
              </div>
              <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Overdue Callbacks</span>
                <span className="text-lg font-mono font-bold text-rose-600 mt-1 block">{stats.overdueCount || 0}</span>
              </div>
              <div className="p-2 bg-rose-50 border border-rose-100 rounded-lg text-rose-600">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Call Reminders / Upcoming Timeline */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5 shadow-xs">
          <h3 className="font-semibold text-xs text-gray-800 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-brand-500" />
            <span>My Callback Reminders</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.upcomingFollowUps?.length > 0 ? (
              stats.upcomingFollowUps.map((f: any) => (
                <div key={f.id} className="p-4 rounded-lg border border-gray-200 bg-gray-50 flex flex-col justify-between shadow-xs hover:border-gray-300 transition-colors">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-bold text-gray-855 text-xs">{f.studentName}</p>
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 font-bold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">
                        {f.outcome.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xxs text-gray-550 line-clamp-2 leading-relaxed font-semibold">{f.notes}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-200 flex items-center gap-1.5 text-xxs text-amber-600 font-bold">
                    <Clock className="w-3 h-3" />
                    <span>Callback: {new Date(f.scheduledFollowUp).toLocaleString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 col-span-3 text-center py-12">No upcoming callback tasks scheduled.</p>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // 2. My Performance Tab
  if (activeTab === 'performance') {
    return (
      <motion.div {...pageTransition} className="space-y-6 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 font-display">My Performance</h1>
          <p className="text-gray-500 text-xs mt-1 font-medium">Daily call metrics, collection waived waivers, and targets tracking.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Hero metric: conversion rate */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between shadow-xs md:col-span-1 min-h-[140px]">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Average Connect Rate</span>
              <span className="text-3xl font-mono font-bold text-brand-600 mt-2 block">78.5%</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-gray-450 font-bold uppercase mt-4">
              <TrendingUp className="w-3.5 h-3.5 text-brand-500" />
              <span>Above target average (70%)</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between shadow-xs md:col-span-1">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Calls Logged (MTD)</span>
              <span className="text-3xl font-mono font-bold text-gray-900 mt-2 block">142</span>
            </div>
            <p className="text-[9px] text-gray-400 font-bold uppercase">Target: 200 calls / month</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between shadow-xs md:col-span-1">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Waived Collections</span>
              <span className="text-3xl font-mono font-bold text-emerald-600 mt-2 block">{formatCurrency(stats.totalPending ? stats.totalPending * 0.12 : 0)}</span>
            </div>
            <p className="text-[9px] text-gray-455 font-bold uppercase">MTD collection target cleared (12%)</p>
          </div>
        </div>

        {/* Daily Checklist Tracker */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-xs max-w-xl">
          <h3 className="font-semibold text-xs text-gray-800 uppercase tracking-wider">Daily Workspace Targets</h3>
          <div className="space-y-2.5">
            {tasks.map(t => (
              <label key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-150 cursor-pointer hover:bg-gray-100/50 transition-colors">
                <input
                  type="checkbox"
                  checked={t.completed}
                  onChange={() => {
                    setTasks(tasks.map(item => item.id === t.id ? { ...item, completed: !item.completed } : item));
                  }}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500/10 cursor-pointer"
                />
                <span className={`text-xs ${t.completed ? 'line-through text-gray-400 font-normal' : 'text-gray-700 font-semibold'}`}>{t.text}</span>
              </label>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  // 3. Call Schedule Tab
  if (activeTab === 'schedule') {
    // Collect all follow-ups from student logs
    const callReminders = students
      .filter(s => s.counselorId && s.callLogs?.length > 0)
      .flatMap(s => s.callLogs.map((log: any) => ({ ...log, student: s })))
      .filter(l => l.scheduledFollowUp)
      .sort((a, b) => new Date(a.scheduledFollowUp).getTime() - new Date(b.scheduledFollowUp).getTime());

    return (
      <motion.div {...pageTransition} className="space-y-6 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 font-display">My Call Schedule</h1>
          <p className="text-gray-505 text-xs mt-1 font-medium font-display">Upcoming callback assignments and active follow-up targets.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
          <h3 className="font-semibold text-xs text-gray-800 uppercase tracking-wider mb-4">Chronological Agenda</h3>
          
          <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
            <table className="min-w-full divide-y divide-gray-150 text-xxs text-gray-600">
              <thead className="bg-gray-50 uppercase font-bold text-gray-450 tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left border-r border-gray-150">Student Name</th>
                  <th scope="col" className="px-4 py-2.5 text-center border-r border-gray-150">Scheduled Time</th>
                  <th scope="col" className="px-4 py-2.5 text-center border-r border-gray-150">Last Outcome</th>
                  <th scope="col" className="px-4 py-2.5 text-left border-r border-gray-150">Last Remarks</th>
                  <th scope="col" className="px-4 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 font-medium">
                {callReminders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                      No upcoming callbacks scheduled. Log outcome notes on calling files to trigger agenda tasks.
                    </td>
                  </tr>
                ) : (
                  callReminders.map((log: any) => (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 font-bold text-gray-800 border-r border-gray-150">
                        {log.student.name}
                      </td>
                      <td className="px-4 py-2.5 text-center border-r border-gray-150 font-mono font-bold text-brand-600">
                        {new Date(log.scheduledFollowUp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-center border-r border-gray-150">
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold">
                          {log.outcome.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 border-r border-gray-150 text-gray-500 max-w-xs truncate leading-normal">
                        {log.notes}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => {
                            setSelectedStudent(log.student);
                            setStudentDetails(null);
                            fetchStudentDetails(log.student.id);
                            setActiveTab('crm');
                          }}
                          className="px-2 py-1 rounded bg-brand-50 border border-brand-100 hover:bg-brand-500 hover:text-white text-brand-650 text-[9px] font-bold cursor-pointer transition-colors"
                        >
                          Open calling profile
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    );
  }

  // 4. Student Directory Tab (Read-Only reference lookups)
  if (activeTab === 'students') {
    const lookupStudents = students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
        String(s.phonePrimary).includes(search);
      const matchesSchool = schoolFilter ? s.schoolId === schoolFilter : true;
      const matchesCourse = courseFilter ? s.courseId === courseFilter : true;
      return matchesSearch && matchesSchool && matchesCourse;
    });

    return (
      <motion.div {...pageTransition} className="space-y-6 text-xs">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 font-display">Student Lookup Directory</h1>
            <p className="text-gray-505 text-xs mt-1 font-medium font-display">Read-only student roster lookup for contact references and dues scopes.</p>
          </div>
        </div>

        {/* Filter and Table box */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            <div className="flex gap-2.5 flex-1 max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by student name or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 glass-input text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <select
                value={schoolFilter}
                onChange={(e) => { setSchoolFilter(e.target.value); setCourseFilter(''); }}
                className="bg-white border border-gray-205 rounded-md px-2.5 py-1.5 text-xs text-gray-700 outline-none hover:border-gray-300"
              >
                <option value="">All Schools</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>

              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                disabled={!schoolFilter}
                className="bg-white border border-gray-205 rounded-md px-2.5 py-1.5 text-xs text-gray-700 outline-none hover:border-gray-300 disabled:opacity-40"
              >
                <option value="">All Courses</option>
                {courses
                  .filter(c => c.schoolId === schoolFilter)
                  .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 overflow-x-auto bg-white">
            <table className="min-w-full divide-y divide-gray-150 text-xxs text-gray-600">
              <thead className="bg-gray-50 uppercase font-bold text-gray-450 tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left border-r border-gray-150">Student Name</th>
                  <th scope="col" className="px-4 py-2.5 text-left border-r border-gray-150">School</th>
                  <th scope="col" className="px-4 py-2.5 text-left border-r border-gray-150">Course</th>
                  <th scope="col" className="px-4 py-2.5 text-center border-r border-gray-150">Total Outstanding</th>
                  <th scope="col" className="px-4 py-2.5 text-center border-r border-gray-150">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-center">Reference actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 font-medium">
                {lookupStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      No matching student files found.
                    </td>
                  </tr>
                ) : (
                  lookupStudents.map(s => {
                    const isDropped = s.status === 'DROPPED_OUT';
                    return (
                      <tr key={s.id} className={`hover:bg-gray-50/50 ${isDropped ? 'bg-red-50/10 text-gray-550' : ''}`}>
                        <td className="px-4 py-2.5 font-bold text-gray-800 border-r border-gray-150">
                          {s.name}
                        </td>
                        <td className="px-4 py-2.5 border-r border-gray-150">{s.school?.name}</td>
                        <td className="px-4 py-2.5 border-r border-gray-150">{s.course?.name}</td>
                        <td className="px-4 py-2.5 border-r border-gray-150 text-center font-mono font-bold">
                          {formatCurrency(s.totalDue)}
                        </td>
                        <td className="px-4 py-2.5 border-r border-gray-150 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold border ${
                            isDropped ? 'bg-rose-50 border-rose-100 text-rose-650' : 'bg-emerald-50 border-emerald-100 text-emerald-650'
                          }`}>
                            {isDropped ? 'Drop Out' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex gap-1.5 justify-center">
                            <button
                              onClick={() => {
                                handleSelectStudent(s);
                                setActiveTab('crm');
                              }}
                              className="px-2 py-1 rounded bg-brand-50 border border-brand-100 hover:bg-brand-500 hover:text-white text-brand-650 text-[9px] font-bold cursor-pointer transition-colors"
                            >
                              Load CRM
                            </button>
                            <a
                              href={`tel:${s.phonePrimary}`}
                              className="px-2 py-1 rounded bg-gray-50 border border-gray-205 hover:bg-gray-100 text-gray-600 text-[9px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Phone className="w-2.5 h-2.5 text-gray-400" />
                              <span>Call</span>
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    );
  }

  // 5. Calling CRM Tab (Segmented lists)
  const crmAssignedList = students.filter(s => s.counselorId); // Only show students assigned to this counselor

  const filteredCrmStudents = crmAssignedList.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      String(s.phonePrimary).includes(search);
    return matchesSearch;
  });

  return (
    <motion.div {...pageTransition} className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs md:text-sm">
      {/* Sidebar Directory */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col h-[650px] lg:col-span-1 shadow-xs">
        <div className="mb-4">
          <h3 className="font-semibold text-xs text-gray-805 uppercase tracking-wider mb-3">Assigned Students</h3>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by student name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 glass-input text-xs"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <div className="py-12 text-center text-gray-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-600" />
              <span>Loading assigned list...</span>
            </div>
          ) : filteredCrmStudents.length === 0 ? (
            <div className="text-center py-12 text-gray-400 space-y-2.5">
              <AlertCircle className="w-6 h-6 mx-auto text-gray-300" />
              <p className="font-bold text-gray-500 text-xs">No assigned students</p>
              <p className="text-[10px] text-gray-450 leading-relaxed font-semibold px-2">Log in as Admin to assign students to Counselor One.</p>
            </div>
          ) : (
            filteredCrmStudents.map(s => {
              const isSelected = selectedStudent?.id === s.id;
              const hasDues = s.totalDue > 0;
              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectStudent(s)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between shadow-xs ${
                    isSelected 
                      ? 'bg-brand-50 border-brand-200 text-brand-850' 
                      : 'bg-gray-50/50 border-gray-150 hover:bg-gray-55 text-gray-655'
                  }`}
                >
                  <div>
                    <p className="font-bold text-xs text-gray-850">{s.name}</p>
                    <p className="text-xxs text-gray-400 mt-0.5 font-bold">{s.course?.name || ''} ({s.school?.name})</p>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className={`text-xxs font-mono font-bold px-1.5 py-0.5 rounded ${hasDues ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {hasDues ? `Due: ₹${s.totalDue}` : 'Cleared'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Detail Card Panel */}
      <div className="lg:col-span-2 space-y-5">
        <AnimatePresence mode="wait">
          {selectedStudent ? (
            studentDetails ? (
              <motion.div
                key={selectedStudent.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-5"
              >
                {/* Info Header */}
                <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-xs">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 tracking-tight font-display">{studentDetails.name}</h2>
                      <p className="text-xs text-gray-500 mt-1 font-medium">
                        Course: <span className="text-gray-850 font-bold">{studentDetails.course?.name}</span> • 
                        School: <span className="text-gray-850 font-bold">{studentDetails.school?.name}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2.5 py-0.5 rounded border text-xxs font-bold uppercase tracking-wider ${
                        studentDetails.status === 'DROPPED_OUT' 
                          ? 'bg-rose-50 border-rose-200 text-rose-650' 
                          : 'bg-emerald-50 border-emerald-200 text-emerald-650'
                      }`}>
                        {studentDetails.status === 'DROPPED_OUT' ? 'Drop Out' : 'Active'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-3 rounded-lg border border-gray-150 mb-6">
                    <div>
                      <span className="text-[10px] text-gray-450 uppercase font-bold tracking-wider block">Primary Phone</span>
                      <a href={`tel:${studentDetails.phonePrimary}`} className="text-brand-600 hover:underline flex items-center gap-1.5 mt-1 font-bold">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{studentDetails.phonePrimary}</span>
                      </a>
                    </div>
                    {studentDetails.phoneSecondary && (
                      <div>
                        <span className="text-[10px] text-gray-450 uppercase font-bold tracking-wider block">Secondary Phone</span>
                        <a href={`tel:${studentDetails.phoneSecondary}`} className="text-brand-600 hover:underline flex items-center gap-1.5 mt-1 font-bold">
                          <Phone className="w-3.5 h-3.5" />
                          <span>{studentDetails.phoneSecondary}</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Ledger Breakdown (Read-Only) */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-[9px] text-gray-450 uppercase tracking-wider">Fee Breakdown</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {studentDetails.semesters.map((sem: any) => {
                        const hasPlan = sem.feeAmount !== null;
                        return (
                          <div 
                            key={sem.semesterNumber} 
                            className={`p-3 rounded-lg border ${
                              !hasPlan 
                                ? 'bg-gray-50/50 border-gray-100 opacity-30' 
                                : sem.due > 0 
                                  ? 'bg-amber-50 border-amber-200' 
                                  : 'bg-gray-50 border-gray-150'
                            }`}
                          >
                            <p className="font-bold text-gray-500 text-xxs">Semester {sem.semesterNumber}</p>
                            {!hasPlan ? (
                              <p className="text-gray-350 mt-1 italic font-semibold">-</p>
                            ) : (
                              <div className="mt-1 space-y-0.5 text-xxs font-bold">
                                <p className="text-gray-500 font-mono">Fee: ₹{sem.feeAmount}</p>
                                <p className="text-emerald-650 font-mono">Rec: ₹{sem.receivedAmount}</p>
                                <p className={`font-bold font-mono mt-1 ${sem.due > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                  Due: ₹{sem.due}
                                </p>
                                {sem.dueDate && (
                                  <p className="text-gray-405 text-[9px] font-normal leading-tight mt-1">
                                    Due: {new Date(sem.dueDate).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Call Logger & History Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-xs">
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-gray-800 mb-4 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-brand-605" />
                      <span>Log Follow-up Call</span>
                    </h3>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const payload = {
                          studentId: studentDetails.id,
                          notes: formData.get('notes') as string,
                          outcome: formData.get('outcome') as string,
                          scheduledFollowUp: formData.get('scheduledFollowUp') as string || undefined
                        };

                        try {
                          await apiRequest('/call-logs', {
                            method: 'POST',
                            bodyData: payload,
                          });
                          fetchStudentDetails(studentDetails.id);
                          fetchData();
                          e.currentTarget.reset();
                        } catch (err: any) {
                          alert(err.message);
                        }
                      }}
                      className="space-y-4 text-xs"
                    >
                      <div>
                        <label className="block text-gray-550 font-bold mb-1">Call Outcome</label>
                        <select
                          name="outcome"
                          required
                          className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-gray-750 outline-none hover:border-gray-300"
                        >
                          <option value="">Select Outcome</option>
                          {callOutcomes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-gray-550 font-bold mb-1">Scheduled Callback Date</label>
                        <input
                          name="scheduledFollowUp"
                          type="datetime-local"
                          className="w-full premium-input"
                        />
                      </div>

                      <div>
                        <label className="block text-gray-550 font-bold mb-1">Call Notes Summary</label>
                        <textarea
                          name="notes"
                          required
                          rows={3}
                          placeholder="Provide details about the call conversation..."
                          className="w-full premium-input"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold shadow-xs cursor-pointer transition-colors"
                      >
                        Log CRM Action
                      </button>
                    </form>
                  </div>

                  {/* Call Timeline History */}
                  <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col justify-between shadow-xs">
                    <div>
                      <h3 className="font-semibold text-xs uppercase tracking-wider text-gray-805 mb-4 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-brand-605" />
                        <span>Timeline History</span>
                      </h3>

                      <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                        {studentDetails.callLogs?.length > 0 ? (
                          studentDetails.callLogs.map((log: any) => (
                            <div key={log.id} className="p-3 rounded-lg border border-gray-250 bg-gray-50 text-xxs relative shadow-xs">
                              <span className="absolute top-2 right-2 text-[8px] text-gray-455 font-bold tracking-wide">
                                {new Date(log.createdAt).toLocaleDateString()}
                              </span>
                              <p className="font-bold text-brand-600">{log.outcome.replace(/_/g, ' ')}</p>
                              <p className="text-gray-500 mt-1 leading-normal font-semibold">{log.notes}</p>
                              {log.scheduledFollowUp && (
                                <p className="text-[9px] text-amber-600 font-bold mt-2 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>Callback: {new Date(log.scheduledFollowUp).toLocaleString()}</span>
                                </p>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-gray-400 text-center py-8">No calling timeline logs</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-400 flex items-center justify-center gap-2 shadow-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-brand-605" />
                <span>Loading student portfolio...</span>
              </div>
            )
          ) : (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-16 text-center text-gray-400 flex flex-col items-center justify-center shadow-xs">
              <ArrowRight className="w-6 h-6 text-gray-300 mb-2 rotate-90 lg:rotate-0" />
              <p className="font-bold text-gray-600 text-sm">No Student Selected</p>
              <p className="text-gray-450 text-xs mt-1 font-medium">Please select a student from the sidebar panel to view details and calling timelines.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
export default CounselorDashboard;
