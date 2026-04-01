import React, { useState, useEffect } from 'react';
import { getCallDetails } from '../services/api';
import { FiPhoneIncoming, FiPhoneOutgoing, FiX } from 'react-icons/fi';

const CallDetailModal = ({ call, onClose }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

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
      abandoned: 'مغلقة من العميل',
      voicemail: 'بريد صوتي',
      after_hours: 'خارج الدوام',
      no_answer: 'لم يرد'
    };
    return map[s] || s;
  };

  const getFollowUpLabel = (s) => {
    const map = {
      not_required: 'لا يلزم',
      pending: 'لم تتم',
      callback_done_answered: 'تم الرد',
      callback_done_no_answer: 'لم يرد',
      retry_later: 'إعادة محاولة',
      closed: 'مغلقة'
    };
    return map[s] || s;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700, position: 'relative', paddingTop: 60 }}>
        
        <div style={{
          position: 'sticky',
          top: 0,
          background: 'white',
          zIndex: 10,
          padding: '16px 24px',
          borderBottom: '1px solid #eee',
          marginTop: -60,
          marginRight: -24,
          marginLeft: -24,
          borderRadius: '16px 16px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>تفاصيل المكالمة — {call.callerNumber}</h2>
          <button onClick={onClose} style={{
            background: '#f5f5f5',
            border: 'none',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 18
          }}>
            <FiX />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 20, textAlign: 'center' }}>جاري التحميل...</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, marginTop: 16 }}>
              <div><strong>اسم العميل:</strong> {details?.callerName || 'غير معروف'}</div>
              <div><strong>الكيو:</strong> {details?.queueName || '-'}</div>
              <div><strong>عدد المحاولات:</strong> {details?.totalInboundAttempts}</div>
              <div><strong>أول اتصال:</strong> {formatDate(details?.firstCallAt)}</div>
              <div><strong>آخر اتصال:</strong> {formatDate(details?.lastCallAt)}</div>
              <div><strong>حالة المتابعة:</strong> {getFollowUpLabel(details?.followUpStatus)}</div>
              {details?.followUpBy && (
                <div><strong>متابعة بواسطة:</strong> {details.followUpBy} — {formatDate(details.followUpAt)}</div>
              )}
              {details?.followUpNote && (
                <div style={{ gridColumn: '1 / -1' }}><strong>ملاحظة:</strong> {details.followUpNote}</div>
              )}
            </div>

            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>سجل المكالمات</h3>
            <div className="timeline">
              {details?.history?.map((h, i) => (
                <div key={i} className={`timeline-item ${h.direction}`}>
                  <div style={{ marginTop: 2 }}>
                    {h.direction === 'inbound' ? (
                      <FiPhoneIncoming color="#1976d2" size={20} />
                    ) : (
                      <FiPhoneOutgoing color="#388e3c" size={20} />
                    )}
                  </div>
                  <div className="timeline-content">
                    <div style={{ fontSize: 15, fontWeight: 500, color: '#333', marginBottom: 4 }}>
                      {formatDate(h.startedAt)}
                    </div>
                    <div style={{ fontSize: 14, color: '#555' }}>
                      <strong>{h.direction === 'inbound' ? 'وارد' : 'صادر'}</strong>
                      {' — '}
                      {getStatusLabel(h.status)}
                      {h.answeredBy && ` — بواسطة ${h.answeredBy} (${h.answeredByExtension})`}
                      {h.duration > 0 && ` — ${Math.floor(h.duration / 60)}:${String(h.duration % 60).padStart(2, '0')}`}
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
  );
};

export default CallDetailModal;