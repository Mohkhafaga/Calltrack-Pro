import React, { useState, useEffect, useCallback } from 'react';
import { getDashboardStats, getAlerts } from '../services/api';
import { FiPhone, FiPhoneIncoming, FiPhoneMissed, FiPhoneOff, FiCheckCircle, FiClock, FiAlertTriangle, FiActivity } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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

const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState({ count: 0, alerts: [] });
  const [activeFilter, setActiveFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [queue, setQueue] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (queue) params.queue = queue;

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
  }, [dateFrom, dateTo, queue]);

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

  const COLORS = ['#388e3c', '#d32f2f', '#f57c00', '#283593', '#6a1b9a'];

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>جاري التحميل...</div>;

  const pieData = stats?.callsByQueue?.map(q => ({
    name: q.queueName || 'غير محدد',
    value: parseInt(q.total)
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
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={hourData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#1976d2" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>المكالمات حسب الكيو</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;