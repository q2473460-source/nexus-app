import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Room } from '@/lib/supabase';
import AuthScreen from '@/components/AuthScreen';
import ChatRoom from '@/components/ChatRoom';
import ProfileTab from '@/components/ProfileTab';
import DiscoverTab from '@/components/DiscoverTab';
import JoinPasswordModal from '@/components/JoinPasswordModal';
import ChatsTab from '@/components/ChatsTab';
import { MessageCircle, Search, User, Loader2 } from 'lucide-react';

type Tab = 'chats' | 'discover' | 'profile';

export default function App() {
  const { session, profile, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('chats');
  const [openRoom, setOpenRoom] = useState<Room | null>(null);
  const [passwordRoom, setPasswordRoom] = useState<Room | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
        <Loader2 className="w-8 h-8 animate-spin text-[#3B75E4]" />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  const handleJoined = (room: Room) => {
    setOpenRoom(room);
    setTab('chats');
  };

  const handleRoomClick = async (room: Room) => {
    if (!room.password) {
      setOpenRoom(room);
      return;
    }
    // Secret rooms: skip the password prompt when already a member (joined once).
    const { data, error } = await supabase.rpc('is_room_member', {
      p_room_id: room.id,
    });
    if (error) {
      console.error('[App] 멤버 확인 실패:', error.message);
      setPasswordRoom(room);
      return;
    }
    if (data) {
      setOpenRoom(room);
    } else {
      setPasswordRoom(room);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] max-w-md mx-auto relative shadow-xl min-h-screen">
      <header className="bg-white border-b border-gray-100 px-5 pt-5 pb-3 sticky top-0 z-10">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
          {tab === 'chats' && '내 채팅'}
          {tab === 'discover' && '오픈채팅 찾기'}
          {tab === 'profile' && '내 프로필'}
        </h1>
      </header>

      <main className="max-w-md mx-auto">
        {tab === 'chats' && <ChatsTab onOpenRoom={handleRoomClick} onJoined={handleJoined} />}
        {tab === 'discover' && <DiscoverTab onOpenRoom={handleRoomClick} onJoined={handleJoined} />}
        {tab === 'profile' && <ProfileTab onOpenRoom={handleRoomClick} />}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 flex z-20">
        <TabButton active={tab === 'chats'} onClick={() => setTab('chats')} icon={<MessageCircle className="w-5 h-5" />} label="내 채팅" />
        <TabButton active={tab === 'discover'} onClick={() => setTab('discover')} icon={<Search className="w-5 h-5" />} label="오픈채팅 찾기" />
        <TabButton active={tab === 'profile'} onClick={() => setTab('profile')} icon={<User className="w-5 h-5" />} label="내 프로필" />
      </nav>

      {openRoom && (
        <ChatRoom
          room={openRoom}
          onBack={() => setOpenRoom(null)}
          onRoomUpdated={(updated) => setOpenRoom(updated)}
        />
      )}

      {passwordRoom && (
        <JoinPasswordModal
          room={passwordRoom}
          onClose={() => setPasswordRoom(null)}
          onJoined={(room) => {
            setPasswordRoom(null);
            setOpenRoom(room);
          }}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition ${
        active ? 'text-[#3B75E4]' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
