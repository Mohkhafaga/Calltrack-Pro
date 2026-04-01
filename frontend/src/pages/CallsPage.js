import React, { useState, useEffect, useCallback } from 'react';
import { getCalls, getQueues, updateFollowUp } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FiPhone, FiSearch, FiEye, FiRefreshCw, FiLock } from 'react-icons/fi';
import CallDetailModal from '../components/CallDetailModal';
import FollowUpModal from '../components/FollowUpModal';

const DATE_FILTERS = [
  { label: 'اليوم', key: 'today' },
  { label: 'أمس', key: 'yesterday' },
  { label: 'آخر 7 أيام', key: '7days' },
  { label: 'هذا الشهر', key: 'month' },
  { label: 'الكل', key: 'all' },
];

const getDateRange = (key) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (key) {
    case 'today':
      return { from: today.toISOString(), to: new Date(today.getTime() + 86400000).toISOString() };
    case 'yesterday': {
      const y = new Date(today.getTime() - 86400000);
      return { from: y.toISOString(), to: today.toISOString() };
    }
    case '7days':
      return { from: new Date(today.getTime() - 7 * 86400000).toISOString(), to: new Date(today.getTime() + 86400000).toISOString() };
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: new Date(today.getTime() + 86400000).toISOString() };
    default:
      return { from: '', to: '' };
  }
};

const CallsPage = () => {
  const { user } = useAuth();
  const [calls, setCalls] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState(null);
  const [followUpCall, setFollowUpCall] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState('');
  const [queue, setQueue] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchCalls = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 50 };
      if (search) params.search = search;
      if (status) params.status = status;
      if (followUpStatus) params.followUpStatus = followUpStatus;
      if (queue) params.queue = queue;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const res = await getCalls(params);
      setCalls(res.data.calls);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      console.error('Failed to fetch calls:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, followUpStatus, queue, dateFrom, dateTo]);

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(fetchCalls, 30000);
    return () => clearInterval(interval);
  }, [fetchCalls]);

  useEffect(() => {
    getQueues().then(res => setQueues(res.data)).catch(() => {});
  }, []);

  const handleDateFilter = (key) => {
    setActiveFilter(key);
    const range = getDateRange(key);
    setDateFrom(range.from);
    setDateTo(range.to);
    setPage(1);
  };

  const handleFollowUpSubmit = async (callId, data) => {
    try {
      await updateFollowUp(callId, data);
      setFollowUpCall(null);
      fetchCalls();
    } catch (error) {
      console.error('Failed to update follow-up:', error);
    }
  };

  const handleLock = async (call) => {
    try {
      await updateFollowUp(call.id, { followUpStatus: 'in_progress' });
      fetchCalls();
    } catch (error) {
      console.error('Failed to lock call:', error);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-SA') + ' ' + d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (s) => {
    const map = {
      answered: { label: 'مردود عليها', cls: 'badge-answered' },
      missed_in_queue: { label: 'فائتة في الكيو', cls: 'badge-missed' },
      missed_before_queue: { label: 'أغلق أثناء رسالة الترحيب', cls: 'badge-missed' },
      abandoned: { label: 'لم يتم الرد وأغلق العميل', cls: 'badge-abandoned' },
      after_hours: { label: 'خارج الدوام', cls: 'badge-after-hours' },
      voicemail: { label: 'بريد صوتي', cls: 'badge-voicemail' }
    };
    const info = map[s] || { label: s, cls: '' };
    return <span className={`badge ${info.cls}`}>{info.label}</span>;
  };

  const getFollowUpBadge = (s, autoDetected, followUpBy) => {
    const map = {
      not_required: { label: 'لا يلزم', cls: 'badge-not-required' },
      pending: { label: 'بانتظار المتابعة', cls: 'badge-pending' },
      in_progress: { label: 'جاري المتابعة', cls: 'badge-retry' },
      callback_done_answered: { label: 'تم الرد', cls: 'badge-callback-answered' },
      callback_done_no_answer: { label: 'لم يرد', cls: 'badge-callback-no-answer' },
      retry_later: { label: 'إعادة محاولة', cls: 'badge-retry' },
      closed: { label: 'مغلقة', cls: 'badge-closed' }
    };
    const info = map[s] || { label: s, cls: '' };
    return (
      <span>
        <span className={`badge ${info.cls}`}>{info.label}</span>
        {s === 'in_progress' && followUpBy && (
          <span style={{ fontSize: 11, color: '#1565c0', marginRight: 4 }}>({followUpBy})</span>
        )}
        {autoDetected && <span className="auto-detected" style={{ marginRight: 4 }}>تلقائي</span>}
      </span>
    );
  };

  const handleCall = (number) => {
    window.open(`https://ossos.3cx.cloud/webclient/#/people/phonedialog/${number}`, '_blank');
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">المكالمات الموحّدة</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#666' }}>الإجمالي: {total}</span>
          <button className="btn btn-outline btn-sm" onClick={fetchCalls}>
            <FiRefreshCw size={14} /> تحديث
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {DATE_FILTERS.map(f => (
          <button
            key={f.key}
            className={`btn btn-sm ${activeFilter === f.key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => handleDateFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-filters">
            <div style={{ position: 'relative' }}>
              <FiSearch style={{ position: 'absolute', right: 10, top: 10, color: '#999' }} />
              <input
                className="filter-input"
                placeholder="بحث بالرقم أو الاسم..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{ paddingRight: 32 }}
              />
            </div>
            <select className="filter-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">كل الحالات</option>
              <option value="answered">مردود عليها</option>
              <option value="missed_in_queue">فائتة في الكيو</option>
              <option value="missed_before_queue">أغلق أثناء رسالة الترحيب</option>
              <option value="abandoned">لم يتم الرد وأغلق العميل</option>
              <option value="after_hours">خارج الدوام</option>
              <option value="voicemail">بريد صوتي</option>
            </select>
            <select className="filter-select" value={followUpStatus} onChange={(e) => { setFollowUpStatus(e.target.value); setPage(1); }}>
              <option value="">كل حالات المتابعة</option>
              <option value="pending">بانتظار المتابعة</option>
              <option value="in_progress">جاري المتابعة</option>
              <option value="callback_done_answered">تم الرد</option>
              <option value="callback_done_no_answer">لم يرد</option>
              <option value="retry_later">إعادة محاولة</option>
              <option value="closed">مغلقة</option>
              <option value="not_required">لا يلزم</option>
            </select>
            <select className="filter-select" value={queue} onChange={(e) => { setQueue(e.target.value); setPage(1); }}>
              <option value="">كل الكيوهات</option>
              {queues.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>جاري التحميل...</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الرقم</th>
                    <th>الاسم</th>
                    <th>الكيو / المصدر</th>
                    <th>المحاولات</th>
                    <th>آخر اتصال</th>
                    <th>الحالة</th>
                    <th>رد بواسطة</th>
                    <th>المتابعة</th>
                    <th>متابعة بواسطة</th>
                    <th>وقت المتابعة</th>
                    <th>SLA</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.length === 0 ? (
                    <tr><td colSpan="12" style={{ textAlign: 'center', padding: 40, color: '#999' }}>لا توجد مكالمات</td></tr>
                  ) : (
                    calls.map(call => (
                      <tr key={call.id} style={call.followUpStatus === 'in_progress' ? { background: '#fff8e1' } : {}}>
                        <td style={{ fontWeight: 600, direction: 'ltr', textAlign: 'right' }}>{call.callerNumber}</td>
                        <td>{call.callerName || '-'}</td>
                        <td><span className="badge" style={{ background: '#e3f2fd', color: '#1565c0' }}>{call.queueName || call.callSource}</span></td>
                        <td style={{ textAlign: 'center' }}>{call.totalInboundAttempts}</td>
                        <td style={{ fontSize: 13 }}>{formatDate(call.lastCallAt)}</td>
                        <td>{getStatusBadge(call.lastCallStatus)}</td>
                        <td>{call.answeredBy ? `${call.answeredBy} (${call.answeredByExtension})` : '-'}</td>
                        <td>{getFollowUpBadge(call.followUpStatus, call.autoDetectedCallback, call.followUpBy)}</td>
                        <td>{call.followUpBy || '-'}</td>
                        <td style={{ fontSize: 13 }}>{formatDate(call.followUpAt)}</td>
                        <td>
                          {call.slaMet !== null && (
                            <span className={call.slaMet ? 'sla-met' : 'sla-missed'}>
                              {call.slaMet ? '✓' : '✗'}
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-call btn-sm" onClick={() => handleCall(call.callerNumber)} title="اتصال عبر 3CX">
                              <FiPhone size={12} />
                            </button>
                            <button className="btn btn-outline btn-sm" onClick={() => setSelectedCall(call)} title="تفاصيل">
                              <FiEye size={12} />
                            </button>
                            {call.followUpStatus === 'pending' && (
                              <button className="btn btn-warning btn-sm" onClick={() => handleLock(call)} title="جاري المتابعة">
                                <FiLock size={12} />
                              </button>
                            )}
                            {call.followUpStatus !== 'not_required' && (
                              <button className="btn btn-primary btn-sm" onClick={() => setFollowUpCall(call)} title="تحديث المتابعة">
                                تحديث
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>السابق</button>
                <span style={{ fontSize: 13 }}>صفحة {page} من {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>التالي</button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedCall && (
        <CallDetailModal call={selectedCall} onClose={() => setSelectedCall(null)} onUpdate={fetchCalls} />
      )}

      {followUpCall && (
        <FollowUpModal
          call={followUpCall}
          onClose={() => setFollowUpCall(null)}
          onSubmit={handleFollowUpSubmit}
        />
      )}
    </div>
  );
};

export default CallsPage;