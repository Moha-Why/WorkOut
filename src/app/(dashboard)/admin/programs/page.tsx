'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Toast } from '@/components/ui/Toast'
import type { Program } from '@/types'

interface ProgramWithCreator extends Program {
  creator_name: string
  workout_count: number
  assigned_users: number
}

interface User {
  id: string
  name: string
  email: string
}

export default function AdminProgramsPage() {
  const { profile } = useAuth()
  const [programs, setPrograms] = useState<ProgramWithCreator[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState<ProgramWithCreator | null>(
    null
  )
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [showUsersModal, setShowUsersModal] = useState(false)
  const [assignedUsersList, setAssignedUsersList] = useState<{ name: string; email: string }[]>([])
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
    const supabase = createClient()

    // Fetch all programs (excluding exercise libraries)
    const { data: programsData } = await supabase
      .from('programs')
      .select('*, profiles!programs_created_by_fkey(name)')
      .not('name', 'like', 'Exercise Library -%')
      .order('created_at', { ascending: false })

    if (!programsData || programsData.length === 0) {
      setPrograms([])
      setIsLoading(false)
      return
    }

    // Fetch stats for each program
    const programsWithStats = await Promise.all(
      programsData.map(async (program: any) => {
        // Get workout count
        const { count: workoutCount } = await supabase
          .from('workouts')
          .select('*', { count: 'exact', head: true })
          .eq('program_id', program.id)

        // Get assigned users count
        const { count: assignedUsers } = await supabase
          .from('user_programs')
          .select('*', { count: 'exact', head: true })
          .eq('program_id', program.id)

        return {
          id: program.id,
          name: program.name,
          description: program.description,
          weeks: program.weeks,
          created_by: program.created_by,
          duplicated_from: program.duplicated_from,
          created_at: program.created_at,
          updated_at: program.updated_at,
          creator_name: program.profiles?.name || 'Unknown',
          workout_count: workoutCount || 0,
          assigned_users: assignedUsers || 0,
        }
      })
    )

    setPrograms(programsWithStats)

    // Fetch all users (for assignment)
    const { data: usersData } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('role', 'user')
      .eq('active', true)
      .order('name', { ascending: true })

    setUsers((usersData as User[]) || [])
    setIsLoading(false)
  }

  const handleAssignProgram = async () => {
    if (!selectedProgram || !selectedUserId || !profile) {
      setToast({ message: 'Please select a user', type: 'error', isOpen: true })
      return
    }

    const supabase = createClient()

    // Check if already assigned
    const { data: existing } = await supabase
      .from('user_programs')
      .select('id')
      .eq('user_id', selectedUserId)
      .eq('program_id', selectedProgram.id)
      .single()

    if (existing) {
      setToast({ message: 'This program is already assigned to this user', type: 'error', isOpen: true })
      return
    }

    const { error } = await supabase.from('user_programs').insert({
      user_id: selectedUserId,
      program_id: selectedProgram.id,
      assigned_by: profile.id,
    } as never)

    if (error) {
      console.error('Error assigning program:', error)
      setToast({ message: 'Error assigning program', type: 'error', isOpen: true })
      return
    }

    setToast({ message: 'Program assigned successfully!', type: 'success', isOpen: true })
    setShowAssignModal(false)
    setSelectedProgram(null)
    setSelectedUserId(null)
    await fetchData()
  }

  const handleViewAssignedUsers = async (program: ProgramWithCreator) => {
    const supabase = createClient()

    const { data: assignments } = await supabase
      .from('user_programs')
      .select('user_id, profiles!user_programs_user_id_fkey(name, email)')
      .eq('program_id', program.id)

    if (!assignments || assignments.length === 0) {
      setToast({ message: 'No users assigned to this program', type: 'info', isOpen: true })
      return
    }

    const userList = assignments.map((a: any) => ({
      name: a.profiles.name,
      email: a.profiles.email,
    }))

    setAssignedUsersList(userList)
    setSelectedProgram(program)
    setShowUsersModal(true)
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
          <h1 className="text-3xl font-bold text-text-primary">All Programs</h1>
          <Badge variant="info">{programs.length} Total Programs</Badge>
        </div>

        {programs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-400 mb-4">No programs in the system yet</p>
              <p className="text-sm text-gray-500">
                Coaches will create programs from their dashboard
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => (
              <Card key={program.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg truncate">
                        {program.name}
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1 truncate">
                        By {program.creator_name}
                      </p>
                      {program.description && (
                        <p className="text-xs text-gray-400 mt-2 line-clamp-2">
                          {program.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="info" className="shrink-0">
                      {program.weeks}w
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-bg-hover rounded-lg p-3">
                        <p className="text-2xl font-bold text-text-primary">
                          {program.workout_count}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Workouts</p>
                      </div>
                      <div className="bg-bg-hover rounded-lg p-3">
                        <p className="text-2xl font-bold text-text-primary">
                          {program.assigned_users}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Users</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="primary"
                        onClick={() => {
                          setSelectedProgram(program)
                          setShowAssignModal(true)
                        }}
                        className="w-full"
                      >
                        Assign to User
                      </Button>
                      {program.assigned_users > 0 && (
                        <Button
                          variant="outline"
                          onClick={() => handleViewAssignedUsers(program)}
                          className="w-full"
                          size="sm"
                        >
                          View Assigned Users
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Assign Program Modal */}
        {showAssignModal && selectedProgram && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Assign "{selectedProgram.name}" to User</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {users.length === 0 ? (
                  <p className="text-center text-gray-400 py-4">
                    No active users available
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => setSelectedUserId(user.id)}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedUserId === user.id
                            ? 'border-black bg-bg-hover'
                            : 'border-border hover:border-gray-400'
                        }`}
                      >
                        <h4 className="font-semibold text-text-primary">{user.name}</h4>
                        <p className="text-sm text-gray-400">{user.email}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAssignModal(false)
                      setSelectedProgram(null)
                      setSelectedUserId(null)
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAssignProgram}
                    disabled={!selectedUserId}
                    className="flex-1"
                  >
                    Assign Program
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* View Assigned Users Modal */}
        {showUsersModal && selectedProgram && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Users assigned to "{selectedProgram.name}"</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {assignedUsersList.map((user, index) => (
                    <div
                      key={index}
                      className="p-4 border border-border rounded-lg"
                    >
                      <h4 className="font-semibold text-text-primary">{user.name}</h4>
                      <p className="text-sm text-gray-400">{user.email}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowUsersModal(false)
                      setSelectedProgram(null)
                      setAssignedUsersList([])
                    }}
                    className="flex-1"
                  >
                    Close
                  </Button>
                </div>
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
