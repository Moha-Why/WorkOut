'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardTitle, CardHeader } from '@/components/ui/Card'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Toast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'

export default function AdminDashboard() {
  const [users, setUsers] = useState<Profile[]>([])
  const [coaches, setCoaches] = useState<Profile[]>([])
  const [stats, setStats] = useState({
    total_coaches: 0,
    total_users: 0,
    total_programs: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAssignCoachModal, setShowAssignCoachModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null)
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    name: '',
    role: 'user' as 'user' | 'coach',
  })
  const [isAdding, setIsAdding] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({
    message: '',
    type: 'success',
    isOpen: false,
  })

  const fetchData = async () => {
    const supabase = createClient()

    // Fetch all users
    const { data: usersData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    // Fetch all coaches
    const { data: coachesData } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'coach')
      .eq('active', true)
      .order('name', { ascending: true })

    // Fetch counts
    const { count: coachCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'coach')

    const { count: userCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'user')

    const { count: programCount } = await supabase
      .from('programs')
      .select('*', { count: 'exact', head: true })
      .not('name', 'like', 'Exercise Library -%')

    setUsers(usersData || [])
    setCoaches(coachesData || [])
    setStats({
      total_coaches: coachCount || 0,
      total_users: userCount || 0,
      total_programs: programCount || 0,
    })
    setIsLoading(false)
  }

  const handleAssignCoach = async () => {
    if (!selectedUser || !selectedCoachId) {
      setToast({ message: 'Please select a coach', type: 'error', isOpen: true })
      return
    }

    const supabase = createClient()

    // Get coach record
    const { data: coachData } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_id', selectedCoachId)
      .single()

    if (!coachData) {
      setToast({ message: 'Coach record not found', type: 'error', isOpen: true })
      return
    }

    // Check if already assigned
    const { data: existing } = await supabase
      .from('coach_users')
      .select('id')
      .eq('user_id', selectedUser.id)
      .eq('coach_id', (coachData as { id: string }).id)
      .single()

    if (existing) {
      setToast({ message: 'This user is already assigned to this coach', type: 'error', isOpen: true })
      return
    }

    const { error } = await supabase.from('coach_users').insert({
      user_id: selectedUser.id,
      coach_id: (coachData as { id: string }).id,
    } as never)

    if (error) {
      console.error('Error assigning coach:', error)
      setToast({ message: `Error assigning coach: ${error.message}`, type: 'error', isOpen: true })
      return
    }

    setToast({ message: 'User assigned to coach successfully!', type: 'success', isOpen: true })
    setShowAssignCoachModal(false)
    setSelectedUser(null)
    setSelectedCoachId(null)
    await fetchData()
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.name) {
      setToast({ message: 'Please fill in all fields', type: 'error', isOpen: true })
      return
    }

    setIsAdding(true)
    const supabase = createClient()

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('User creation failed')

      // Create profile
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        active: true,
      } as never)

      if (profileError) throw profileError

      // If coach, create coach record
      if (newUser.role === 'coach') {
        const { error: coachError } = await supabase.from('coaches').insert({
          user_id: authData.user.id,
          active: true,
        } as never)

        if (coachError) throw coachError
      }

      // Refresh data
      await fetchData()

      // Reset form
      setNewUser({
        email: '',
        password: '',
        name: '',
        role: 'user',
      })
      setShowAddModal(false)
      setToast({ message: 'User added successfully!', type: 'success', isOpen: true })
    } catch (error: any) {
      console.error('Error adding user:', error)
      setToast({ message: `Error: ${error.message}`, type: 'error', isOpen: true })
    } finally {
      setIsAdding(false)
    }
  }

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    const supabase = createClient()

    const { error } = await supabase
      .from('profiles')
      .update({ active: !currentActive } as never)
      .eq('id', userId)

    if (error) {
      console.error('Error toggling user:', error)
      setToast({ message: 'Error updating user', type: 'error', isOpen: true })
      return
    }

    await fetchData()
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    try {
      // Call API route to delete user from auth and profile
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: userToDelete.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user')
      }

      setToast({ message: 'User deleted successfully from both profile and authentication', type: 'success', isOpen: true })
      setUserToDelete(null)
      await fetchData()
    } catch (error: any) {
      console.error('Error deleting user:', error)
      setToast({ message: `Error deleting user: ${error.message}`, type: 'error', isOpen: true })
    }
  }

  if (isLoading) {
    return (
      <RoleGuard allowedRoles={['admin']}>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-accent" />
        </div>
      </RoleGuard>
    )
  }

  return (
    <RoleGuard allowedRoles={['admin']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-text-primary">Admin Dashboard</h1>
          <Button onClick={() => setShowAddModal(true)}>
            Add User
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-gray-400">Total Coaches</p>
              <p className="text-3xl font-bold text-text-primary mt-2">{stats.total_coaches}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-gray-400">Total Users</p>
              <p className="text-3xl font-bold text-text-primary mt-2">{stats.total_users}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-gray-400">Total Programs</p>
              <p className="text-3xl font-bold text-text-primary mt-2">{stats.total_programs}</p>
            </CardContent>
          </Card>
        </div>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-400">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-400">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-400">Role</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-400">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-bg-hover">
                      <td className="py-3 px-4">{user.name}</td>
                      <td className="py-3 px-4">{user.email}</td>
                      <td className="py-3 px-4">
                        <Badge variant={user.role === 'admin' ? 'warning' : user.role === 'coach' ? 'info' : 'default'}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={user.active ? 'success' : 'danger'}>
                          {user.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          {user.role === 'user' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user)
                                setShowAssignCoachModal(true)
                              }}
                            >
                              Assign Coach
                            </Button>
                          )}
                          {user.role !== 'admin' && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => {
                                setUserToDelete({ id: user.id, email: user.email })
                                setShowDeleteConfirm(true)
                              }}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Add User Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Add New User</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Input
                    label="Name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="John Doe"
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                  <Input
                    label="Password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Min 6 characters"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="role"
                          value="user"
                          checked={newUser.role === 'user'}
                          onChange={(e) => setNewUser({ ...newUser, role: 'user' })}
                          className="w-4 h-4"
                        />
                        <span>User</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="role"
                          value="coach"
                          checked={newUser.role === 'coach'}
                          onChange={(e) => setNewUser({ ...newUser, role: 'coach' })}
                          className="w-4 h-4"
                        />
                        <span>Coach</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleAddUser}
                      disabled={isAdding}
                      className="flex-1"
                    >
                      {isAdding ? 'Adding...' : 'Add User'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowAddModal(false)}
                      disabled={isAdding}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Assign Coach Modal */}
        {showAssignCoachModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Assign Coach to {selectedUser.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {coaches.length === 0 ? (
                  <p className="text-center text-gray-400 py-4">
                    No active coaches available
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {coaches.map((coach) => (
                      <div
                        key={coach.id}
                        onClick={() => setSelectedCoachId(coach.id)}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedCoachId === coach.id
                            ? 'border-black bg-bg-hover'
                            : 'border-border hover:border-gray-400'
                        }`}
                      >
                        <h4 className="font-semibold text-text-primary">{coach.name}</h4>
                        <p className="text-sm text-gray-400">{coach.email}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAssignCoachModal(false)
                      setSelectedUser(null)
                      setSelectedCoachId(null)
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAssignCoach}
                    disabled={!selectedCoachId}
                    className="flex-1"
                  >
                    Assign Coach
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Delete User Confirmation Dialog */}
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false)
            setUserToDelete(null)
          }}
          onConfirm={handleDeleteUser}
          title="Delete User"
          message={`Are you sure you want to delete ${userToDelete?.email}? This action cannot be undone and will remove the user from authentication.`}
          confirmText="Delete User"
          cancelText="Cancel"
          variant="danger"
        />

        {/* Toast Notification */}
        <Toast
          message={toast.message}
          type={toast.type}
          isOpen={toast.isOpen}
          onClose={() => setToast({ ...toast, isOpen: false })}
        />
      </div>
    </RoleGuard>
  )
}
