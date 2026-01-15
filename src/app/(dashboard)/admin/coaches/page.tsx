'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Toast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'

interface CoachWithStats extends Profile {
  total_users: number
  total_programs: number
  total_exercises: number
}

export default function AdminCoachesPage() {
  const [coaches, setCoaches] = useState<CoachWithStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCoach, setSelectedCoach] = useState<CoachWithStats | null>(null)
  const [coachUsers, setCoachUsers] = useState<Profile[]>([])
  const [showUsersModal, setShowUsersModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({
    message: '',
    type: 'success',
    isOpen: false,
  })

  const fetchCoaches = async () => {
    const supabase = createClient()

    // Fetch all coaches
    const { data: coachProfiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'coach')
      .order('created_at', { ascending: false })

    if (!coachProfiles || coachProfiles.length === 0) {
      setCoaches([])
      setIsLoading(false)
      return
    }

    // Fetch stats for each coach
    const coachesWithStats = await Promise.all(
      (coachProfiles as Profile[]).map(async (coach) => {
        // Get coach record
        const { data: coachRecord } = await supabase
          .from('coaches')
          .select('id')
          .eq('user_id', coach.id)
          .single<{ id: string }>()

        if (!coachRecord) {
          return {
            ...coach,
            total_users: 0,
            total_programs: 0,
            total_exercises: 0,
          }
        }

        // Get user count
        const { count: usersCount } = await supabase
          .from('coach_users')
          .select('*', { count: 'exact', head: true })
          .eq('coach_id', coachRecord.id)

        // Get program count
        const { count: programsCount } = await supabase
          .from('programs')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', coach.id)

        // Get exercise count (from coach's programs)
        const { data: coachPrograms } = await supabase
          .from('programs')
          .select('id')
          .eq('created_by', coach.id)

        const programIds = (coachPrograms as { id: string }[] | null)?.map((p) => p.id) || []
        let exercisesCount = 0

        if (programIds.length > 0) {
          const { data: workouts } = await supabase
            .from('workouts')
            .select('id')
            .in('program_id', programIds)

          const workoutIds = (workouts as { id: string }[] | null)?.map((w) => w.id) || []

          if (workoutIds.length > 0) {
            const { count: exCount } = await supabase
              .from('exercises')
              .select('*', { count: 'exact', head: true })
              .in('workout_id', workoutIds)

            exercisesCount = exCount || 0
          }
        }

        return {
          ...coach,
          total_users: usersCount || 0,
          total_programs: programsCount || 0,
          total_exercises: exercisesCount,
        }
      })
    )

    setCoaches(coachesWithStats)
    setIsLoading(false)
  }

  useEffect(() => {
    fetchCoaches()
  }, [])

  const handleToggleActive = async (coachId: string, currentActive: boolean) => {
    const supabase = createClient()

    const { error } = await supabase
      .from('profiles')
      .update({ active: !currentActive } as never)
      .eq('id', coachId)

    if (error) {
      console.error('Error toggling coach:', error)
      setToast({ message: 'Error updating coach', type: 'error', isOpen: true })
      return
    }

    await fetchCoaches()
  }

  const handleViewUsers = async (coach: CoachWithStats) => {
    const supabase = createClient()

    // Get coach record
    const { data: coachRecord } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_id', coach.id)
      .single<{ id: string }>()

    if (!coachRecord) {
      setToast({ message: 'Coach record not found', type: 'error', isOpen: true })
      return
    }

    // Get coach's users
    const { data: coachUserData } = await supabase
      .from('coach_users')
      .select('user_id')
      .eq('coach_id', coachRecord.id)

    const userIds = (coachUserData as { user_id: string }[] | null)?.map((cu) => cu.user_id) || []

    if (userIds.length === 0) {
      setCoachUsers([])
      setSelectedCoach(coach)
      setShowUsersModal(true)
      return
    }

    // Fetch user profiles
    const { data: users } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds)

    setCoachUsers((users as Profile[] | null) || [])
    setSelectedCoach(coach)
    setShowUsersModal(true)
  }

  const handleRemoveUserFromCoach = async (userId: string) => {
    if (!selectedCoach) return

    const supabase = createClient()

    // Get coach record
    const { data: coachRecord } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_id', selectedCoach.id)
      .single<{ id: string }>()

    if (!coachRecord) return

    const { error } = await supabase
      .from('coach_users')
      .delete()
      .eq('coach_id', coachRecord.id)
      .eq('user_id', userId)

    if (error) {
      console.error('Error removing user:', error)
      setToast({ message: 'Error removing user from coach', type: 'error', isOpen: true })
      return
    }

    // Refresh users list
    handleViewUsers(selectedCoach)
    fetchCoaches()
  }

  const handleOpenAssignModal = async () => {
    if (!selectedCoach) return

    const supabase = createClient()

    // Get coach record
    const { data: coachRecord } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_id', selectedCoach.id)
      .single<{ id: string }>()

    if (!coachRecord) return

    // Get currently assigned user IDs
    const { data: assignedUsers } = await supabase
      .from('coach_users')
      .select('user_id')
      .eq('coach_id', coachRecord.id)

    const assignedUserIds = (assignedUsers as { user_id: string }[] | null)?.map((cu) => cu.user_id) || []

    // Fetch all users that are NOT already assigned
    let usersQuery = supabase
      .from('profiles')
      .select('*')
      .eq('role', 'user')
      .eq('active', true)

    // Only add the "not in" filter if there are assigned users
    if (assignedUserIds.length > 0) {
      usersQuery = usersQuery.not('id', 'in', `(${assignedUserIds.join(',')})`)
    }

    const { data: users } = await usersQuery

    setAvailableUsers((users as Profile[] | null) || [])
    setShowAssignModal(true)
  }

  const handleAssignUser = async (userId: string) => {
    if (!selectedCoach) return

    const supabase = createClient()

    // Get coach record
    const { data: coachRecord } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_id', selectedCoach.id)
      .single<{ id: string }>()

    if (!coachRecord) {
      setToast({ message: 'Coach record not found', type: 'error', isOpen: true })
      return
    }

    const { error } = await supabase.from('coach_users').insert({
      user_id: userId,
      coach_id: coachRecord.id,
    } as never)

    if (error) {
      console.error('Error assigning user:', error)
      setToast({ message: `Error assigning user: ${error.message}`, type: 'error', isOpen: true })
      return
    }

    setToast({ message: 'User assigned successfully!', type: 'success', isOpen: true })
    setShowAssignModal(false)
    setUserSearchTerm('')
    handleViewUsers(selectedCoach)
    fetchCoaches()
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

  // Filter coaches by search term
  const filteredCoaches = coaches.filter((coach) =>
    coach.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    coach.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <RoleGuard allowedRoles={['admin']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-text-primary">Manage Coaches</h1>
          <Badge variant="info">{coaches.length} Total Coaches</Badge>
        </div>

        {/* Search */}
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search coaches by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-gray-900 transition-colors"
          />
        </div>

        {/* Coaches Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCoaches.map((coach) => (
            <Card key={coach.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg truncate">{coach.name}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1 truncate">{coach.email}</p>
                  </div>
                  <Badge
                    variant={coach.active ? 'success' : 'danger'}
                    className="shrink-0"
                  >
                    {coach.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-bg-hover rounded-lg p-3">
                      <p className="text-2xl font-bold text-text-primary">{coach.total_users}</p>
                      <p className="text-xs text-gray-400 mt-1">Users</p>
                    </div>
                    <div className="bg-bg-hover rounded-lg p-3">
                      <p className="text-2xl font-bold text-text-primary">{coach.total_programs}</p>
                      <p className="text-xs text-gray-400 mt-1">Programs</p>
                    </div>
                    <div className="bg-bg-hover rounded-lg p-3">
                      <p className="text-2xl font-bold text-text-primary">{coach.total_exercises}</p>
                      <p className="text-xs text-gray-400 mt-1">Exercises</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleViewUsers(coach)}
                      className="w-full"
                    >
                      View Users
                    </Button>
                    <Button
                      variant={coach.active ? 'danger' : 'primary'}
                      onClick={() => handleToggleActive(coach.id, coach.active)}
                      className="w-full"
                    >
                      {coach.active ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {coaches.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-400 mb-2">No coaches found</p>
              <p className="text-sm text-gray-500">
                Add coaches from the main admin dashboard
              </p>
            </CardContent>
          </Card>
        )}

        {/* Users Modal */}
        {showUsersModal && selectedCoach && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle>{selectedCoach.name}'s Users</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {coachUsers.length} {coachUsers.length === 1 ? 'user' : 'users'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleOpenAssignModal}
                    >
                      + Assign User
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowUsersModal(false)
                        setSelectedCoach(null)
                        setCoachUsers([])
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto space-y-4">
                {coachUsers.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-gray-400">No users assigned to this coach</p>
                    <Button
                      variant="outline"
                      onClick={handleOpenAssignModal}
                      className="mt-4"
                    >
                      Assign First User
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Search Users */}
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-gray-900 transition-colors"
                    />
                    <div className="space-y-2">
                      {coachUsers
                        .filter((user) =>
                          user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                          user.email.toLowerCase().includes(userSearchTerm.toLowerCase())
                        )
                        .map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 bg-bg-hover rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-text-primary">{user.name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={user.active ? 'success' : 'danger'}>
                            {user.active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Button
                            variant="danger"
                            onClick={() => handleRemoveUserFromCoach(user.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                        ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Assign User Modal */}
        {showAssignModal && selectedCoach && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>Assign User to {selectedCoach.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAssignModal(false)
                      setUserSearchTerm('')
                    }}
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto space-y-4">
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search available users..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-gray-900 transition-colors"
                />

                {availableUsers.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-gray-400">No available users to assign</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableUsers
                      .filter((user) =>
                        user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                        user.email.toLowerCase().includes(userSearchTerm.toLowerCase())
                      )
                      .map((user) => (
                        <div
                          key={user.id}
                          onClick={() => handleAssignUser(user.id)}
                          className="p-4 border border-border rounded-lg cursor-pointer hover:border-black hover:bg-bg-hover transition-colors"
                        >
                          <p className="font-medium text-text-primary">{user.name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

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
