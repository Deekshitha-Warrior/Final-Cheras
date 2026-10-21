import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Lock, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react'
import { useAdminAuthStore } from '../store/store'
import { BRAND_EN, BRAND_TA, BRAND_SUBTITLE, BRAND_LOGO } from '../lib/brand'
import { useLangStore } from '../store/langStore'
import { alarmSound } from '../lib/alarmAudio'

export default function AdminLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const { lang } = useLangStore()
  const l = (en: string, ta: string) => lang === 'ta' ? ta : en
  const login = useAdminAuthStore((state) => state.login)

  const [portalId, setPortalId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Pre-unlock iOS audio context synchronously on user submit gesture
    void alarmSound.unlock()
    setError('')
    setLoading(true)
    const role = await login(portalId.trim(), password)
    setLoading(false)
    if (role === 'admin') {
      const destination = from === '/pos' ? '/dashboard' : from
      navigate(destination, { replace: true })
    } else if (role === 'staff') {
      navigate('/dashboard', { replace: true })
    } else {
      const storeError = useAdminAuthStore.getState().authError
      setError(storeError || l('Invalid Admin or Staff credentials', 'தவறான நிர்வாகி அல்லது பணியாளர் விவரங்கள்'))
    }
  }

  return (
    <div className="relative h-screen max-h-screen min-h-screen overflow-y-auto lg:overflow-hidden bg-white p-3 sm:p-5 lg:p-6 font-sans flex items-center justify-center">
      <div className="relative grid w-full max-w-4xl max-h-[92dvh] overflow-hidden rounded-3xl border border-gray-200/90 bg-white shadow-[0_25px_60px_-12px_rgba(0,0,0,0.25),0_12px_28px_-6px_rgba(0,0,0,0.15)] lg:grid-cols-[0.85fr_1.15fr]">
        <div className="hidden flex-col justify-between items-center bg-[#171717] border-r border-[#B8B8B8]/30 p-8 lg:p-10 text-white lg:flex overflow-y-auto hide-scrollbar">
          <div className="w-full flex items-center justify-between">
            {BRAND_SUBTITLE && <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#B8B8B8]">{BRAND_SUBTITLE}</p>}
          </div>
          <div className="my-auto flex flex-col items-center justify-center py-6 w-full">
            <div
              className="relative p-6 sm:p-8 rounded-3xl bg-[#FFFFFF] border border-[#E5E5E5] shadow-[0_12px_32px_rgba(0,0,0,0.12),0_4px_8px_rgba(0,0,0,0.06)] flex items-center justify-center max-w-[280px] w-full aspect-square"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E5E5' }}
            >
              <img
                src={BRAND_LOGO}
                alt={BRAND_EN}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <div className="w-full flex items-center justify-center gap-2 text-xs font-bold text-[#B8B8B8]">
            <ShieldCheck size={15} /> Secure retail workspace
          </div>
        </div>
        <div className="p-5 sm:p-7 lg:p-8 bg-white text-[#222222] overflow-y-auto hide-scrollbar flex flex-col justify-center">
          {/* Brand */}
          <div className="mb-4 sm:mb-5 flex flex-col items-center text-center lg:items-start lg:text-left">
            {/* Mobile-only logo (since left panel is hidden on mobile) */}
            <div className="mb-3 lg:hidden flex justify-center">
              <div
                className="w-16 h-16 rounded-2xl bg-[#FFFFFF] border border-[#E5E5E5] p-2 flex items-center justify-center shadow-sm"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E5E5' }}
              >
                <img src={BRAND_LOGO} alt={BRAND_EN} className="w-full h-full object-contain" />
              </div>
            </div>
            {BRAND_SUBTITLE && <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#B8B8B8]">{BRAND_SUBTITLE}</p>}
            <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-[#222222]">{BRAND_EN}</h1>
            {BRAND_TA && BRAND_TA !== BRAND_EN && (
              <p className="mt-0.5 text-xs font-semibold text-[#7A786F]">{BRAND_TA}</p>
            )}
            <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#B8B8B8] bg-[#F5F5F5] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#222222]">
              <ShieldCheck size={12} className="text-[#B8B8B8]" />
              {l('Admin / Staff Portal', 'நிர்வாக நுழைவு')}
            </p>
          </div>

          {/* Server-level error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-3.5 py-2.5 rounded-xl text-[12px] mb-3.5 flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
            <p className="text-xs font-bold text-[#222222]">{l('Enter your portal credentials', 'உங்கள் பயனர் விவரங்களை உள்ளிடவும்')}</p>

            <div>
              <label htmlFor="admin-portal-id" className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#666666]">
                <ShieldCheck size={13} />
                Portal ID
                <span className="font-black text-red-500">*</span>
              </label>
              <input
                id="admin-portal-id"
                name="portalId"
                type="text"
                autoComplete="username"
                placeholder="Enter portal ID"
                className="w-full rounded-xl border-2 border-[#F3F4F6] bg-[#FBFAF6] px-3.5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold outline-none transition-colors placeholder:text-[#AAA69C] focus:border-[#171717] focus:bg-white text-[#222222]"
                value={portalId}
                onChange={(e) => { setPortalId(e.target.value); setError('') }}
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="admin-portal-password" className="flex items-center gap-1.5 text-[10px] font-bold text-[#666666] uppercase tracking-wide mb-1">
                <Lock size={13} />
                {l('Portal Password', 'நுழைவு கடவுச்சொல்')}
                <span className="text-red-500 font-black">*</span>
              </label>
              <div className="relative">
                <input
                  id="admin-portal-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter portal password"
                  className="w-full rounded-xl border-2 border-[#F3F4F6] bg-[#FBFAF6] px-3.5 py-2.5 sm:py-3 pr-11 text-xs sm:text-sm font-semibold outline-none transition-colors placeholder:text-[#AAA69C] focus:border-[#171717] focus:bg-white text-[#222222]"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#666666] hover:bg-[#F9FAFB] hover:text-[#222222] cursor-pointer"
                  aria-label={showPassword ? l('Hide password', 'கடவுச்சொல்லை மறை') : l('Show password', 'கடவுச்சொல்லை காட்டு')}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#B8B8B8] border border-[#A3A3A3] py-3 font-black text-xs sm:text-sm text-[#222222] shadow-lg shadow-black/20 transition-all hover:bg-[#A3A3A3] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-[#222222]/30 border-t-[#222222] rounded-full animate-spin inline-block" />
                  {l('Signing in...', 'உள்நுழைகிறது...')}
                </>
              ) : (
                <>
                  <Lock size={14} />
                  {l(`Sign In to ${BRAND_EN} Portal`, `${BRAND_EN} போர்ட்டலில் உள்நுழை`)}
                </>
              )}
            </button>

            <p className="text-center text-[10px] leading-relaxed text-[#888888]">
              {l('Enter your admin or staff credentials to access billing & inventory.', 'பில்லிங் மற்றும் சரக்கு இருப்பு நிர்வாகத்தை அணுக பயனர் விவரங்களை உள்ளிடவும்.')}
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
