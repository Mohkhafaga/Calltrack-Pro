import React, { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../services/api';
import { FiPlus, FiEdit2, FiTrash2, FiUserCheck, FiUserX } from 'react-icons/fi';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({
    username: '', password: '', fullName: '', extension: '', role: 'agent', queueNames: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await getUsers();
      setUsers(res.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm({ username: '', password: '', fullName: '', extension: '', role: 'agent', queueNames: '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      password: '',
      fullName: user.fullName,
      extension: user.extension,
      role: user.role,
      queueNames: Array.isArray(user.queueNames) ? user.queueNames.join(', ') : (user.queueNames || '')
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const data = { ...form };
      if (!data.password && editingUser) delete data.password;

      if (editingUser) {
        await updateUser(editingUser.id, data);
      } else {
        if (!data.password) {
          setError('كلمة المرور مطلوبة');
          return;
        }
        await createUser(data);
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ');
    }
  };

  const handleToggleActive = async (user) => {
    if (window.confirm(`هل تريد ${user.isActive ? 'تعطيل' : 'تفعيل'} حساب ${user.fullName}؟`)) {
      await updateUser(user.id, { isActive: !user.isActive });
      fetchUsers();
    }
  };

  const handleDelete = async (user) => {
    if (window.confirm(`هل أنت متأكد من حذف ${user.fullName}؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
      await deleteUser(user.id);
      fetchUsers();
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">إدارة المستخدمين</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          <FiPlus /> إضافة مستخدم
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>اسم المستخدم</th>
              <th>التحويلة</th>
              <th>الدور</th>
              <th>الكيوهات</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td style={{ fontWeight: 600 }}>{user.fullName}</td>
                <td>{user.username}</td>
                <td style={{ direction: 'ltr', textAlign: 'right' }}>{user.extension}</td>
                <td>
                  <span className={`badge ${user.role === 'admin' ? 'badge-callback-answered' : 'badge-retry'}`}>
                    {user.role === 'admin' ? 'مدير' : 'موظف'}
                  </span>
                </td>
                <td>{Array.isArray(user.queueNames) ? user.queueNames.join(', ') : (user.queueNames || '-')}</td>
                <td>
                  <span className={`badge ${user.isActive ? 'badge-answered' : 'badge-missed'}`}>
                    {user.isActive ? 'فعال' : 'معطل'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(user)} title="تعديل">
                      <FiEdit2 size={12} />
                    </button>
                    <button
                      className={`btn btn-sm ${user.isActive ? 'btn-warning' : 'btn-success'}`}
                      onClick={() => handleToggleActive(user)}
                      title={user.isActive ? 'تعطيل' : 'تفعيل'}
                    >
                      {user.isActive ? <FiUserX size={12} /> : <FiUserCheck size={12} />}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(user)} title="حذف">
                      <FiTrash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            {error && <div className="login-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>الاسم الكامل</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>اسم المستخدم</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                  disabled={!!editingUser}
                />
              </div>
              <div className="form-group">
                <label>{editingUser ? 'كلمة المرور الجديدة (اتركها فارغة للإبقاء)' : 'كلمة المرور'}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editingUser}
                />
              </div>
              <div className="form-group">
                <label>التحويلة في 3CX</label>
                <input
                  type="text"
                  value={form.extension}
                  onChange={(e) => setForm({ ...form, extension: e.target.value })}
                  placeholder="مثال: 101"
                  required
                />
              </div>
              <div className="form-group">
                <label>الدور</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="agent">موظف</option>
                  <option value="admin">مدير</option>
                </select>
              </div>
              <div className="form-group">
                <label>الكيوهات (افصل بفاصلة)</label>
                <input
                  type="text"
                  value={form.queueNames}
                  onChange={(e) => setForm({ ...form, queueNames: e.target.value })}
                  placeholder="مثال: المبيعات, الدعم الفني"
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
                {editingUser ? 'حفظ التعديلات' : 'إضافة المستخدم'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;