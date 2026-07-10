import React, { useState } from 'react';
import { Search, UserCheck, AlertTriangle, CheckCircle2, User, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiRequest from '../utils/api';

interface BulkCounselorAssignTabProps {
  students: any[];
  users: any[];
  schools: any[];
  courses: any[];
  onRefresh: () => void;
}

export const BulkCounselorAssignTab: React.FC<BulkCounselorAssignTabProps> = ({
  students,
  users,
  schools,
  courses,
  onRefresh,
}) => {
  // Filter States
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedCounselorId, setSelectedCounselorId] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'ACTIVE' | 'DROPPED_OUT'
  const [searchQuery, setSearchQuery] = useState('');

  // Target Counselor State
  const [targetCounselorId, setTargetCounselorId] = useState('');

  // Selection States
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Action States
  const [isAssigning, setIsAssigning] = useState(false);
  const [actionResult, setActionResult] = useState<{
    success: boolean;
    count: number;
    message?: string;
  } | null>(null);

  // Get matching courses for the selected school
  const filteredCourses = selectedSchoolId
    ? courses.filter((c) => c.schoolId === selectedSchoolId)
    : courses;

  // Filter students based on selection criteria
  const filteredStudents = students.filter((student) => {
    if (selectedSchoolId && student.schoolId !== selectedSchoolId) return false;
    if (selectedCourseId && student.courseId !== selectedCourseId) return false;
    
    // Support filtering by current counselor (including "unassigned")
    if (selectedCounselorId) {
      if (selectedCounselorId === 'unassigned') {
        if (student.counselorId) return false;
      } else {
        if (student.counselorId !== selectedCounselorId) return false;
      }
    }
    
    if (statusFilter && student.status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = student.name?.toLowerCase().includes(q);
      const emailMatch = student.email?.toLowerCase().includes(q);
      const phoneMatch = student.phonePrimary?.includes(q) || student.phoneSecondary?.includes(q);
      if (!nameMatch && !emailMatch && !phoneMatch) return false;
    }

    return true;
  });

  // Handle individual selection toggle
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedStudentIds(next);
  };

  // Handle toggle select all filtered students
  const handleToggleSelectAll = () => {
    const allFilteredIds = filteredStudents.map((s) => s.id);
    const areAllSelected = allFilteredIds.every((id) => selectedStudentIds.has(id));

    const next = new Set(selectedStudentIds);
    if (areAllSelected) {
      // Remove all filtered from selection
      allFilteredIds.forEach((id) => next.delete(id));
    } else {
      // Add all filtered to selection
      allFilteredIds.forEach((id) => next.add(id));
    }
    setSelectedStudentIds(next);
  };

  const handleBulkAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.size === 0) {
      alert('Please select at least one student.');
      return;
    }
    
    setIsAssigning(true);
    setActionResult(null);

    try {
      const res = await apiRequest('/students/bulk-assign', {
        method: 'POST',
        bodyData: {
          studentIds: Array.from(selectedStudentIds),
          counselorId: targetCounselorId || null, // null if 'Unassign' is selected
        },
      });

      setActionResult({
        success: true,
        count: res.count,
      });

      // Clear selection
      setSelectedStudentIds(new Set());
      setTargetCounselorId('');
      
      // Refresh parent dashboard data
      onRefresh();
    } catch (err: any) {
      setActionResult({
        success: false,
        count: 0,
        message: err.message,
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const counselors = users.filter((u) => u.role === 'COUNSELOR');
  const allFilteredSelected = filteredStudents.length > 0 && filteredStudents.every((s) => selectedStudentIds.has(s.id));

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Header banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-gray-905 font-display flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-brand-500" />
            <span>Bulk Counselor Assignment</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            Filter students across departments, select recipients, and assign them to a counselor in one action.
          </p>
        </div>
      </div>

      {/* Action Results */}
      <AnimatePresence>
        {actionResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl border flex gap-3 ${
              actionResult.success 
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50/70 border-rose-200 text-rose-800'
            }`}
          >
            {actionResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-xs font-bold">
                {actionResult.success 
                  ? `Successfully updated ${actionResult.count} student(s).` 
                  : 'Assignment failed.'
                }
              </p>
              {actionResult.message && <p className="text-xxs font-medium mt-1 opacity-90">{actionResult.message}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: FILTERS & RECIPIENTS */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filters Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4 text-xs">
            <h3 className="font-bold text-[10px] uppercase tracking-wider text-gray-400">Search and Filter Students</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1 ml-0.5">School / Department</label>
                <select
                  value={selectedSchoolId}
                  onChange={(e) => {
                    setSelectedSchoolId(e.target.value);
                    setSelectedCourseId(''); // Reset course selection
                  }}
                  className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-gray-700 outline-none hover:border-gray-300"
                >
                  <option value="">All Schools</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-550 uppercase tracking-wider mb-1 ml-0.5">Course / Stream</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-gray-700 outline-none hover:border-gray-300"
                >
                  <option value="">All Courses</option>
                  {filteredCourses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-550 uppercase tracking-wider mb-1 ml-0.5">Current Assigned Counselor</label>
                <select
                  value={selectedCounselorId}
                  onChange={(e) => setSelectedCounselorId(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-gray-700 outline-none hover:border-gray-300"
                >
                  <option value="">All Students</option>
                  <option value="unassigned">Unassigned Only</option>
                  {counselors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-555 uppercase tracking-wider mb-1 ml-0.5">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-gray-700 outline-none hover:border-gray-300"
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="DROPPED_OUT">Dropped Out</option>
                </select>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by student name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 bg-white border border-gray-200 rounded-md px-3 py-1.5 text-xs text-gray-700 outline-none hover:border-gray-300 focus:border-brand-500"
              />
            </div>
          </div>

          {/* Student Selection Table Card */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Matching Students ({filteredStudents.length})
              </span>
              <span className="text-[10px] bg-brand-50 border border-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-bold">
                {selectedStudentIds.size} Selected
              </span>
            </div>

            <div className="overflow-x-auto max-h-[450px]">
              <table className="min-w-full divide-y divide-gray-150 text-xxs text-gray-600">
                <thead className="bg-gray-100/50 uppercase font-semibold text-gray-500 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="w-10 px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={handleToggleSelectAll}
                        disabled={filteredStudents.length === 0}
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer w-3.5 h-3.5"
                      />
                    </th>
                    <th scope="col" className="px-3 py-3 text-left font-bold">Student Name</th>
                    <th scope="col" className="px-3 py-3 text-left font-bold">School</th>
                    <th scope="col" className="px-3 py-3 text-left font-bold">Course</th>
                    <th scope="col" className="px-3 py-3 text-left font-bold">Current Counselor</th>
                    <th scope="col" className="px-3 py-3 text-center font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 bg-white">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-semibold">
                        No students match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => {
                      const isSelected = selectedStudentIds.has(student.id);
                      return (
                        <tr
                          key={student.id}
                          className={`hover:bg-gray-50/50 transition-colors ${isSelected ? 'bg-brand-50/20' : ''}`}
                        >
                          <td className="px-4 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(student.id)}
                              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer w-3.5 h-3.5"
                            />
                          </td>
                          <td className="px-3 py-2.5 font-bold text-gray-800 text-left">{student.name}</td>
                          <td className="px-3 py-2.5 text-left">{student.school?.name || student.schoolId}</td>
                          <td className="px-3 py-2.5 text-left">{student.course?.name || student.courseId}</td>
                          <td className="px-3 py-2.5 text-left font-medium">
                            {student.counselor ? (
                              <span className="flex items-center gap-1.5">
                                <User className="w-3 h-3 text-gray-400" />
                                {student.counselor.name}
                              </span>
                            ) : (
                              <span className="text-amber-600 font-bold italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                student.status === 'ACTIVE'
                                  ? 'bg-emerald-55 border border-emerald-100 text-emerald-700'
                                  : 'bg-rose-55 border border-rose-100 text-rose-700'
                              }`}
                            >
                              {student.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ACTION PANEL */}
        <div>
          <form
            onSubmit={handleBulkAssign}
            className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4 text-xs sticky top-4"
          >
            <h3 className="font-bold text-[10px] uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-brand-500" />
              <span>Assignment Action</span>
            </h3>

            <div className="bg-gray-50 border border-gray-150 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center text-xxs font-semibold text-gray-500">
                <span>Selected Students:</span>
                <span className="text-gray-800 font-bold text-xs bg-white px-2 py-0.5 rounded border border-gray-200">
                  {selectedStudentIds.size}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-gray-550 uppercase tracking-wider mb-1 ml-0.5">
                  Target Counselor
                </label>
                <select
                  value={targetCounselorId}
                  onChange={(e) => setTargetCounselorId(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-gray-700 outline-none hover:border-gray-300"
                >
                  <option value="">Unassign (Clear Counselor)</option>
                  {counselors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isAssigning || selectedStudentIds.size === 0}
                className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-bold py-2 px-4 rounded-lg shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer text-xs"
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Assigning...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Assign Counselor</span>
                  </>
                )}
              </button>
            </div>
            
            {selectedStudentIds.size === 0 && (
              <p className="text-[10px] text-center text-gray-400 italic">
                * Check students in the directory to enable assignment.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
export default BulkCounselorAssignTab;
