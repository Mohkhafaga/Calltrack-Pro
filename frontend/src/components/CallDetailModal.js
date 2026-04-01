import React, { useState, useEffect } from 'react';
import { getCallDetails, updateFollowUp } from '../services/api';
import { FiPhoneIncoming, FiPhoneOutgoing, FiX, FiCheckCircle } from 'react-icons/fi';

const CallDetailModal = ({ call, onClose, onUpdate }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await getCallDetails(call.id);
        setDetails(res.data);
      } catch (error) {
        console.error('Failed to fetch call details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [call.id]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-SA') + ' ' + d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
      pending: 'لم تتم',
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
      const timestamp = new Date().toLocaleString('ar-SA');
      const newNote = currentNote ? `${currentNote}\n---\n${timestamp}: ${note}` : `${timestamp}: ${note}`;
      await updateFollowUp(call.id, { followUpStatus: details?.followUpStatus || 'pending', followUpNote: newNote });
      const res = await getCallDetails(call.id);
      setDetails(res.data);
      setNote('');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700, padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
        
        <div style={{
          position: 'sticky',
          top: 0,
          background: 'white',
          zIndex: 10,
          padding: '20px 24px',
          borderBottom: '1px solid #eee',
          borderRadius: '16px 16px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: 60
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>تفاصيل المكالمة — {call.callerNumber}</h2>
          <button onClick={onClose} style={{
            background: '#f5f5f5',
            border: 'none',
            borderRadius: '50%',
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 20,
            flexShrink: 0
          }}>
            <FiX />
          </button>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center' }}>جاري التحميل...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div><strong>اسم العميل:</strong> {details?.callerName || 'غير معروف'}</div>
                <div><strong>الكيو:</strong> {details?.queueName || '-'}</div>
                <div><strong>عدد المحاولات:</strong> {details?.totalInboundAttempts}</div>
                <div><strong>أول اتصال:</strong> {formatDate(details?.firstCallAt)}</div>
                <div><strong>آخر اتصال:</strong> {formatDate(details?.lastCallAt)}</div>
                <div><strong>حالة المتابعة:</strong> {getFollowUpLabel(details?.followUpStatus)}</div>
                {details?.followUpBy && (
                  <div><strong>متابعة بواسطة:</strong> {details.followUpBy} — {formatDate(details.followUpAt)}</div>
                )}
                {details?.answeredBy && (
                  <div><strong>رد بواسطة:</strong> {details.answeredBy} ({details.answeredByExtension})</div>
                )}
              </div>

              {details?.followUpNote && (
                <div style={{ marginBottom: 20, padding: 12, background: '#f8f9fa', borderRadius: 8, whiteSpace: 'pre-line' }}>
                  <strong>الملاحظات:</strong>
                  <div style={{ marginTop: 8, fontSize: 14, color: '#555' }}>{details.followUpNote}</div>
                </div>
              )}

              <div style={{ marginBottom: 24, display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="أضف ملاحظة..."
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontFamily: 'Tajawal', fontSize: 14, direction: 'rtl' }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                />
                <button className="btn btn-primary btn-sm" onClick={handleAddNote} disabled={saving || !note.trim()}>
                  {saving ? '...' : 'إضافة'}
                </button>
              </div>

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
                        <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                          الكيو: {h.queueName}
                        </div>
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