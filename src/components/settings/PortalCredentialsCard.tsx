import React, { useState } from 'react'
import {
  KeyRound,
  Eye,
  EyeOff,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Lock,
  UserCheck,
} from 'lucide-react'
import { useTheme } from '../../store/themeStore'
import { useAdminAuthStore } from '../../store/adminAuthStore'
import {
  fetchPortalCredentials,
  updatePortalCredential,
  type PortalCredentialsMap,
} from '../../services/portalCredentialsService'

export const PortalCredentialsCard: React.FC = () => {
  const { themeColor, textColor, lightBg, subtleBorder } = useTheme()
  const { adminId: currentAdminId, updateAdminId } = useAdminAuthStore()

  // Local state for revealed data (NEVER persisted to storage, unmount resets to hidden)
  const [isRevealed, setIsRevealed] = useState(false)
  const [credentials, setCredentials] = useState<PortalCredentialsMap | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Auth modal states
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authPassword, setAuthPassword] = useState('')
  const [showAuthPassword, setShowAuthPassword] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<'reveal' | 'edit-admin' | 'edit-staff' | null>(null)

  // Edit modal states
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editTargetRole, setEditTargetRole] = useState<'admin' | 'staff'>('admin')
  const [editLoginId, setEditLoginId] = useState('')
  const [editNewPassword, setEditNewPassword] = useState('')
  const [editConfirmPassword, setEditConfirmPassword] = useState('')
  const [showEditNewPassword, setShowEditNewPassword] = useState(false)
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false)
  const [editLoading, setEditLoading] = useState(false)

  // Verified admin credentials cached only for the current active editing session
  const [verifiedAdminPassword, setVerifiedAdminPassword] = useState('')

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message })
    setTimeout(() => {
      setNotice(null)
    }, 4500)
  }

  // Handle clicking "Reveal" or "Hide"
  const handleToggleReveal = () => {
    if (isRevealed) {
      // Hide immediately
      setIsRevealed(false)
      setCredentials(null)
      setVerifiedAdminPassword('')
      showNotification('success', 'Portal credentials are now hidden.')
    } else {
      // Require admin password verification
      setPendingAction('reveal')
      setAuthPassword('')
      setShowAuthPassword(false)
      setAuthModalOpen(true)
    }
  }

  // Handle clicking "Edit" for Admin or Staff
  const handleStartEdit = (role: 'admin' | 'staff') => {
    setEditTargetRole(role)
    if (verifiedAdminPassword && credentials) {
      // Already authenticated in current active view
      openEditModal(role, credentials)
    } else {
      // Prompt for admin password first
      setPendingAction(role === 'admin' ? 'edit-admin' : 'edit-staff')
      setAuthPassword('')
      setShowAuthPassword(false)
      setAuthModalOpen(true)
    }
  }

  const openEditModal = (role: 'admin' | 'staff', creds: PortalCredentialsMap) => {
    const target = role === 'admin' ? creds.admin : creds.staff
    setEditLoginId(target?.login_id || (role === 'admin' ? 'admin' : 'staff'))
    setEditNewPassword(target?.password || '')
    setEditConfirmPassword(target?.password || '')
    setShowEditNewPassword(false)
    setShowEditConfirmPassword(false)
    setEditModalOpen(true)
  }

  // Submit Admin Verification Popup
  const handleVerifyAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authPassword.trim()) {
      showNotification('error', 'Please enter your current admin password.')
      return
    }

    setAuthLoading(true)
    const effectiveAdminId = currentAdminId || 'admin'
    const result = await fetchPortalCredentials(effectiveAdminId, authPassword.trim())
    setAuthLoading(false)

    if (!result.success || !result.data) {
      showNotification('error', result.error || 'Authentication failed. Please verify your password.')
      return
    }

    // Authentication succeeded
    setCredentials(result.data)
    setVerifiedAdminPassword(authPassword.trim())
    setAuthModalOpen(false)

    if (pendingAction === 'reveal') {
      setIsRevealed(true)
      showNotification('success', 'Portal credentials successfully revealed.')
    } else if (pendingAction === 'edit-admin') {
      setIsRevealed(true)
      openEditModal('admin', result.data)
    } else if (pendingAction === 'edit-staff') {
      setIsRevealed(true)
      openEditModal('staff', result.data)
    }
    setPendingAction(null)
  }

  // Submit Edit Credentials
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanId = editLoginId.trim()
    const cleanPass = editNewPassword.trim()
    const confirmPass = editConfirmPassword.trim()

    if (cleanId.length < 3) {
      showNotification('error', 'Login ID must be at least 3 characters.')
      return
    }
    if (cleanPass.length < 6) {
      showNotification('error', 'New password must be at least 6 characters.')
      return
    }
    if (cleanPass !== confirmPass) {
      showNotification('error', 'New password and confirmation do not match.')
      return
    }

    setEditLoading(true)
    const effectiveAdminId = currentAdminId || 'admin'
    const result = await updatePortalCredential(
      effectiveAdminId,
      verifiedAdminPassword,
      editTargetRole,
      cleanId,
      cleanPass
    )
    setEditLoading(false)

    if (!result.success) {
      showNotification('error', result.error || 'Failed to update credentials.')
      return
    }

    // Success: update local credentials state
    setCredentials((prev) => ({
      ...prev,
      [editTargetRole]: {
        login_id: cleanId,
        password: cleanPass,
      },
    }))

    // If admin updated their own password or ID, update session and cache
    if (editTargetRole === 'admin') {
      setVerifiedAdminPassword(cleanPass)
      if (updateAdminId && cleanId !== currentAdminId) {
        updateAdminId(cleanId)
      }
    }

    setEditModalOpen(false)
    showNotification('success', `${editTargetRole === 'admin' ? 'Admin' : 'Staff'} credentials updated & synced to database.`)
  }

  // Display values: masked if not revealed
  const adminIdDisplay = isRevealed && credentials?.admin ? credentials.admin.login_id : '••••••••'
  const adminPassDisplay = isRevealed && credentials?.admin ? credentials.admin.password : '••••••••••••'
  const staffIdDisplay = isRevealed && credentials?.staff ? credentials.staff.login_id : '••••••••'
  const staffPassDisplay = isRevealed && credentials?.staff ? credentials.staff.password : '••••••••••••'

  return (
    <>
      <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-6 sm:p-7 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound size={18} className="text-gray-700" />
              <h3 className="text-sm font-black uppercase tracking-wider text-[#111111]">
                Portal Access &amp; Passwords
              </h3>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-1">
              In-app changeable terminal credentials stored securely in your database.
            </p>
          </div>

          {/* Reveal / Hide Action Button */}
          <button
            type="button"
            onClick={handleToggleReveal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer shadow-xs hover:opacity-90 active:scale-95 shrink-0"
            style={
              isRevealed
                ? { backgroundColor: '#F3F4F6', color: '#374151', borderColor: '#E5E7EB' }
                : { backgroundColor: lightBg, color: themeColor, borderColor: subtleBorder }
            }
          >
            {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
          </button>
        </div>

        {/* Security Alert / Status Badge */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-gray-600">
            <Lock size={14} className={isRevealed ? 'text-amber-500' : 'text-emerald-600'} />
            <span className="font-bold">
              {isRevealed ? 'Credentials Unmasked' : 'Protected by Admin Password'}
            </span>
          </div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            {isRevealed ? 'Session View' : 'Encrypted & Masked'}
          </span>
        </div>

        {/* Floating Notification */}
        {notice && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2.5 shadow-sm transition-all animate-in fade-in duration-150 ${
              notice.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-red-600 shrink-0" />
            )}
            <span>{notice.message}</span>
          </div>
        )}

        {/* 4 Textboxes Grid */}
        <div className="space-y-4">
          {/* Section 1: Admin Credentials */}
          <div className="p-4 rounded-2xl border border-gray-200/80 bg-white space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-gray-700 tracking-wider flex items-center gap-1.5">
                <UserCheck size={14} className="text-gray-500" />
                Admin Terminal Access
              </span>
              <button
                type="button"
                onClick={() => handleStartEdit('admin')}
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
              >
                <Edit2 size={12} />
                Edit
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Box 1: Admin ID */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Admin Login ID
                </label>
                <input
                  type="text"
                  readOnly
                  value={adminIdDisplay}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50/80 text-xs font-mono font-bold text-gray-900 outline-none cursor-default select-all"
                />
              </div>

              {/* Box 2: Admin Password */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Admin Password
                </label>
                <input
                  type={isRevealed ? 'text' : 'password'}
                  readOnly
                  value={adminPassDisplay}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50/80 text-xs font-mono font-bold text-gray-900 outline-none cursor-default select-all"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Staff Credentials */}
          <div className="p-4 rounded-2xl border border-gray-200/80 bg-white space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-gray-700 tracking-wider flex items-center gap-1.5">
                <UserCheck size={14} className="text-gray-500" />
                Staff Terminal Access
              </span>
              <button
                type="button"
                onClick={() => handleStartEdit('staff')}
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
              >
                <Edit2 size={12} />
                Edit
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Box 3: Staff ID */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Staff Login ID
                </label>
                <input
                  type="text"
                  readOnly
                  value={staffIdDisplay}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50/80 text-xs font-mono font-bold text-gray-900 outline-none cursor-default select-all"
                />
              </div>

              {/* Box 4: Staff Password */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Staff Password
                </label>
                <input
                  type={isRevealed ? 'text' : 'password'}
                  readOnly
                  value={staffPassDisplay}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50/80 text-xs font-mono font-bold text-gray-900 outline-none cursor-default select-all"
                />
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 leading-relaxed">
          Switching to any other section or refreshing the page instantly returns all credentials to hidden mode for safety.
        </p>
      </div>

      {/* ── POPUP 1: ADMIN PASSWORD VERIFICATION MODAL ── */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: lightBg, color: themeColor }}
                >
                  <Lock size={20} />
                </div>
                <div>
                  <h4 className="text-base font-black text-[#111111]">Admin Verification</h4>
                  <p className="text-xs text-gray-500 font-medium">
                    Enter current admin password to {pendingAction === 'reveal' ? 'reveal' : 'edit'} portal credentials.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleVerifyAdmin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider mb-1.5">
                  Current Admin Password
                </label>
                <div className="relative">
                  <input
                    type={showAuthPassword ? 'text' : 'password'}
                    autoFocus
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-200 bg-gray-50 text-sm font-mono text-gray-900 outline-none focus:bg-white focus:border-gray-400 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthPassword(!showAuthPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  >
                    {showAuthPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black shadow-sm transition disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: themeColor, color: textColor }}
                >
                  {authLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>Verify &amp; Continue</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── POPUP 2: EDIT PORTAL CREDENTIALS MODAL ── */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: lightBg, color: themeColor }}
                >
                  <Edit2 size={20} />
                </div>
                <div>
                  <h4 className="text-base font-black text-[#111111]">
                    Edit {editTargetRole === 'admin' ? 'Admin' : 'Staff'} Credentials
                  </h4>
                  <p className="text-xs text-gray-500 font-medium">
                    Changes take effect immediately on login terminals.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Login ID */}
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider mb-1.5">
                  Login ID (Min 3 characters)
                </label>
                <input
                  type="text"
                  required
                  value={editLoginId}
                  onChange={(e) => setEditLoginId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-mono text-gray-900 outline-none focus:bg-white focus:border-gray-400 transition"
                />
              </div>

              {/* New Password */}
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider mb-1.5">
                  New Password (Min 6 characters)
                </label>
                <div className="relative">
                  <input
                    type={showEditNewPassword ? 'text' : 'password'}
                    required
                    value={editNewPassword}
                    onChange={(e) => setEditNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-200 bg-gray-50 text-sm font-mono text-gray-900 outline-none focus:bg-white focus:border-gray-400 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditNewPassword(!showEditNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  >
                    {showEditNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showEditConfirmPassword ? 'text' : 'password'}
                    required
                    value={editConfirmPassword}
                    onChange={(e) => setEditConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-200 bg-gray-50 text-sm font-mono text-gray-900 outline-none focus:bg-white focus:border-gray-400 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditConfirmPassword(!showEditConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  >
                    {showEditConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black shadow-sm transition disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: themeColor, color: textColor }}
                >
                  {editLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>Save Credentials</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
