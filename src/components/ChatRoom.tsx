import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, type Room, type Message, type Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { uploadToBucket } from '@/components/AvatarUpload';
import ParticipantsModal, { type MemberRole } from '@/components/ParticipantsModal';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import {
  ArrowLeft,
  Send,
  Image as ImageIcon,
  Loader2,
  X,
  Users,
} from 'lucide-react';

const REACTION_EMOJIS = ['❤️', '😂', '👍', '🔥', '😮', '😢'];

type Reaction = {
  emoji: string;
  count: number;
  mine: boolean;
};

function formatDateBadge(iso: string): string {
  const date = new Date(iso);
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  return formatter.format(date);
}

function dateKey(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

type ChatRoomProps = {
  room: Room;
  onBack: () => void;
  onRoomUpdated: (room: Room) => void;
};

type ChatMessage = Message & { profiles: Profile | null };

export default function ChatRoom({ room, onBack, onRoomUpdated }: ChatRoomProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [input, setInput] = useState('');
  const [sendingImage, setSendingImage] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [myRole, setMyRole] = useState<MemberRole>('none');
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [customEmoji, setCustomEmoji] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const myProfileRef = useRef<Profile | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url, created_at')
        .eq('id', user?.id ?? '')
        .maybeSingle();
      myProfileRef.current = (data as Profile) ?? null;
    })();
  }, [user?.id]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles!messages_sender_profile_fkey(nickname, avatar_url)')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) {
      console.error('[ChatRoom] 메시지 조회 실패:', error.message, error.details, error.hint);
      setError('메시지를 불러올 수 없습니다.');
    } else {
      setMessages((data ?? []) as unknown as ChatMessage[]);
      setError(null);
    }
    setLoading(false);
    setTimeout(scrollToBottom, 50);
  }, [room.id]);

  const loadMemberCount = useCallback(async () => {
    const { count } = await supabase
      .from('room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id);
    setMemberCount(count ?? 0);
  }, [room.id]);

  const loadMyRole = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_room_role', {
      p_room_id: room.id,
    });
    if (error) {
      console.error('[ChatRoom] 내 역할 조회 실패:', error.message);
      setMyRole('none');
    } else {
      setMyRole((data as MemberRole) ?? 'none');
    }
  }, [room.id]);

  const loadReactions = useCallback(async () => {
    const idsRes = await supabase
      .from('messages')
      .select('id')
      .eq('room_id', room.id)
      .limit(200);
    if (idsRes.error || (idsRes.data ?? []).length === 0) {
      setReactions({});
      return;
    }
    const ids = (idsRes.data ?? []).map((r) => r.id);
    const [allRes, mineRes] = await Promise.all([
      supabase
        .from('message_reactions')
        .select('message_id, emoji, user_id')
        .in('message_id', ids),
      supabase
        .from('message_reactions')
        .select('message_id, emoji')
        .in('message_id', ids)
        .eq('user_id', user?.id ?? ''),
    ]);
    if (allRes.error) {
      console.error('[ChatRoom] 리액션 조회 실패:', allRes.error.message);
      return;
    }
    const mineSet = new Set(
      (mineRes.data ?? []).map((r) => `${r.message_id}|${r.emoji}`)
    );
    const grouped: Record<string, Reaction[]> = {};
    for (const row of allRes.data ?? []) {
      const key = row.message_id;
      if (!grouped[key]) grouped[key] = [];
      const existing = grouped[key].find((r) => r.emoji === row.emoji);
      if (existing) {
        existing.count += 1;
      } else {
        grouped[key].push({ emoji: row.emoji, count: 1, mine: false });
      }
    }
    for (const list of Object.values(grouped)) {
      for (const r of list) {
        r.mine = mineSet.has(`${r.emoji}|${list.indexOf(r)}`) || mineSet.has(`${r.emoji}`);
      }
    }
    setReactions(grouped);
  }, [room.id, user?.id]);

  useEffect(() => {
    loadMessages();
    loadMemberCount();
    loadMyRole();
    loadReactions();
  }, [loadMessages, loadMemberCount, loadMyRole, loadReactions]);

  useEffect(() => {
    const channel = supabase
      .channel(`room-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${room.id}`,
        },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          const newRow = payload.new as Message;
          (async () => {
            let senderProfile: Profile | null = null;
            if (newRow.sender_id === user?.id) {
              senderProfile = myProfileRef.current;
            } else {
              const { data, error: profileError } = await supabase
                .from('profiles')
                .select('nickname, avatar_url')
                .eq('id', newRow.sender_id)
                .maybeSingle();
              if (profileError) {
                console.error('[ChatRoom] 프로필 조회 실패:', profileError.message);
              }
              senderProfile = (data as Profile) ?? null;
            }
            setMessages((prev) => {
              if (prev.some((m) => m.id === newRow.id)) return prev;
              return [...prev, { ...newRow, profiles: senderProfile }];
            });
            setTimeout(scrollToBottom, 50);
          })();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          loadMemberCount();
          loadMyRole();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        () => {
          loadReactions();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[ChatRoom] 실시간 연결 실패:', status);
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, loadMemberCount, loadReactions, user?.id]);

  const sendText = async () => {
    const text = input.trim();
    if (!text || !user) return;
    setInput('');
    const { data, error } = await supabase
      .from('messages')
      .insert({ room_id: room.id, content: text })
      .select('*, profiles!messages_sender_profile_fkey(nickname, avatar_url)')
      .single();
    if (error) {
      console.error('[ChatRoom] 메시지 전송 실패:', error.message, error.details, error.hint);
      setError('메시지 전송에 실패했습니다.');
      setInput(text);
      return;
    }
    const saved = data as unknown as ChatMessage;
    setMessages((prev) => {
      if (prev.some((m) => m.id === saved.id)) return prev;
      return [...prev, saved];
    });
    setTimeout(scrollToBottom, 50);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    setPickerFor(null);
    const existing = (reactions[messageId] ?? []).find((r) => r.emoji === emoji);
    if (existing?.mine) {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user?.id ?? '')
        .eq('emoji', emoji);
      if (error) {
        console.error('[ChatRoom] 리액션 취소 실패:', error.message, error.details, error.hint);
      }
      return;
    }
    const { error } = await supabase
      .from('message_reactions')
      .insert({ message_id: messageId, emoji });
    if (error) {
      console.error('[ChatRoom] 리액션 등록 실패:', error.message, error.details, error.hint);
    }
  };

  const submitCustomEmoji = (messageId: string) => {
    const emoji = customEmoji.trim();
    setCustomEmoji('');
    if (!emoji) return;
    toggleReaction(messageId, emoji);
  };

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setSendingImage(true);
    setError(null);
    try {
      const url = await uploadToBucket(file, 'room-images');
      const { data, error } = await supabase
        .from('messages')
        .insert({ room_id: room.id, image_url: url })
        .select('*, profiles!messages_sender_profile_fkey(nickname, avatar_url)')
        .single();
      if (error) throw error;
      const saved = data as unknown as ChatMessage;
      setMessages((prev) => {
        if (prev.some((m) => m.id === saved.id)) return prev;
        return [...prev, saved];
      });
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      console.error('[ChatRoom] 이미지 전송 실패:', err);
      setError('이미지 전송에 실패했습니다.');
    } finally {
      setSendingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#F5F7FA]">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="text-gray-600 hover:text-gray-900 active:scale-90 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 text-sm truncate">{room.title}</h2>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Users className="w-3 h-3" /> {memberCount}명
          </p>
        </div>
        <button
          onClick={() => setShowParticipants(true)}
          className="h-9 px-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold active:scale-95 transition flex items-center gap-1.5 shrink-0"
        >
          <Users className="w-4 h-4" />
          참여자
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            첫 메시지를 보내보세요!
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((msg, idx) => {
              const mine = msg.sender_id === user?.id;
              const showDateBadge =
                idx === 0 || dateKey(messages[idx - 1].created_at) !== dateKey(msg.created_at);
              return (
                <li key={msg.id}>
                  {showDateBadge && (
                    <div className="flex justify-center my-4">
                      <span className="bg-gray-200/80 text-gray-500 text-[11px] font-semibold rounded-full px-3.5 py-1">
                        {formatDateBadge(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <div
                    className={`flex flex-col ${mine ? 'items-end' : 'items-start'} relative group`}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setPickerFor(msg.id);
                    }}
                  >
                    <div
                      className="contents"
                      onTouchStart={(e) => {
                        const target = e.currentTarget as HTMLElement;
                        target.dataset.longPress = 'pending';
                        window.setTimeout(() => {
                          if (target.dataset.longPress === 'pending') {
                            target.dataset.longPress = 'fired';
                            setPickerFor(msg.id);
                          }
                        }, 500);
                      }}
                      onTouchEnd={(e) => {
                        const target = e.currentTarget as HTMLElement;
                        if (target.dataset.longPress === 'pending') {
                          target.dataset.longPress = 'done';
                        }
                      }}
                      onTouchMove={(e) => {
                        const target = e.currentTarget as HTMLElement;
                        target.dataset.longPress = 'done';
                      }}
                    >
                      {mine ? (
                        <MineMessage msg={msg} />
                      ) : (
                        <OtherMessage msg={msg} />
                      )}
                    </div>
                    <button
                      onClick={() => setPickerFor(pickerFor === msg.id ? null : msg.id)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 text-xs shrink-0 transition mt-0.5"
                      aria-label="공감 추가"
                    >
                      😊
                    </button>
                  </div>
                  {pickerFor === msg.id && (
                    <div
                      className={`absolute z-30 mt-1 ${mine ? 'right-2' : 'left-2'} bg-white border border-gray-200 rounded-full shadow-lg px-2 py-1.5 flex items-center gap-1`}
                    >
                      {REACTION_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(msg.id, emoji)}
                          className="w-7 h-7 rounded-full hover:bg-gray-100 active:scale-90 text-base leading-none transition"
                        >
                          {emoji}
                        </button>
                      ))}
                      <span className="w-px h-5 bg-gray-200 mx-0.5" />
                      <input
                        type="text"
                        value={customEmoji}
                        onChange={(e) => setCustomEmoji(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            submitCustomEmoji(msg.id);
                          }
                        }}
                        placeholder="직접 입력"
                        maxLength={4}
                        className="w-16 h-7 px-2 rounded-full bg-gray-100 text-xs outline-none focus:ring-1 focus:ring-[#3B75E4] text-gray-900 placeholder:text-gray-400"
                      />
                    </div>
                  )}
                  {(reactions[msg.id] ?? []).length > 0 && (
                    <div className={`relative z-10 flex flex-wrap gap-1 mt-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                      {(reactions[msg.id] ?? []).map((r) => (
                        <button
                          key={r.emoji}
                          onClick={() => toggleReaction(msg.id, r.emoji)}
                          className={`inline-flex items-center gap-0.5 text-xs rounded-full px-1.5 py-0.5 border transition active:scale-90 ${
                            r.mine
                              ? 'bg-[#3B75E4]/10 border-[#3B75E4]/40'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-sm leading-none">{r.emoji}</span>
                          <span className={`text-[10px] font-semibold ${r.mine ? 'text-[#3B75E4]' : 'text-gray-500'}`}>
                            {r.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreview(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-200"
            >
              <X className="w-6 h-6" />
            </button>
            <img src={preview} alt="" className="max-w-full max-h-[80vh] rounded-xl object-contain" />
          </div>
        </div>
      )}

      {showParticipants && (
        <ParticipantsModal
          room={room}
          myRole={myRole}
          onClose={() => setShowParticipants(false)}
          onRoomUpdated={onRoomUpdated}
          onKicked={onBack}
          onRoomDeleted={onBack}
        />
      )}

      {error && (
        <div className="px-4 pb-1">
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        </div>
      )}

      <footer className="bg-white border-t border-gray-100 px-3 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={sendingImage}
            className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 active:scale-90 transition disabled:opacity-50 shrink-0"
            aria-label="이미지 전송"
          >
            {sendingImage ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ImageIcon className="w-5 h-5" />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelected}
            className="hidden"
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendText();
              }
            }}
            placeholder="메시지 입력"
            className="flex-1 h-10 px-4 rounded-full bg-gray-100 border border-transparent focus:bg-white focus:border-[#3B75E4] outline-none transition text-sm text-gray-900"
          />
          <button
            onClick={sendText}
            disabled={!input.trim()}
            className="w-10 h-10 rounded-full bg-[#3B75E4] hover:bg-[#3366CC] text-white flex items-center justify-center active:scale-90 transition disabled:opacity-30 shrink-0"
            aria-label="보내기"
          >
            <Send className="w-4.5 h-4.5" />
          </button>
        </div>
      </footer>
    </div>
  );
}

function OtherMessage({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex items-end gap-2 max-w-[80%]">
      {msg.profiles?.avatar_url ? (
        <img
          src={msg.profiles.avatar_url}
          alt=""
          className="w-8 h-8 rounded-full object-cover self-start"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-[#3B75E4]/15 text-[#3B75E4] flex items-center justify-center text-xs font-bold self-start">
          {(msg.profiles?.nickname ?? '?').charAt(0)}
        </div>
      )}
      <div>
        <p className="text-xs text-gray-500 mb-1">{msg.profiles?.nickname ?? '알 수 없음'}</p>
        {msg.image_url && (
          <img
            src={msg.image_url}
            alt=""
            onClick={() => window.open(msg.image_url!, '_blank')}
            className="max-w-[220px] rounded-2xl rounded-tl-md cursor-pointer hover:opacity-90 transition"
          />
        )}
        {msg.content && (
          <div className="bg-white rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm text-gray-900 shadow-sm">
            {msg.content}
          </div>
        )}
      </div>
    </div>
  );
}

function MineMessage({ msg }: { msg: ChatMessage }) {
  return (
    <div className="max-w-[80%]">
      {msg.image_url && (
        <img
          src={msg.image_url}
          alt=""
          onClick={() => window.open(msg.image_url!, '_blank')}
          className="max-w-[220px] rounded-2xl rounded-tr-md cursor-pointer hover:opacity-90 transition ml-auto"
        />
      )}
      {msg.content && (
        <div className="bg-[#3B75E4] rounded-2xl rounded-tr-md px-3.5 py-2.5 text-sm text-white shadow-sm">
          {msg.content}
        </div>
      )}
    </div>
  );
}
