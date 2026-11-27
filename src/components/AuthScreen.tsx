import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Waypoints, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import PasswordResetModal from '@/components/PasswordResetModal';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        // Clear any stale/corrupted session before fresh login
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore — session may already be invalid
        }
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('sb-') || key.includes('-auth-token')) {
            localStorage.removeItem(key);
          }
        }
      }

      if (mode === 'signup') {
        if (!nickname.trim()) {
          setError('닉네임을 입력해 주세요.');
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { nickname: nickname.trim() } },
        });
        if (error) throw error;
        if (data.user) {
          await supabase
            .from('profiles')
            .insert({ id: data.user.id, nickname: nickname.trim() });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '오류가 발생했습니다.';
      if (message.includes('already registered')) {
        setError('이미 가입된 이메일입니다. 로그인해 주세요.');
      } else if (message.includes('Invalid login credentials')) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (message.includes('Password should be at least')) {
        setError('비밀번호는 6자 이상이어야 합니다.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full opacity-25 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(120,170,255,0.35) 0%, rgba(120,170,255,0) 70%)',
        }}
      />

      <div className="w-full max-w-sm relative">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-[28px] bg-[#141418] border border-white/10 flex items-center justify-center shadow-[0_8px_40px_rgba(0,0,0,0.6)] mb-5">
            <Waypoints className="w-10 h-10 text-white/90" strokeWidth={1.8} />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-[0.35em] pl-[0.35em] uppercase">
            Nexus
          </h1>
          <p className="text-white/40 text-[13px] tracking-[0.18em] uppercase mt-2.5">
            Beyond the Rules
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#141418] border border-white/10 rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] space-y-4"
        >
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">닉네임</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="사용할 닉네임"
                maxLength={20}
                className="w-full h-12 px-4 rounded-xl bg-[#0A0A0C] border border-white/10 focus:border-white/40 outline-none transition text-gray-100 placeholder:text-gray-600"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              autoComplete="email"
              className="w-full h-12 px-4 rounded-xl bg-[#0A0A0C] border border-white/10 focus:border-white/40 outline-none transition text-gray-100 placeholder:text-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">비밀번호</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="w-full h-12 px-4 pr-12 rounded-xl bg-[#0A0A0C] border border-white/10 focus:border-white/40 outline-none transition text-gray-100 placeholder:text-gray-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-white text-[#0A0A0C] font-bold hover:bg-gray-200 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'signin' ? '로그인' : '회원가입'}
          </button>

          <button
            type="button"
            onClick={switchMode}
            className="w-full text-sm text-gray-400 hover:text-gray-200 transition"
          >
            {mode === 'signin' ? (
              <>계정이 없으신가요? <span className="font-semibold text-white">회원가입</span></>
            ) : (
              <>이미 계정이 있으신가요? <span className="font-semibold text-white">로그인</span></>
            )}
          </button>

          {mode === 'signin' && (
            <button
              type="button"
              onClick={() => setShowReset(true)}
              className="w-full text-sm text-gray-400 hover:text-gray-200 transition pt-1"
            >
              비밀번호를 잊으셨나요? <span className="font-semibold text-white\">비밀번호 재설정</span>
            </button>
          )}
        </form>

        <p className="text-center text-white/30 text-xs mt-6 flex items-center justify-center gap-1">
          <Lock className="w-3 h-3" /> 안전하게 암호화되어 보관됩니다
        </p>
      </div>

      {showReset && <PasswordResetModal onClose={() => setShowReset(false)} />}
    </div>
  );
}
