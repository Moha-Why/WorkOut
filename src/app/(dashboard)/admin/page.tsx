'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardTitle, CardHeader } from '@/components/ui/Card'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'

export default function AdminDashboard() {
  const [users, setUsers] = useState<Profile[]>([])
  const [stats, setStats] = useState({
    total_coaches: 0,
    total_users: 0,
    total_programs: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    name: '',
    role: 'user' as 'user' | 'coach',
  })
  const [isAdding, setIsAdding] = useState(false)

  const fetchData = async () => {
    const supabase = createClient()

    // Fetch all users
    const { data: usersData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

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

    setUsers(usersData || [])
    setStats({
      total_coaches: coachCount || 0,
      total_users: userCount || 0,
      total_programs: programCount || 0,
    })
    setIsLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.name) {
      alert('Please fill in all fields')
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
      alert('User added successfully!')
    } catch (error: any) {
      console.error('Error adding user:', error)
      alert(`Error: ${error.message}`)
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
      alert('Error updating user')
      return
    }

    await fetchData()
  }

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete ${userEmail}? This action cannot be undone.`)) {
      return
    }

    const supabase = createClient()

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (error) {
      console.error('Error deleting user:', error)
      alert('Error deleting user')
      return
    }

    await fetchData()
    alert('User deleted successfully')
  }

  if (isLoading) {
    return (
      <RoleGuard allowedRoles={['admin']}>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-black" />
        </div>
      </RoleGuard>
    )
  }

  return (
    <RoleGuard allowedRoles={['admin']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <Button onClick={() => setShowAddModal(true)}>
            Add User
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-gray-600">Total Coaches</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total_coaches}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total_users}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-gray-600">Total Programs</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total_programs}</p>
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
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Role</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{user.name}</td>
                      <td className="py-3 px-4">{user.email}</td>
                      <td className="py-3 px-4">
                        <Badge variant={user.role === 'admin' ? 'primary' : user.role === 'coach' ? 'info' : 'default'}>
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
                          {user.role !== 'admin' && (
                            <>
                              <Button
                                variant="outline"
                                onClick={() => handleToggleActive(user.id, user.active)}
                              >
                                {user.active ? 'Disable' : 'Enable'}
                              </Button>
                              <Button
                                variant="danger"
                                onClick={() => handleDeleteUser(user.id, user.email)}
                              >
                                Delete
                              </Button>
                            </>
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
      </div>
    </RoleGuard>
  )
}
