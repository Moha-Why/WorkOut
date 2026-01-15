'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Toast } from '@/components/ui/Toast'
import type { Profile, Program } from '@/types'

interface UserWithStats extends Profile {
  assigned_programs: number
  completed_workouts: number
  last_activity: string | null
}

export default function CoachUsersPage() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null)
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null)
  const [showUnassignConfirm, setShowUnassignConfirm] = useState(false)
  const [userToUnassign, setUserToUnassign] = useState<{ id: string; name: string } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({
    message: '',
    type: 'success',
    isOpen: false,
  })

  useEffect(() => {
    if (profile) {
      fetchData()
    }
  }, [profile])

  const fetchData = async () => {
    if (!profile) return

    const supabase = createClient()

    // Get coach record
    const { data: coachRecord } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_id', profile.id)
      .single<{ id: string }>()

    if (!coachRecord) {
      setIsLoading(false)
      return
    }

    // Get coach's users
    const { data: coachUsers } = await supabase
      .from('coach_users')
      .select('user_id')
      .eq('coach_id', coachRecord.id)

    const userIds =
      (coachUsers as { user_id: string }[] | null)?.map((cu) => cu.user_id) || []

    if (userIds.length === 0) {
      setUsers([])
      setIsLoading(false)
      return
    }

    // Fetch user profiles
    const { data: userProfiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds)
      .eq('role', 'user')

    if (!userProfiles || userProfiles.length === 0) {
      setUsers([])
      setIsLoading(false)
      return
    }

    // Fetch stats for each user
    const usersWithStats = await Promise.all(
      (userProfiles as Profile[]).map(async (user) => {
        // Get assigned programs count
        const { count: programCount } = await supabase
          .from('user_programs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        // Get completed workouts count
        const { count: workoutCount } = await supabase
          .from('user_workout_progress')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        // Get last activity
        const { data: lastActivity } = await supabase
          .from('user_workout_progress')
          .select('completed_at')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false })
          .limit(1)
          .single()

        return {
          ...user,
          assigned_programs: programCount || 0,
          completed_workouts: workoutCount || 0,
          last_activity: lastActivity
            ? (lastActivity as { completed_at: string }).completed_at
            : null,
        }
      })
    )

    setUsers(usersWithStats)

    // Fetch coach's programs for assignment (exclude exercise library)
    const { data: programData } = await supabase
      .from('programs')
      .select('*')
      .eq('created_by', profile.id)
      .neq('name', `Exercise Library - ${profile.id}`)
      .order('name', { ascending: true })

    setPrograms((programData as Program[]) || [])
    setIsLoading(false)
  }

  const handleAssignProgram = async () => {
    if (!selectedUser || !selectedProgram || !profile) {
      setToast({ message: 'Please select a program', type: 'error', isOpen: true })
      return
    }

    const supabase = createClient()

    // Check if already assigned
    const { data: existing } = await supabase
      .from('user_programs')
      .select('id')
      .eq('user_id', selectedUser.id)
      .eq('program_id', selectedProgram)
      .single()

    if (existing) {
      setToast({ message: 'This program is already assigned to this user', type: 'error', isOpen: true })
      return
    }

    const { error } = await supabase.from('user_programs').insert({
      user_id: selectedUser.id,
      program_id: selectedProgram,
      assigned_by: profile.id,
    } as never)

    if (error) {
      console.error('Error assigning program:', error)
      setToast({ message: 'Error assigning program', type: 'error', isOpen: true })
      return
    }

    setToast({ message: 'Program assigned successfully!', type: 'success', isOpen: true })
    setShowAssignModal(false)
    setSelectedUser(null)
    setSelectedProgram(null)
    await fetchData()
  }

  const handleUnassignProgram = async () => {
    if (!userToUnassign) return

    const supabase = createClient()

    const { error } = await supabase
      .from('user_programs')
      .delete()
      .eq('user_id', userToUnassign.id)

    if (error) {
      console.error('Error unassigning programs:', error)
      setToast({ message: 'Error unassigning programs', type: 'error', isOpen: true })
      return
    }

    setToast({ message: 'Programs unassigned successfully', type: 'success', isOpen: true })
    setUserToUnassign(null)
    await fetchData()
  }

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never'

    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return `${Math.floor(diffDays / 30)} months ago`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-text-primary">My Users</h1>
        <Badge variant="info">{users.length} Total Users</Badge>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-400 mb-4">No users assigned yet</p>
            <p className="text-sm text-gray-500">
              Contact your admin to get users assigned to you
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <Card key={user.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg truncate">{user.name}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1 truncate">
                      {user.email}
                    </p>
                  </div>
                  <Badge
                    variant={user.active ? 'success' : 'danger'}
                    className="shrink-0"
                  >
                    {user.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-bg-hover rounded-lg p-3">
                      <p className="text-2xl font-bold text-text-primary">
                        {user.assigned_programs}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Programs</p>
                    </div>
                    <div className="bg-bg-hover rounded-lg p-3">
                      <p className="text-2xl font-bold text-text-primary">
                        {user.completed_workouts}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Workouts</p>
                    </div>
                  </div>

                  {/* Last Activity */}
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Last Activity</p>
                    <p className="text-sm font-medium text-text-primary">
                      {formatDate(user.last_activity)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="primary"
                      onClick={() => {
                        setSelectedUser(user)
                        setShowAssignModal(true)
                      }}
                      className="w-full"
                    >
                      Assign Program
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setUserToUnassign({ id: user.id, name: user.name })
                        setShowUnassignConfirm(true)
                      }}
                      className="w-full"
                      size="sm"
                    >
                      Remove Programs
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Assign Program Modal */}
      {showAssignModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Assign Program to {selectedUser.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {programs.length === 0 ? (
                <p className="text-center text-gray-400 py-4">
                  No programs available. Create a program first.
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {programs.map((program) => (
                    <div
                      key={program.id}
                      onClick={() => setSelectedProgram(program.id)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedProgram === program.id
                          ? 'border-black bg-bg-hover'
                          : 'border-border hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-text-primary">
                            {program.name}
                          </h4>
                          {program.description && (
                            <p className="text-sm text-gray-400 mt-1">
                              {program.description}
                            </p>
                          )}
                        </div>
                        <Badge variant="info">{program.weeks}w</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAssignModal(false)
                    setSelectedUser(null)
                    setSelectedProgram(null)
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAssignProgram}
                  disabled={!selectedProgram}
                  className="flex-1"
                >
                  Assign Program
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Unassign Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showUnassignConfirm}
        onClose={() => {
          setShowUnassignConfirm(false)
          setUserToUnassign(null)
        }}
        onConfirm={handleUnassignProgram}
        title="Remove All Programs"
        message={`Are you sure you want to remove all program assignments from ${userToUnassign?.name}? This action cannot be undone.`}
        confirmText="Remove Programs"
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
  )
}
