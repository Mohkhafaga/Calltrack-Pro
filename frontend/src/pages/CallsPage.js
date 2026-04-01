import React, { useState, useEffect, useCallback } from 'react';
import { getCalls, getQueues, updateFollowUp } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FiPhone, FiSearch, FiEye, FiRefreshCw } from 'react-icons/fi';
import CallDetailModal from '../components/CallDetailModal';
import FollowUpModal from '../components/FollowUpModal';

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

  // Filters
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

  const handleFollowUpSubmit = async (callId, data) => {
    try {
      await updateFollowUp(callId, data);
      setFollowUpCall(null);
      fetchCalls();
    } catch (error) {
      console.error('Failed to update follow-up:', error);
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
      missed_before_queue: { label: 'فائتة قبل الكيو', cls: 'badge-missed' },
      abandoned: { label: 'مغلقة من العميل', cls: 'badge-abandoned' },
      after_hours: { label: 'خارج الدوام', cls: 'badge-after-hours' },
      voicemail: { label: 'بريد صوتي', cls: 'badge-voicemail' }
    };
    const info = map[s] || { label: s, cls: '' };
    return <span className={`badge ${info.cls}`}>{info.label}</span>;
  };

  const getFollowUpBadge = (s, autoDetected) => {
    const map = {
      not_required: { label: 'لا يلزم', cls: 'badge-not-required' },
      pending: { label: 'بانتظار المتابعة', cls: 'badge-pending' },
      callback_done_answered: { label: 'تم الرد', cls: 'badge-callback-answered' },
      callback_done_no_answer: { label: 'لم يرد', cls: 'badge-callback-no-answer' },
      retry_later: { label: 'إعادة محاولة', cls: 'badge-retry' },
      closed: { label: 'مغلقة', cls: 'badge-closed' }
    };
    const info = map[s] || { label: s, cls: '' };
    return (
      <span>
        <span className={`badge ${info.cls}`}>{info.label}</span>
        {autoDetected && <span className="auto-detected" style={{ marginRight: 4 }}>تلقائي</span>}
      </span>
    );
  };

  const handleCall = (number) => {
    window.open(`tel:${number}`, '_self');
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
              <option value="missed_before_queue">فائتة قبل الكيو</option>
              <option value="abandoned">مغلقة من العميل</option>
              <option value="after_hours">خارج الدوام</option>
              <option value="voicemail">بريد صوتي</option>
            </select>
            <select className="filter-select" value={followUpStatus} onChange={(e) => { setFollowUpStatus(e.target.value); setPage(1); }}>
              <option value="">كل حالات المتابعة</option>
              <option value="pending">بانتظار المتابعة</option>
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
            <input type="date" className="filter-input" style={{ width: 130 }} value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            <span style={{ fontSize: 13, color: '#666' }}>إلى</span>
            <input type="date" className="filter-input" style={{ width: 130 }} value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
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
                      <tr key={call.id}>
                        <td style={{ fontWeight: 600, direction: 'ltr', textAlign: 'right' }}>{call.callerNumber}</td>
                        <td>{call.callerName || '-'}</td>
                        <td><span className="badge" style={{ background: '#e3f2fd', color: '#1565c0' }}>{call.queueName || call.callSource}</span></td>
                        <td style={{ textAlign: 'center' }}>{call.totalInboundAttempts}</td>
                        <td style={{ fontSize: 12 }}>{formatDate(call.lastCallAt)}</td>
                        <td>{getStatusBadge(call.lastCallStatus)}</td>
                        <td>{call.answeredBy || '-'}</td>
                        <td>{getFollowUpBadge(call.followUpStatus, call.autoDetectedCallback)}</td>
                        <td>{call.followUpBy || '-'}</td>
                        <td style={{ fontSize: 12 }}>{formatDate(call.followUpAt)}</td>
                        <td>
                          {call.slaMet !== null && (
                            <span className={call.slaMet ? 'sla-met' : 'sla-missed'}>
                              {call.slaMet ? '✓' : '✗'}
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-call btn-sm" onClick={() => handleCall(call.callerNumber)} title="اتصال">
                              <FiPhone size={12} />
                            </button>
                            <button className="btn btn-outline btn-sm" onClick={() => setSelectedCall(call)} title="تفاصيل">
                              <FiEye size={12} />
                            </button>
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
        <CallDetailModal call={selectedCall} onClose={() => setSelectedCall(null)} />
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