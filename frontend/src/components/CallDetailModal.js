import React, { useState, useEffect } from 'react';
import { getCallDetails } from '../services/api';
import { FiPhone, FiPhoneIncoming, FiPhoneOutgoing } from 'react-icons/fi';

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
      abandoned: 'مغلقة',
      voicemail: 'بريد صوتي',
      after_hours: 'خارج الدوام',
      no_answer: 'لم يرد'
    };
    return map[s] || s;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <h2 className="modal-title">تفاصيل المكالمة — {call.callerNumber}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div style={{ padding: 20, textAlign: 'center' }}>جاري التحميل...</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <strong>اسم العميل:</strong> {details?.callerName || 'غير معروف'}
              </div>
              <div>
                <strong>الكيو:</strong> {details?.queueName || '-'}
              </div>
              <div>
                <strong>عدد المحاولات:</strong> {details?.totalInboundAttempts}
              </div>
              <div>
                <strong>أول اتصال:</strong> {formatDate(details?.firstCallAt)}
              </div>
              <div>
                <strong>آخر اتصال:</strong> {formatDate(details?.lastCallAt)}
              </div>
              <div>
                <strong>حالة المتابعة:</strong> {details?.followUpBy ? `${details.followUpBy} — ${formatDate(details.followUpAt)}` : 'لم تتم'}
              </div>
              {details?.followUpNote && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong>ملاحظة:</strong> {details.followUpNote}
                </div>
              )}
            </div>

            <h3 style={{ marginBottom: 12, fontSize: 15 }}>سجل المكالمات</h3>
            <div className="timeline">
              {details?.history?.map((h, i) => (
                <div key={i} className={`timeline-item ${h.direction}`}>
                  <div style={{ marginTop: 2 }}>
                    {h.direction === 'inbound' ? (
                      <FiPhoneIncoming color="#1976d2" size={18} />
                    ) : (
                      <FiPhoneOutgoing color="#388e3c" size={18} />
                    )}
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-time">{formatDate(h.startedAt)}</div>
                    <div className="timeline-detail">
                      <strong>{h.direction === 'inbound' ? 'وارد' : 'صادر'}</strong>
                      {' — '}
                      {getStatusLabel(h.status)}
                      {h.answeredBy && ` — بواسطة ${h.answeredBy} (${h.answeredByExtension})`}
                      {h.duration > 0 && ` — ${Math.floor(h.duration / 60)}:${String(h.duration % 60).padStart(2, '0')}`}
                    </div>
                    {h.queueName && (
                      <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
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