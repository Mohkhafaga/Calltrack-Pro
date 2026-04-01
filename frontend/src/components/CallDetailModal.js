import React, { useState, useEffect } from 'react';
import { getCallDetails, updateFollowUp } from '../services/api';
import { FiPhoneIncoming, FiPhoneOutgoing, FiX, FiPhone, FiLock } from 'react-icons/fi';

const CallDetailModal = ({ call, onClose, onUpdate, currentUser }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [followUpStatus, setFollowUpStatus] = useState('');
  const [retryDate, setRetryDate] = useState('');
  const [retryTime, setRetryTime] = useState('');

  const fetchDetails = async () => {
    try {
      const res = await getCallDetails(call.id);
      setDetails(res.data);
    } catch (error) {
      console.error('Failed to fetch call details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetails(); }, [call.id]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${date} ${time}`;
  };

  const getStatusLabel = (s) => {
    const map = {
      answered: 'مردود عليها',
      missed: 'فائتة',
      abandoned: 'لم يتم الرد وأغلق العميل',
      voicemail: 'بريد صوتي',
      after_hours: 'خارج الدوام',
      no_answer: 'لم يرد'
    };
    return map[s] || s;
  };

  const getStatusColor = (s) => {
    if (s === 'answered') return '#2e7d32';
    return '#c62828';
  };

  const getFollowUpLabel = (s) => {
    const map = {
      not_required: 'لا يلزم',
      pending: 'بانتظار المتابعة',
      in_progress: 'جاري المتابعة',
      callback_done_answered: 'تم الرد',
      callback_done_no_answer: 'لم يرد',
      retry_later: 'إعادة محاولة',
      closed: 'مغلقة'
    };
    return map[s] || s;
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      const currentNote = details?.followUpNote || '';
      const timestamp = formatDate(new Date().toISOString());
      const userName = currentUser?.fullName || 'مستخدم';
      const newNote = currentNote
        ? `${currentNote}\n---\n[${timestamp}] ${userName}: ${note}`
        : `[${timestamp}] ${userName}: ${note}`;
      await updateFollowUp(call.id, {
        followUpStatus: details?.followUpStatus || 'pending',
        followUpNote: newNote
      });
      await fetchDetails();
      setNote('');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLock = async () => {
    try {
      await updateFollowUp(call.id, { followUpStatus: 'in_progress' });
      await fetchDetails();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to lock:', error);
    }
  };

  const handleFollowUp = async () => {
    if (!followUpStatus) return;
    setSaving(true);
    try {
      const data = { followUpStatus };
      if (followUpStatus === 'retry_later' && retryDate && retryTime) {
        data.retryScheduledAt = `${retryDate}T${retryTime}`;
      }
      await updateFollowUp(call.id, data);
      await fetchDetails();
      setFollowUpStatus('');
      setRetryDate('');
      setRetryTime('');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to update:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCall = (number) => {
    window.open(`https://ososenjaz.3cx.asia/#/people/phonedialog/${number}`, '_blank');
  };

  const showActions = details?.followUpStatus !== 'not_required';
  const showLock = details?.followUpStatus === 'pending' || details?.followUpStatus === 'retry_later' || details?.followUpStatus === 'callback_done_no_answer';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>

        <div style={{
          position: 'sticky', top: 0, background: 'white', zIndex: 10,
          padding: '16px 24px', borderBottom: '1px solid #eee',
          borderRadius: '16px 16px 0 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>تفاصيل المكالمة — {call.callerNumber}</h2>
          <button onClick={onClose} style={{
            background: '#f5f5f5', border: 'none', borderRadius: '50%',
            width: 40, height: 40, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', fontSize: 20, flexShrink: 0
          }}>
            <FiX />
          </button>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center' }}>جاري التحميل...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                <div><strong>اسم العميل:</strong> {details?.callerName || 'غير معروف'}</div>
                <div><strong>الكيو:</strong> {details?.queueName || '-'}</div>
                <div><strong>عدد المحاولات:</strong> {details?.totalInboundAttempts}</div>
                <div><strong>أول اتصال:</strong> {formatDate(details?.firstCallAt)}</div>
                <div><strong>آخر اتصال:</strong> {formatDate(details?.lastCallAt)}</div>
                <div><strong>حالة المتابعة:</strong> {getFollowUpLabel(details?.followUpStatus)}</div>
                {details?.answeredBy && (
                  <div><strong>رد بواسطة:</strong> {details.answeredBy} ({details.answeredByExtension})</div>
                )}
                {details?.followUpBy && (
                  <div><strong>متابعة بواسطة:</strong> {details.followUpBy} — {formatDate(details.followUpAt)}</div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                <button className="btn btn-call" onClick={() => handleCall(call.callerNumber)}>
                  <FiPhone size={14} /> اتصال عبر 3CX
                </button>
                {showLock && (
                  <button className="btn btn-warning btn-sm" onClick={handleLock}>
                    <FiLock size={14} /> جاري المتابعة
                  </button>
                )}
              </div>

              {/* Follow-up Update */}
              {showActions && (
                <div style={{ marginBottom: 20, padding: 14, background: '#f0f4ff', borderRadius: 10 }}>
                  <strong style={{ fontSize: 14, display: 'block', marginBottom: 10 }}>تحديث حالة المتابعة</strong>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <select value={followUpStatus} onChange={(e) => setFollowUpStatus(e.target.value)}
                      style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontFamily: 'Tajawal', fontSize: 13 }}>
                      <option value="">اختر...</option>
                      <option value="callback_done_answered">تم الاتصال — العميل رد</option>
                      <option value="callback_done_no_answer">تم الاتصال — العميل لم يرد</option>
                      <option value="retry_later">إعادة محاولة لاحقاً</option>
                      <option value="closed">إغلاق نهائي</option>
                    </select>
                    {followUpStatus === 'retry_later' && (
                      <>
                        <input type="date" value={retryDate} onChange={(e) => setRetryDate(e.target.value)}
                          style={{ padding: '8px', border: '1px solid #ddd', borderRadius: 8, fontFamily: 'Tajawal', fontSize: 13 }} />
                        <input type="time" value={retryTime} onChange={(e) => setRetryTime(e.target.value)}
                          style={{ padding: '8px', border: '1px solid #ddd', borderRadius: 8, fontFamily: 'Tajawal', fontSize: 13 }} />
                      </>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={handleFollowUp} disabled={saving || !followUpStatus}>
                      {saving ? '...' : 'حفظ'}
                    </button>
                  </div>
                </div>
              )}

              {/* Notes */}
              {details?.followUpNote && (
                <div style={{ marginBottom: 16, padding: 12, background: '#f8f9fa', borderRadius: 8, whiteSpace: 'pre-line' }}>
                  <strong>الملاحظات:</strong>
                  <div style={{ marginTop: 8, fontSize: 14, color: '#555', lineHeight: 1.8 }}>{details.followUpNote}</div>
                </div>
              )}

              <div style={{ marginBottom: 24, display: 'flex', gap: 8 }}>
                <input
                  type="text" value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="أضف ملاحظة..."
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontFamily: 'Tajawal', fontSize: 14, direction: 'rtl' }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                />
                <button className="btn btn-primary btn-sm" onClick={handleAddNote} disabled={saving || !note.trim()}>
                  {saving ? '...' : 'إضافة ملاحظة'}
                </button>
              </div>

              {/* Call History */}
              <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>سجل المكالمات</h3>
              <div className="timeline">
                {details?.history?.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)).map((h, i) => (
                  <div key={i} className={`timeline-item ${h.direction}`}>
                    <div style={{ marginTop: 2 }}>
                      {h.direction === 'inbound' ? (
                        <FiPhoneIncoming color={getStatusColor(h.status)} size={20} />
                      ) : (
                        <FiPhoneOutgoing color="#388e3c" size={20} />
                      )}
                    </div>
                    <div className="timeline-content">
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 6 }}>
                        {formatDate(h.startedAt)}
                      </div>
                      <div style={{ fontSize: 14, color: getStatusColor(h.status), fontWeight: 500 }}>
                        {h.direction === 'inbound' ? 'وارد' : 'صادر'}
                        {' — '}
                        {getStatusLabel(h.status)}
                        {h.answeredBy && (
                          <span style={{ color: '#2e7d32' }}> — رد: {h.answeredBy} ({h.answeredByExtension})</span>
                        )}
                        {h.duration > 0 && (
                          <span style={{ color: '#666' }}> — {Math.floor(h.duration / 60)}:{String(h.duration % 60).padStart(2, '0')}</span>
                        )}
                      </div>
                      {h.queueName && (
                        <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>الكيو: {h.queueName}</div>
                      )}
                    </div>
                  </div>
                ))}
                {(!details?.history || details.history.length === 0) && (
                  <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>لا يوجد سجل</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallDetailModal;