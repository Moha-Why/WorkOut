'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
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

  const fetchCoaches = async () => {
    const supabase = createClient()

    // Fetch all coaches
    const { data: coachProfiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'coach')
      .order('created_at', { ascending: false })

    if (!coachProfiles) {
      setIsLoading(false)
      return
    }

    // Fetch stats for each coach
    const coachesWithStats = await Promise.all(
      coachProfiles.map(async (coach) => {
        // Get coach record
        const { data: coachRecord } = await supabase
          .from('coaches')
          .select('id')
          .eq('user_id', coach.id)
          .single()

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

        const programIds = coachPrograms?.map((p) => p.id) || []
        let exercisesCount = 0

        if (programIds.length > 0) {
          const { data: workouts } = await supabase
            .from('workouts')
            .select('id')
            .in('program_id', programIds)

          const workoutIds = workouts?.map((w) => w.id) || []

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
      alert('Error updating coach')
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
      .single()

    if (!coachRecord) {
      alert('Coach record not found')
      return
    }

    // Get coach's users
    const { data: coachUserData } = await supabase
      .from('coach_users')
      .select('user_id')
      .eq('coach_id', coachRecord.id)

    const userIds = coachUserData?.map((cu) => cu.user_id) || []

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

    setCoachUsers(users || [])
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
      .single()

    if (!coachRecord) return

    const { error } = await supabase
      .from('coach_users')
      .delete()
      .eq('coach_id', coachRecord.id)
      .eq('user_id', userId)

    if (error) {
      console.error('Error removing user:', error)
      alert('Error removing user from coach')
      return
    }

    // Refresh users list
    handleViewUsers(selectedCoach)
    fetchCoaches()
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
          <h1 className="text-3xl font-bold text-gray-900">Manage Coaches</h1>
          <Badge variant="info">{coaches.length} Total Coaches</Badge>
        </div>

        {/* Coaches Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {coaches.map((coach) => (
            <Card key={coach.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{coach.name}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">{coach.email}</p>
                  </div>
                  <Badge variant={coach.active ? 'success' : 'danger'}>
                    {coach.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-2xl font-bold text-gray-900">{coach.total_users}</p>
                      <p className="text-xs text-gray-600">Users</p>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-2xl font-bold text-gray-900">{coach.total_programs}</p>
                      <p className="text-xs text-gray-600">Programs</p>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-2xl font-bold text-gray-900">{coach.total_exercises}</p>
                      <p className="text-xs text-gray-600">Exercises</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleViewUsers(coach)}
                      className="flex-1"
                    >
                      View Users
                    </Button>
                    <Button
                      variant={coach.active ? 'danger' : 'primary'}
                      onClick={() => handleToggleActive(coach.id, coach.active)}
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
              <p className="text-gray-600 mb-2">No coaches found</p>
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
                  <div>
                    <CardTitle>{selectedCoach.name}'s Users</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {coachUsers.length} {coachUsers.length === 1 ? 'user' : 'users'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowUsersModal(false)
                      setSelectedCoach(null)
                      setCoachUsers([])
                    }}
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {coachUsers.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-gray-600">No users assigned to this coach</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {coachUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
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
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </RoleGuard>
  )
}
