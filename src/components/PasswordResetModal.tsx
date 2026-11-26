import { useState } from 'react';
import { Loader2, X, KeyRound, Eye, EyeOff } from 'lucide-react';

export default function PasswordResetModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    if (!email.trim() || !nickname.trim() || !newPassword) {
      setError('모든 필드를 입력해 주세요.');
      return;
    }
    if (newPassword.length < 6) {
      setError('새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-password`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          nickname: nickname.trim(),
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || '비밀번호 변경에 실패했습니다.');
      }

      setSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '오류가 발생했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-sm bg-[#141418] border border-white/10 rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/40 hover:text-white/70 transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <KeyRound className="w-7 h-7 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">비밀번호 변경 완료</h3>
            <p className="text-sm text-white/50 mb-6">
              새 비밀번호로 로그인할 수 있습니다.
            </p>
            <button
              onClick={onClose}
              className="w-full h-12 rounded-xl bg-white text-[#0A0A0C] font-bold hover:bg-gray-200 active:scale-[0.98] transition"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#141418] border border-white/10 rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white/70 transition"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#0A0A0C] border border-white/10 flex items-center justify-center mb-4">
            <KeyRound className="w-7 h-7 text-white/90" strokeWidth={1.8} />
          </div>
          <h3 className="text-lg font-bold text-white mb-1.5">비밀번호 재설정</h3>
          <p className="text-[13px] text-white/40">
            가입 시 사용한 이메일과 닉네임을 입력하면
            <br />
            새 비밀번호로 즉시 변경됩니다.
          </p>
        </div>

        <div className="space-y-4">
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
            <label className="block text-sm font-medium text-gray-300 mb-1.5">닉네임</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="가입 시 닉네임"
              maxLength={20}
              className="w-full h-12 px-4 rounded-xl bg-[#0A0A0C] border border-white/10 focus:border-white/40 outline-none transition text-gray-100 placeholder:text-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">새 비밀번호</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="6자 이상"
                autoComplete="new-password"
                onKeyDown={(e) => e.key === 'Enter' && submit()}
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
            onClick={submit}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-white text-[#0A0A0C] font-bold hover:bg-gray-200 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            비밀번호 변경
          </button>
        </div>
      </div>
    </div>
  );
}
