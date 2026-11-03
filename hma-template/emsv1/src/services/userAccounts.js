import { addRegisteredUser, getRegisteredUsers, removeRegisteredUser } from './localUsers'

// Showcase build: user accounts live in localStorage (see localUsers.js) instead
// of the FastAPI /users endpoints. Response shape matches UserAccountResponse.
const toAccount = (u) => ({
  id: u.id,
  employee_id: u.employee_id || null,
  full_name: u.full_name,
  google_email: u.google_email,
  role: u.role,
  is_active: true,
  created_at: u.added_at,
  email_sent: true,
})

export const listUserAccounts = () => Promise.resolve(getRegisteredUsers().map(toAccount))

export const createUserAccount = ({ full_name, google_email, role, employee_id }) => {
  try {
    return Promise.resolve(
      toAccount(addRegisteredUser({ full_name, google_email, role, employee_id })),
    )
  } catch (err) {
    return Promise.reject(err)
  }
}

export const deleteUserAccount = (id) => Promise.resolve(removeRegisteredUser(id))
