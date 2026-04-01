import React, { useState, useEffect, useCallback } from 'react';
import { getDashboardStats, getAlerts } from '../services/api';
import { FiPhone, FiPhoneIncoming, FiPhoneMissed, FiPhoneOff, FiCheckCircle, FiClock, FiAlertTriangle, FiActivity } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, PieChart, Pie } from 'recharts';

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

const COLORS = ['#1976d2', '#388e3c', '#f57c00', '#d32f2f', '#7b1fa2', '#00796b', '#c2185b', '#455a64'];

const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState({ count: 0, alerts: [] });
  const [activeFilter, setActiveFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const [statsRes, alertsRes] = await Promise.all([
        getDashboardStats(params),
        getAlerts()
      ]);
      setStats(statsRes.data);
      setAlerts(alertsRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleDateFilter = (key) => {
    setActiveFilter(key);
    const range = getDateRange(key);
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>جاري التحميل...</div>;

  const queueData = stats?.callsByQueue?.map((q, i) => ({
    name: q.queueName || 'غير محدد',
    value: parseInt(q.total),
    answered: parseInt(q.answered) || 0,
    missed: parseInt(q.missed) || 0,
    fill: COLORS[i % COLORS.length]
  })) || [];

  const hourData = stats?.callsByHour?.map(h => ({
    hour: `${h.hour}:00`,
    total: parseInt(h.total)
  })) || [];

  return (
    <div>
      {alerts.count > 0 && (
        <div className="alert-banner">
          <FiAlertTriangle size={20} />
          <span>{alerts.count} مكالمة فائتة تجاوزت {alerts.thresholdMinutes} دقيقة بدون متابعة!</span>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">لوحة التحكم</h1>
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

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-blue"><FiPhone /></div>
          <div className="stat-value">{stats?.totalCalls || 0}</div>
          <div className="stat-label">إجمالي المكالمات</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-green"><FiPhoneIncoming /></div>
          <div className="stat-value">{stats?.answeredCalls || 0}</div>
          <div className="stat-label">مردود عليها</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-red"><FiPhoneMissed /></div>
          <div className="stat-value">{stats?.missedCalls || 0}</div>
          <div className="stat-label">فائتة</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-teal"><FiActivity /></div>
          <div className="stat-value">{stats?.responseRate || 0}%</div>
          <div className="stat-label">نسبة الرد</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-orange"><FiPhoneOff /></div>
          <div className="stat-value">{stats?.pendingFollowUp || 0}</div>
          <div className="stat-label">بانتظار المتابعة</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-green"><FiCheckCircle /></div>
          <div className="stat-value">{stats?.callbackDone || 0}</div>
          <div className="stat-label">تمت المتابعة</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-purple"><FiClock /></div>
          <div className="stat-value">{stats?.retryLater || 0}</div>
          <div className="stat-label">إعادة محاولة</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-teal"><FiActivity /></div>
          <div className="stat-value">{stats?.slaRate || 0}%</div>
          <div className="stat-label">نسبة SLA</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>المكالمات حسب الساعة</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={hourData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={1} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [v, 'مكالمات']} />
              <Bar dataKey="total" fill="#1976d2" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>المكالمات حسب الكيو</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ResponsiveContainer width="50%" height={280}>
              <PieChart>
                <Pie data={queueData} cx="50%" cy="50%" outerRadius={100} dataKey="value" stroke="none">
                  {queueData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [v, 'مكالمات']} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ width: '50%', fontSize: 13 }}>
              {queueData.map((q, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: q.fill, flexShrink: 0 }}></div>
                  <span style={{ flex: 1 }}>{q.name}</span>
                  <strong>{q.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;