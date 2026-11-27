import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type Room } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Search, Plus, Users, Loader2, Lock, MessageCircle } from 'lucide-react';
import CreateRoomModal from '@/components/CreateRoomModal';

export default function DiscoverTab({
  onOpenRoom,
  onJoined,
}: {
  onOpenRoom: (room: Room) => void;
  onJoined: (room: Room) => void;
}) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  const loadData = useCallback(async () => {
    const uid = userIdRef.current;
    const [roomsRes, membersRes] = await Promise.all([
      supabase.from('rooms').select('*').order('created_at', { ascending: false }),
      uid
        ? supabase.from('room_members').select('room_id').eq('user_id', uid)
        : Promise.resolve({ data: [] as { room_id: string }[] }),
    ]);
    setRooms((roomsRes.data ?? []) as Room[]);
    setJoinedIds(new Set((membersRes.data ?? []).map((m) => m.room_id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, user?.id]);

  useEffect(() => {
    const channel = supabase
      .channel('rooms-discover')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        (_payload: RealtimePostgresChangesPayload<Room>) => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_members' },
        () => {
          loadData();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const filtered = query.trim()
    ? rooms.filter(
        (room) =>
          room.title.toLowerCase().includes(query.toLowerCase()) ||
          (room.description ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : rooms.filter((room) => joinedIds.has(room.id));

  return (
    <div className="pb-20">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 z-10 px-5 pt-5 pb-3">
        <h2 className="text-xl font-extrabold text-gray-900 mb-3">오픈채팅 찾기</h2>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="방 이름이나 설명으로 검색"
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-gray-100 border border-transparent focus:bg-white focus:border-[#3B75E4] outline-none transition text-sm text-gray-900 placeholder:text-gray-400"
          />
        </div>
      </div>

      <div className="px-5 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            {query ? '검색 결과가 없습니다.' : '아직 참여한 채팅방이 없습니다. 검색어를 입력해 다른 방을 찾아보세요!'}
          </div>
        ) : (
          <ul className="space-y-2.5">
            {filtered.map((room) => (
              <li
                key={room.id}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {room.cover_url ? (
                    <img src={room.cover_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#3B75E4]/10 flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-[#3B75E4]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5 truncate">
                      {room.password && <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      <span className="truncate">{room.title}</span>
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {room.description || '설명 없는 채팅방'}
                    </p>
                  </div>
                  {joinedIds.has(room.id) ? (
                    <button
                      onClick={() => onOpenRoom(room)}
                      className="h-9 px-4 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 active:scale-95 transition shrink-0"
                    >
                      입장
                    </button>
                  ) : (
                    <JoinButton room={room} onJoined={onJoined} onOpenRoom={onOpenRoom} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-2xl bg-[#3B75E4] text-white shadow-lg shadow-blue-500/30 flex items-center justify-center hover:bg-[#3366CC] active:scale-90 transition z-20"
        aria-label="채팅방 만들기"
      >
        <Plus className="w-6 h-6" />
      </button>

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreated={(room) => {
            setShowCreate(false);
            onJoined(room);
          }}
        />
      )}
    </div>
  );
}

function JoinButton({
  room,
  onJoined,
  onOpenRoom,
}: {
  room: Room;
  onJoined: (room: Room) => void;
  onOpenRoom: (room: Room) => void;
}) {
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (room.password) {
      onOpenRoom(room);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('room_members').insert({ room_id: room.id });
    setBusy(false);
    if (!error) onJoined(room);
  };

  return (
    <button
      onClick={join}
      disabled={busy}
      className="h-9 px-4 rounded-lg bg-[#3B75E4] text-white text-xs font-semibold hover:bg-[#3366CC] active:scale-95 transition disabled:opacity-50 flex items-center gap-1.5 shrink-0"
    >
      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      참여하기
    </button>
  );
}
