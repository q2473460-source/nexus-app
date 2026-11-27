import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type Room, type Message } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { MessageCircle, Loader2, Lock, Search, Users } from 'lucide-react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type RoomWithMeta = Room & {
  last_message: string | null;
  last_message_at: string | null;
  member_count: number;
};

export default function ChatsTab({
  onOpenRoom,
  onJoined,
}: {
  onOpenRoom: (room: Room) => void;
  onJoined: (room: Room) => void;
}) {
  const { user } = useAuth();
  const [myRooms, setMyRooms] = useState<RoomWithMeta[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  const loadMyRooms = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) {
      setLoading(false);
      return;
    }
    const { data: memberRows } = await supabase
      .from('room_members')
      .select('rooms(*)')
      .eq('user_id', uid);
    const rooms = (memberRows ?? [])
      .map((row) => row.rooms as unknown as Room)
      .filter(Boolean);

    const enriched: RoomWithMeta[] = await Promise.all(
      rooms.map(async (room) => {
        const [msgRes, countRes] = await Promise.all([
          supabase
            .from('messages')
            .select('content, image_url, created_at')
            .eq('room_id', room.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('room_members')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', room.id),
        ]);
        const last = msgRes.data as Pick<Message, 'content' | 'image_url' | 'created_at'> | null;
        return {
          ...room,
          last_message: last?.image_url ? '사진' : (last?.content ?? null),
          last_message_at: last?.created_at ?? null,
          member_count: countRes.count ?? 0,
        };
      })
    );

    enriched.sort((a, b) => {
      const ta = a.last_message_at ?? a.created_at;
      const tb = b.last_message_at ?? b.created_at;
      return tb < ta ? -1 : tb > ta ? 1 : 0;
    });
    setMyRooms(enriched);
    setJoinedIds(new Set(rooms.map((r) => r.id)));
    setLoading(false);
  }, []);

  const loadAllRooms = useCallback(async () => {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false });
    setAllRooms((data ?? []) as Room[]);
  }, []);

  useEffect(() => {
    loadMyRooms();
    loadAllRooms();
  }, [loadMyRooms, loadAllRooms, user?.id]);

  useEffect(() => {
    const uid = userIdRef.current;
    if (!uid) return;
    const channel = supabase
      .channel(`my-chats-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => loadMyRooms()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_members' },
        () => {
          loadMyRooms();
          loadAllRooms();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        (_payload: RealtimePostgresChangesPayload<Room>) => loadAllRooms()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMyRooms, loadAllRooms]);

  const searchResults = query.trim()
    ? allRooms.filter(
        (room) =>
          room.title.toLowerCase().includes(query.toLowerCase()) ||
          (room.description ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <div className="pb-20">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 z-10 px-5 pt-3 pb-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="채팅방 검색 (전체 방에서 검색)"
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-gray-100 border border-transparent focus:bg-white focus:border-[#3B75E4] outline-none transition text-sm text-gray-900 placeholder:text-gray-400"
          />
        </div>
      </div>

      <div className="px-5 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : query.trim() ? (
          searchResults.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              검색 결과가 없습니다.
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">
                전체 검색 결과 ({searchResults.length})
              </p>
              <ul className="space-y-2.5">
                {searchResults.map((room) => (
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
            </div>
          )
        ) : myRooms.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p>참여한 채팅방이 없습니다.</p>
            <p className="mt-1 text-xs">검색창에 방 이름을 입력해 참여할 방을 찾아보세요.</p>
          </div>
        ) : (
          <ul>
            {myRooms.map((room) => (
              <li key={room.id}>
                <button
                  onClick={() => onOpenRoom(room)}
                  className="w-full flex items-center gap-3.5 px-2 py-3.5 rounded-2xl hover:bg-white active:bg-gray-100 transition text-left"
                >
                  {room.cover_url ? (
                    <img
                      src={room.cover_url}
                      alt=""
                      className="w-14 h-14 rounded-2xl object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-[#3B75E4]/10 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-6 h-6 text-[#3B75E4]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                      {room.password && <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      <span className="truncate">{room.title}</span>
                    </p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {room.last_message ?? '아직 메시지가 없습니다'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-gray-400 flex items-center justify-end gap-0.5">
                      <Users className="w-3 h-3" />
                      {room.member_count}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
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
