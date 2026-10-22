import api from './api'

export const listUserAccounts = () => api.get('/users').then((res) => res.data)

export const createUserAccount = ({ full_name, google_email, role, employee_id }) =>
  api.post('/users', { full_name, google_email, role, employee_id }).then((res) => res.data)

export const deleteUserAccount = (id) => api.delete(`/users/${id}`)
