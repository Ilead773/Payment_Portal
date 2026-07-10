import React, { useState } from 'react';
import { Search, Mail, Send, AlertTriangle, CheckCircle2, User, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiRequest from '../utils/api';

interface BulkEmailPortalProps {
  students: any[];
  users: any[];
  schools: any[];
  courses: any[];
}

export const BulkEmailPortal: React.FC<BulkEmailPortalProps> = ({
  students,
  users,
  schools,
  courses,
}) => {
  // Filter States
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedCounselorId, setSelectedCounselorId] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL'); // 'ALL' | 'DUE' | 'PAID'
  const [searchQuery, setSearchQuery] = useState('');

  // Composer States
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // Selection States
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Action States
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    successCount: number;
    failedCount: number;
    errors: string[];
  } | null>(null);

  // Helper to format currency
  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt);
  };

  // Get matching courses for the selected school
  const filteredCourses = selectedSchoolId
    ? courses.filter((c) => c.schoolId === selectedSchoolId)
    : courses;

  // Filter students based on selection criteria
  const filteredStudents = students.filter((student) => {
    if (selectedSchoolId && student.schoolId !== selectedSchoolId) return false;
    if (selectedCourseId && student.courseId !== selectedCourseId) return false;
    if (selectedCounselorId && student.counselorId !== selectedCounselorId) return false;
    
    if (paymentStatusFilter === 'DUE' && student.totalDue <= 0) return false;
    if (paymentStatusFilter === 'PAID' && student.totalDue > 0) return false;

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

  const handleSendEmails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.size === 0) {
      alert('Please select at least one student recipient.');
      return;
    }
    if (!subject.trim() || !message.trim()) {
      alert('Please fill out both the email subject and message body.');
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      const res = await apiRequest('/email/send-custom', {
        method: 'POST',
        bodyData: {
          studentIds: Array.from(selectedStudentIds),
          subject: subject.trim(),
          message: message.trim(),
        },
      });
      setSendResult(res);
      // Clear forms on success
      setSubject('');
      setMessage('');
      setSelectedStudentIds(new Set());
    } catch (err: any) {
      alert(`Failed to send emails: ${err.message}`);
    } finally {
      setIsSending(false);
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
            <Mail className="w-5 h-5 text-brand-500" />
            <span>Send Emails</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1 font-medium">Filter target student groups, review recipients, and dispatch custom email notifications.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: FILTERS & RECIPIENTS */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filters Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4 text-xs">
            <h3 className="font-bold text-[10px] uppercase tracking-wider text-gray-400">Recipient Filtering</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-bold text-gray-550 uppercase tracking-wider mb-1 ml-0.5">School / Department</label>
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
                <label className="block text-[9px] font-bold text-gray-550 uppercase tracking-wider mb-1 ml-0.5">Course</label>
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
                <label className="block text-[9px] font-bold text-gray-550 uppercase tracking-wider mb-1 ml-0.5">Assigned Counselor</label>
                <select
                  value={selectedCounselorId}
                  onChange={(e) => setSelectedCounselorId(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-gray-700 outline-none hover:border-gray-300"
                >
                  <option value="">All Counselors</option>
                  {counselors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-550 uppercase tracking-wider mb-1 ml-0.5">Payment Status</label>
                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-gray-700 outline-none hover:border-gray-300"
                >
                  <option value="ALL">All Students</option>
                  <option value="DUE">Has Outstanding Dues</option>
                  <option value="PAID">Dues Fully Cleared</option>
                </select>
              </div>
            </div>

            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search by student name, email, or phone number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50/50 border border-gray-200 rounded-md pl-9 pr-3 py-1.5 outline-none focus:border-brand-500 focus:bg-white text-xs placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Recipients List Table */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden text-xs">
            <div className="px-5 py-3 border-b border-gray-150 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[10px] uppercase tracking-wider text-gray-400">Filtered Directory</h3>
                <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Matching records: {filteredStudents.length}</p>
              </div>
              <span className="bg-brand-50 border border-brand-100 text-brand-700 font-bold px-2.5 py-0.5 rounded text-[10px]">
                Selected: {filteredStudents.filter((s) => selectedStudentIds.has(s.id)).length} students
              </span>
            </div>

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-150 text-[9px] uppercase tracking-wider font-bold text-gray-400 select-none text-center">
                    <th className="px-4 py-2.5 text-left w-10">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={handleToggleSelectAll}
                        className="w-3.5 h-3.5 border-gray-300 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                        disabled={filteredStudents.length === 0}
                      />
                    </th>
                    <th className="px-4 py-2.5 text-left">Student</th>
                    <th className="px-4 py-2.5 text-left">School / Course</th>
                    <th className="px-4 py-2.5 text-left">Counselor</th>
                    <th className="px-4 py-2.5">Total Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center font-bold text-gray-400">
                        No students match the current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => {
                      const isSelected = selectedStudentIds.has(student.id);
                      return (
                        <tr
                          key={student.id}
                          onClick={() => handleToggleSelect(student.id)}
                          className={`hover:bg-gray-50/50 cursor-pointer transition-colors ${
                            isSelected ? 'bg-brand-50/10' : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(student.id)}
                              className="w-3.5 h-3.5 border-gray-300 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-800">
                            <div>{student.name}</div>
                            <div className="text-[10px] text-gray-400 font-normal">{student.email || 'No email ID configured'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-600">{student.school?.name}</div>
                            <div className="text-[10px] text-gray-400">{student.course?.name}</div>
                          </td>
                          <td className="px-4 py-3 italic text-gray-400 font-normal">
                            {student.counselor?.name || <span className="text-amber-600 not-italic font-bold">Unassigned</span>}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-gray-700">
                            {formatCurrency(student.totalDue || 0)}
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

        {/* RIGHT COLUMN: EMAIL COMPOSER */}
        <div className="space-y-6">
          <form onSubmit={handleSendEmails} className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4 text-xs">
            <h3 className="font-bold text-[10px] uppercase tracking-wider text-gray-400">Email Composer</h3>
            
            <div className="bg-blue-50/40 border border-blue-150 rounded-lg p-3 text-blue-750 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Target Audience size</span>
              </p>
              <p className="font-medium">
                This custom email will be sent to <strong>{selectedStudentIds.size}</strong> selected student(s).
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-wider mb-1 ml-0.5">Subject</label>
              <input
                type="text"
                required
                placeholder="e.g. Action Required: Tuition Fee Submission Deadline"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full premium-input focus:border-brand-500 focus:bg-white text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-wider mb-1 ml-0.5">Message Body</label>
              <textarea
                required
                rows={8}
                placeholder="Write your email body message here. You can use standard formatting. Paragraph breaks will be preserved."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full premium-input focus:border-brand-500 focus:bg-white text-xs"
              />
              <span className="text-[10px] text-gray-400 block mt-1">Tip: Paragraph line breaks are automatically converted to HTML email format.</span>
            </div>

            <button
              type="submit"
              disabled={isSending || selectedStudentIds.size === 0}
              className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing custom blast...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Custom Emails</span>
                </>
              )}
            </button>
          </form>

          {/* SENDING RESULT CARD */}
          <AnimatePresence>
            {sendResult && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-3 text-xs"
              >
                <div className="flex items-center gap-2 text-emerald-600 border-b border-gray-100 pb-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <h3 className="font-bold text-gray-905">Dispatch Summary</h3>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center py-1">
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-2">
                    <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Success</span>
                    <span className="block text-lg font-bold text-emerald-600 font-mono mt-0.5">+{sendResult.successCount}</span>
                  </div>
                  <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-2">
                    <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Failed</span>
                    <span className="block text-lg font-bold text-rose-600 font-mono mt-0.5">+{sendResult.failedCount}</span>
                  </div>
                </div>

                {sendResult.errors && sendResult.errors.length > 0 && (
                  <div className="space-y-1.5 pt-1.5 border-t border-gray-100">
                    <p className="font-bold text-[9px] text-amber-600 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Audit Errors:</span>
                    </p>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                      {sendResult.errors.map((err, idx) => (
                        <div key={idx} className="bg-amber-50/50 border border-amber-100 rounded p-1.5 text-xxs font-semibold text-amber-800 leading-tight">
                          {err}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
export default BulkEmailPortal;
