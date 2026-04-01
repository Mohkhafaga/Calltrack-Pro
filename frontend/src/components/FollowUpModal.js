import React, { useState } from 'react';

const FollowUpModal = ({ call, onClose, onSubmit }) => {
  const [followUpStatus, setFollowUpStatus] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [retryDate, setRetryDate] = useState('');
  const [retryTime, setRetryTime] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!followUpStatus) return;

    setLoading(true);
    const data = { followUpStatus, followUpNote };

    if (followUpStatus === 'retry_later' && retryDate && retryTime) {
      data.retryScheduledAt = `${retryDate}T${retryTime}`;
    }

    await onSubmit(call.id, data);
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h2 className="modal-title">تحديث حالة المتابعة</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ marginBottom: 16, padding: 12, background: '#f8f9fa', borderRadius: 8 }}>
          <div><strong>الرقم:</strong> {call.callerNumber}</div>
          <div><strong>الاسم:</strong> {call.callerName || 'غير معروف'}</div>
          <div><strong>الكيو:</strong> {call.queueName || '-'}</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>نتيجة المتابعة</label>
            <select
              value={followUpStatus}
              onChange={(e) => setFollowUpStatus(e.target.value)}
              required
            >
              <option value="">اختر...</option>
              <option value="callback_done_answered">تم الاتصال — العميل رد</option>
              <option value="callback_done_no_answer">تم الاتصال — العميل لم يرد</option>
              <option value="retry_later">إعادة محاولة لاحقاً</option>
              <option value="closed">إغلاق نهائي</option>
            </select>
          </div>

          {followUpStatus === 'retry_later' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>تاريخ المحاولة</label>
                <input
                  type="date"
                  value={retryDate}
                  onChange={(e) => setRetryDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>الوقت</label>
                <input
                  type="time"
                  value={retryTime}
                  onChange={(e) => setRetryTime(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>ملاحظة (اختياري)</label>
            <textarea
              value={followUpNote}
              onChange={(e) => setFollowUpNote(e.target.value)}
              placeholder="أضف ملاحظة عن المكالمة..."
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading || !followUpStatus}>
            {loading ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FollowUpModal;