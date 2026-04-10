import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Video, 
  Heart, 
  MessageCircle, 
  Send, 
  Plus, 
  User as UserIcon, 
  LogOut, 
  Globe,
  Image as ImageIcon,
  Users,
  Search,
  X,
  ChevronDown,
  Loader2,
  Mic,
  Paperclip,
  Phone,
  PhoneOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Post, User, TranslationStrings, initialTranslations, allLanguages, ChatRoom } from './types';
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const getYouTubeEmbedUrl = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
};

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [lang, setLang] = useState<string>('sk');
  const [allTranslations, setAllTranslations] = useState<Record<string, TranslationStrings>>(initialTranslations);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'image' | 'video'>('image');
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [feedFilter, setFeedFilter] = useState<'trending' | 'latest'>('trending');
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editTheme, setEditTheme] = useState<'light' | 'dark'>('light');
  const [editColor, setEditColor] = useState('#a855f7');
  
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [activeChat, setActiveChat] = useState<ChatRoom | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const [activeCall, setActiveCall] = useState<any>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const t = allTranslations[lang] || allTranslations['en'];

  useEffect(() => {
    // Apply theme and color
    if (user) {
      const isDark = user.theme === 'dark';
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      const color = user.primaryColor || '#a855f7';
      document.documentElement.style.setProperty('--primary-color', color);
      // Generate hover and light variants (simplified)
      document.documentElement.style.setProperty('--primary-color-hover', color + 'dd');
      document.documentElement.style.setProperty('--primary-color-light', color + '22');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.setProperty('--primary-color', '#a855f7');
      document.documentElement.style.setProperty('--primary-color-hover', '#9333ea');
      document.documentElement.style.setProperty('--primary-color-light', '#faf5ff');
    }
  }, [user?.theme, user?.primaryColor]);

  // Polling for new messages, posts, and incoming calls
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPosts();
      if (user) {
        fetchChats(user.id);
        fetchRequests(user.id);
        fetchFriends(user.id);
        checkIncomingCalls(user.id);
        if (activeCall && activeCall.status === 'ringing') {
          checkCallStatus(activeCall.id);
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [user?.id, activeCall, incomingCall]);

  const checkIncomingCalls = async (userId: string) => {
    if (activeCall || incomingCall) return;
    try {
      const res = await fetch(`/api/calls/incoming/${userId}`);
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const call = await res.json();
          if (call) setIncomingCall(call);
        } else {
          const text = await res.text();
          console.error(`checkIncomingCalls: Expected JSON but got ${contentType}. Body: ${text.substring(0, 100)}...`);
        }
      } else {
        console.error(`checkIncomingCalls: Server returned ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.error("Failed to check incoming calls", err);
    }
  };

  const checkCallStatus = async (callId: string) => {
    try {
      const res = await fetch(`/api/calls/${callId}`);
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const call = await res.json();
          if (call.status === 'accepted') {
            setActiveCall(call);
            setIsCalling(false);
          } else if (call.status === 'declined' || call.status === 'ended') {
            setActiveCall(null);
            setIsCalling(false);
          }
        } else {
          const text = await res.text();
          console.error(`checkCallStatus: Expected JSON but got ${contentType}. Body: ${text.substring(0, 100)}...`);
        }
      } else {
        console.error(`checkCallStatus: Server returned ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.error("Failed to check call status", err);
    }
  };

  const startCall = async (type: 'audio' | 'video') => {
    if (!user || !activeChat || activeChat.id === 'global_chat') return;
    const toUserId = activeChat.participants.find(id => id !== user.id);
    if (!toUserId) return;

    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: user.id,
          toUserId,
          type,
          roomId: activeChat.id
        })
      });
      if (res.ok) {
        const call = await res.json();
        setActiveCall(call);
        setIsCalling(true);
      }
    } catch (err) {
      console.error("Failed to start call", err);
    }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    try {
      const res = await fetch(`/api/calls/${incomingCall.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' })
      });
      if (res.ok) {
        const call = await res.json();
        setActiveCall(call);
        setIncomingCall(null);
      }
    } catch (err) {
      console.error("Failed to answer call", err);
    }
  };

  const declineCall = async () => {
    if (!incomingCall) return;
    try {
      await fetch(`/api/calls/${incomingCall.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'declined' })
      });
      setIncomingCall(null);
    } catch (err) {
      console.error("Failed to decline call", err);
    }
  };

  const endCall = async () => {
    if (!activeCall) return;
    try {
      await fetch(`/api/calls/${activeCall.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ended' })
      });
      setActiveCall(null);
      setIsCalling(false);
    } catch (err) {
      console.error("Failed to end call", err);
    }
  };

  const fetchChats = async (userId: string) => {
    try {
      const res = await fetch(`/api/chats/${userId}`);
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          setChatRooms(data);
        } else {
          const text = await res.text();
          console.error(`fetchChats: Expected JSON but got ${contentType}. Body: ${text.substring(0, 100)}...`);
        }
      } else {
        console.error(`fetchChats: Server returned ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.error("Failed to fetch chats", err);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/users/search?q=${query}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error("Search failed", err);
    }
  };

  const fetchFriends = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}/friends`);
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          setFriends(Array.isArray(data) ? data : []);
        } else {
          const text = await res.text();
          console.error(`fetchFriends: Expected JSON but got ${contentType}. Body: ${text.substring(0, 100)}...`);
        }
      } else {
        console.error(`fetchFriends: Server returned ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.error("Failed to fetch friends", err);
    }
  };

  const fetchRequests = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}/requests`);
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          setFriendRequests(Array.isArray(data) ? data : []);
        } else {
          const text = await res.text();
          console.error(`fetchRequests: Expected JSON but got ${contentType}. Body: ${text.substring(0, 100)}...`);
        }
      } else {
        console.error(`fetchRequests: Server returned ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.error("Failed to fetch requests", err);
    }
  };

  const handleRequestFriend = async (toUserId: string) => {
    if (!user) return;
    try {
      await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUserId: user.id, toUserId })
      });
      alert(t.requestSent);
    } catch (err) {
      console.error("Friend request failed", err);
    }
  };

  const handleAcceptRequest = async (friendId: string) => {
    if (!user) return;
    try {
      await fetch('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, friendId })
      });
      fetchFriends(user.id);
      fetchRequests(user.id);
    } catch (err) {
      console.error("Accept failed", err);
    }
  };

  const handleDeclineRequest = async (friendId: string) => {
    if (!user) return;
    try {
      await fetch('/api/friends/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, friendId })
      });
      fetchRequests(user.id);
    } catch (err) {
      console.error("Decline failed", err);
    }
  };

  useEffect(() => {
    if (viewingUser) {
      fetchUserPosts(viewingUser.id);
    }
  }, [viewingUser]);

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/posts');
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          setPosts(data);
        } else {
          const text = await res.text();
          console.error(`fetchPosts: Expected JSON but got ${contentType}. Body: ${text.substring(0, 100)}...`);
        }
      } else {
        console.error(`fetchPosts: Server returned ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.error("Failed to fetch posts", err);
    }
  };

  const fetchUserPosts = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}/posts`);
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          setUserPosts(data);
        } else {
          const text = await res.text();
          console.error(`fetchUserPosts: Expected JSON but got ${contentType}. Body: ${text.substring(0, 100)}...`);
        }
      } else {
        console.error(`fetchUserPosts: Server returned ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.error("Failed to fetch user posts", err);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Auto-detect type
    if (file.type.startsWith('video/')) {
      setUploadType('video');
    } else if (file.type.startsWith('image/')) {
      setUploadType('image');
    }

    setIsUploadingFile(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadUrl(reader.result as string);
      setIsUploadingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, avatar: editAvatar })
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        setIsSettingsOpen(false);
        fetchPosts();
      }
    } catch (err) {
      console.error("Update failed", err);
    }
  };

  const openSettings = () => {
    if (!user) return;
    setEditName(user.name);
    setEditAvatar(user.avatar);
    setEditPassword(user.password || '');
    setEditTheme(user.theme || 'light');
    setEditColor(user.primaryColor || '#a855f7');
    setIsSettingsOpen(true);
    setViewingUser(null);
    setIsChatOpen(false);
    setIsFriendsOpen(false);
  };

  const goHome = () => {
    setViewingUser(null);
    setIsChatOpen(false);
    setIsSettingsOpen(false);
    setIsFriendsOpen(false);
    setIsUploadOpen(false);
    setIsMobileMenuOpen(false);
    const scrollContainer = document.querySelector('.flex-1.flex.flex-col.h-screen.overflow-y-auto');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const res = await fetch(`/api/users/${user.id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: editName,
          avatar: editAvatar,
          theme: editTheme, 
          primaryColor: editColor, 
          password: editPassword 
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        setIsSettingsOpen(false);
      }
    } catch (err) {
      console.error("Settings update failed", err);
    }
  };

  const startChat = async (targetUserId: string) => {
    if (!user) return;
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants: [user.id, targetUserId], isGroup: false })
      });
      if (res.ok) {
        const room = await res.json();
        setActiveChat(room);
        setIsChatOpen(true);
        fetchChats(user.id);
      }
    } catch (err) {
      console.error("Failed to start chat", err);
    }
  };

  const sendMessage = async (e: React.FormEvent, mediaType: 'text' | 'image' | 'video' | 'audio' = 'text', mediaUrl?: string) => {
    if (e) e.preventDefault();
    const textToSend = mediaType === 'audio' ? '' : messageText;
    if (!user || !activeChat || (!textToSend.trim() && !mediaUrl)) return;
    try {
      const res = await fetch(`/api/chats/${activeChat.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          senderId: user.id, 
          text: textToSend,
          type: mediaType,
          url: mediaUrl
        })
      });
      if (res.ok) {
        if (mediaType !== 'audio') setMessageText('');
        fetchChats(user.id);
        // Refresh active chat
        const updatedRes = await fetch(`/api/chats/${user.id}`);
        const rooms = await updatedRes.json();
        const updatedRoom = rooms.find((r: any) => r.id === activeChat.id);
        if (updatedRoom) setActiveChat(updatedRoom);
      }
    } catch (err) {
      console.error("Send message failed", err);
    }
  };

  const startRecording = async () => {
    setChatError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      setChatError("Váš prehliadač nepodporuje nahrávanie zvuku.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          sendMessage(null as any, 'audio', base64data);
        };
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err: any) {
      console.error("Failed to start recording", err);
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setChatError("Nenašiel sa mikrofón. Skontrolujte pripojenie zariadenia.");
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setChatError("Prístup k mikrofónu bol zamietnutý. Skúste otvoriť aplikáciu v novej karte.");
      } else {
        setChatError("Chyba nahrávania: " + err.message);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const handleChatFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type.startsWith('image/') ? 'image' : 'video';
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64data = reader.result as string;
      sendMessage(null as any, type, base64data);
    };
  };

  const viewUserProfile = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`);
      if (res.ok) {
        const userData = await res.json();
        setViewingUser(userData);
      }
    } catch (err) {
      console.error("Failed to fetch user", err);
    }
  };

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupName || selectedFriends.length === 0) return;
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          participants: [user.id, ...selectedFriends], 
          name: groupName, 
          isGroup: true 
        })
      });
      if (res.ok) {
        const room = await res.json();
        setActiveChat(room);
        setIsCreateGroupOpen(false);
        setGroupName('');
        setSelectedFriends([]);
        fetchChats(user.id);
      }
    } catch (err) {
      console.error("Failed to create group", err);
    }
  };

  const translateUI = async (targetLang: string, customName?: string) => {
    if (allTranslations[targetLang] && !customName) {
      setLang(targetLang);
      setIsLangOpen(false);
      return;
    }

    setIsTranslating(true);
    try {
      const langName = customName || allLanguages.find(l => l.code === targetLang)?.name || targetLang;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Translate the following UI strings to ${langName}. Return ONLY a JSON object.
        Strings: ${JSON.stringify(initialTranslations.en)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              feed: { type: Type.STRING },
              friends: { type: Type.STRING },
              profile: { type: Type.STRING },
              post: { type: Type.STRING },
              comment: { type: Type.STRING },
              addComment: { type: Type.STRING },
              upload: { type: Type.STRING },
              photo: { type: Type.STRING },
              video: { type: Type.STRING },
              caption: { type: Type.STRING },
              login: { type: Type.STRING },
              logout: { type: Type.STRING },
              language: { type: Type.STRING },
              addFriend: { type: Type.STRING },
              friendsList: { type: Type.STRING },
              searchLanguage: { type: Type.STRING },
              selectLanguage: { type: Type.STRING },
              settings: { type: Type.STRING },
              editProfile: { type: Type.STRING },
              save: { type: Type.STRING },
              cancel: { type: Type.STRING },
              name: { type: Type.STRING },
              profilePhoto: { type: Type.STRING },
              myPosts: { type: Type.STRING },
              chooseFile: { type: Type.STRING },
              noPosts: { type: Type.STRING },
              friendRequests: { type: Type.STRING },
              accept: { type: Type.STRING },
              decline: { type: Type.STRING },
              noRequests: { type: Type.STRING },
              alreadyFriends: { type: Type.STRING },
              requestSent: { type: Type.STRING },
              password: { type: Type.STRING },
              changePassword: { type: Type.STRING },
              darkMode: { type: Type.STRING },
              themeColor: { type: Type.STRING },
              chat: { type: Type.STRING },
              messages: { type: Type.STRING },
              sendMessage: { type: Type.STRING },
              createGroup: { type: Type.STRING },
              groupName: { type: Type.STRING },
              searchUsers: { type: Type.STRING },
              noUsersFound: { type: Type.STRING },
              call: { type: Type.STRING },
              videoCall: { type: Type.STRING },
              incomingCall: { type: Type.STRING },
              calling: { type: Type.STRING },
              endCall: { type: Type.STRING },
              answer: { type: Type.STRING },
              wantsToBeFriend: { type: Type.STRING },
            },
            required: [
              "feed", "friends", "profile", "post", "comment", "addComment", "upload", "photo", "video", "caption", 
              "login", "logout", "language", "addFriend", "friendsList", "searchLanguage", "selectLanguage",
              "settings", "editProfile", "save", "cancel", "name", "profilePhoto", "myPosts", "chooseFile", 
              "noPosts", "friendRequests", "accept", "decline", "noRequests", "alreadyFriends", "requestSent", 
              "password", "changePassword", "darkMode", "themeColor", "chat", "messages", "sendMessage", 
              "createGroup", "groupName", "searchUsers", "noUsersFound", "call", "videoCall", "incomingCall", 
              "calling", "endCall", "answer", "wantsToBeFriend"
            ]
          }
        }
      });

      const translated = JSON.parse(response.text);
      const code = customName ? customName.toLowerCase().slice(0, 2) : targetLang;
      setAllTranslations(prev => ({ ...prev, [code]: translated }));
      setLang(code);
    } catch (err) {
      console.error("Translation failed", err);
      alert("Translation failed. Please try again.");
    } finally {
      setIsTranslating(false);
      setIsLangOpen(false);
      setLangSearch('');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadUrl || !user) return;

    let finalType = uploadType;
    if (getYouTubeEmbedUrl(uploadUrl)) {
      finalType = 'video';
    }

    const newPost = {
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      type: finalType,
      url: uploadUrl,
      caption: uploadCaption
    };

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost)
      });
      if (res.ok) {
        fetchPosts();
        setIsUploadOpen(false);
        setUploadUrl('');
        setUploadCaption('');
      }
    } catch (err) {
      console.error("Upload failed", err);
    }
  };

  const handleComment = async (postId: string, text: string) => {
    if (!user || !text) return;
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          userAvatar: user.avatar,
          text
        })
      });
      if (res.ok) {
        fetchPosts();
      }
    } catch (err) {
      console.error("Comment failed", err);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchPosts();
      }
    } catch (err) {
      console.error("Like failed", err);
    }
  };

  const filteredLanguages = allLanguages.filter(l => 
    l.name.toLowerCase().includes(langSearch.toLowerCase()) || 
    l.code.toLowerCase().includes(langSearch.toLowerCase())
  );

  const [isLoginOpen, setIsLoginOpen] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login';
    const body = isSignUp 
      ? { email: loginEmail, name: loginName, password: loginPassword }
      : { email: loginEmail, password: loginPassword };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setIsLoginOpen(false);
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (err) {
      console.error("Auth failed", err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      {/* Left Sidebar Navigation */}
      <aside className="hidden lg:flex flex-col w-72 border-r border-border-custom h-screen sticky top-0 bg-card/50 backdrop-blur-xl z-50">
        <div className="p-8">
          <h1 
            onClick={goHome}
            className="text-4xl font-black tracking-tighter text-primary italic cursor-pointer hover:opacity-80 transition-opacity"
          >
            VIBE
          </h1>
        </div>
        
        <nav className="flex-1 px-6 space-y-3">
          <button 
            onClick={() => { setViewingUser(null); setIsSettingsOpen(false); setIsChatOpen(false); setIsFriendsOpen(false); }}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-[24px] transition-all group ${!viewingUser && !isSettingsOpen && !isChatOpen && !isFriendsOpen ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'hover:bg-primary/10 text-zinc-500 hover:text-primary'}`}
          >
            <Globe size={22} className="group-hover:scale-110 transition-transform" />
            <span className="font-bold text-base">{t.feed}</span>
          </button>
          
          <button 
            onClick={() => { if (user) viewUserProfile(user.id); setIsSettingsOpen(false); setIsChatOpen(false); setIsFriendsOpen(false); }}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-[24px] transition-all group ${viewingUser?.id === user?.id && !isSettingsOpen && !isChatOpen && !isFriendsOpen ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'hover:bg-primary/10 text-zinc-500 hover:text-primary'}`}
          >
            <UserIcon size={22} className="group-hover:scale-110 transition-transform" />
            <span className="font-bold text-base">{t.profile}</span>
          </button>

          <button 
            onClick={() => { setIsChatOpen(true); setViewingUser(null); setIsSettingsOpen(false); setIsFriendsOpen(false); }}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-[24px] transition-all group ${isChatOpen ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'hover:bg-primary/10 text-zinc-500 hover:text-primary'}`}
          >
            <MessageCircle size={22} className="group-hover:scale-110 transition-transform" />
            <span className="font-bold text-base">{t.chat}</span>
          </button>

          <button 
            onClick={() => { setIsFriendsOpen(true); setViewingUser(null); setIsChatOpen(false); setIsSettingsOpen(false); }}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-[24px] transition-all group ${isFriendsOpen ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'hover:bg-primary/10 text-zinc-500 hover:text-primary'}`}
          >
            <Users size={22} className="group-hover:scale-110 transition-transform" />
            <span className="font-bold text-base">{t.friends}</span>
          </button>
        </nav>

        <div className="p-6 border-t border-border-custom">
          {user ? (
            <div className="flex items-center gap-4 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-[30px] border border-border-custom">
              <img src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} className="w-12 h-12 rounded-full border-2 border-primary shadow-lg" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black truncate">{user.name}</p>
                <button onClick={() => setUser(null)} className="text-[11px] text-red-500 font-bold hover:underline">
                  {t.logout}
                </button>
              </div>
              <button onClick={openSettings} className="text-zinc-400 hover:text-primary transition-colors">
                <ChevronDown size={18} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsLoginOpen(true)}
              className="w-full bg-primary text-white py-4 rounded-[24px] font-black text-lg hover:bg-primary-hover transition-all hover:scale-[1.02] shadow-xl shadow-primary/20"
            >
              {t.login}
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/50">
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border-custom px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4 lg:hidden mr-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-zinc-500 hover:text-primary transition-colors"
            >
              <Plus size={24} className="rotate-45" />
            </button>
            <h1 
              onClick={goHome}
              className="text-2xl font-black tracking-tighter text-primary italic cursor-pointer hover:opacity-80 transition-opacity"
            >
              VIBE
            </h1>
          </div>
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-[20px] px-5 py-2.5 w-full max-w-xl relative group border border-transparent focus-within:border-primary/30 transition-all">
            <Search size={20} className="text-zinc-400 mr-3 group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder={t.searchUsers}
              className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none font-medium"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-card border border-border-custom rounded-[24px] shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                {searchResults.map(u => (
                  <button 
                    key={u.id}
                    onClick={() => { viewUserProfile(u.id); setSearchResults([]); setSearchQuery(''); }}
                    className="w-full flex items-center gap-4 p-4 hover:bg-primary/5 transition-colors border-b border-border-custom last:border-none"
                  >
                    <img src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`} className="w-10 h-10 rounded-full border border-border-custom" />
                    <div className="text-left">
                      <p className="text-sm font-bold">{u.name}</p>
                      <p className="text-[11px] text-zinc-400 font-medium">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-5">
            <button 
              onClick={() => setIsLangOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[20px] border border-border-custom hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all font-bold text-xs"
            >
              {isTranslating ? <Loader2 size={18} className="animate-spin text-primary" /> : <Globe size={18} className="text-zinc-500" />}
              <span className="uppercase tracking-wider">{lang}</span>
            </button>
            
            <button 
              onClick={() => setIsUploadOpen(true)}
              className="bg-primary text-white px-8 py-2.5 rounded-[20px] font-black text-sm hover:bg-primary-hover transition-all hover:scale-105 shadow-xl shadow-primary/20 flex items-center gap-2"
            >
              <Plus size={20} strokeWidth={3} />
              <span className="hidden sm:inline uppercase tracking-tight">{t.post}</span>
            </button>
          </div>
        </header>

      {/* Login Modal */}
      <AnimatePresence>
        {isLoginOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8"
            >
              <h2 className="text-2xl font-bold mb-6 text-center">{isSignUp ? 'Sign Up' : t.login}</h2>
              <form onSubmit={handleAuth} className="space-y-4">
                {isSignUp && (
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">{t.name}</label>
                    <input 
                      type="text" 
                      placeholder="Your Name" 
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                      value={loginName}
                      onChange={(e) => setLoginName(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Email</label>
                  <input 
                    type="email" 
                    placeholder="email@example.com" 
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">{t.password}</label>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-primary text-white py-4 rounded-2xl font-bold hover:bg-primary-hover transition-colors"
                >
                  {isSignUp ? 'Sign Up' : t.login}
                </button>
                <p className="text-center text-sm text-zinc-500">
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                  <button 
                    type="button" 
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="ml-2 text-primary font-bold hover:underline"
                  >
                    {isSignUp ? t.login : 'Sign Up'}
                  </button>
                </p>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {viewingUser ? (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Profile Header - Redesigned */}
              <div className="bg-card border border-border-custom rounded-[48px] p-10 md:p-16 flex flex-col md:flex-row items-center gap-12 relative overflow-hidden shadow-2xl shadow-primary/5">
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full -mr-48 -mt-48 blur-[100px]" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full -ml-32 -mb-32 blur-[80px]" />
                
                <div className="relative group">
                  <img src={viewingUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${viewingUser.id}`} className="w-48 h-48 rounded-[48px] border-8 border-primary-light shadow-2xl relative z-10 object-cover transition-transform group-hover:scale-105 duration-500" />
                  {user?.id === viewingUser.id && (
                    <button 
                      onClick={openSettings}
                      className="absolute -bottom-4 -right-4 bg-primary text-white p-4 rounded-[20px] shadow-xl border-4 border-card hover:scale-110 transition-all z-20"
                    >
                      <Camera size={24} strokeWidth={2.5} />
                    </button>
                  )}
                </div>

                <div className="flex-1 text-center md:text-left relative z-10">
                  <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                    <h2 className="text-5xl font-black tracking-tighter">{viewingUser.name}</h2>
                    {viewingUser.id !== user?.id && (
                      <div className="flex gap-2 justify-center md:justify-start">
                        <button 
                          onClick={() => handleRequestFriend(viewingUser.id)}
                          className={`px-6 py-2.5 rounded-[18px] font-black text-sm transition-all shadow-lg ${user?.friends?.includes(viewingUser.id) ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500' : 'bg-primary text-white hover:bg-primary-hover shadow-primary/20 hover:scale-105'}`}
                        >
                          {user?.friends?.includes(viewingUser.id) ? t.alreadyFriends : t.addFriend}
                        </button>
                        <button 
                          onClick={() => startChat(viewingUser.id)}
                          className="p-2.5 rounded-[18px] bg-primary-light text-primary hover:bg-primary hover:text-white transition-all shadow-lg shadow-primary/5"
                        >
                          <MessageCircle size={22} strokeWidth={2.5} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-zinc-400 font-bold text-lg mb-8 tracking-tight">{viewingUser.email}</p>
                  
                  <div className="flex flex-wrap justify-center md:justify-start gap-6">
                    <div className="bg-zinc-100/50 dark:bg-zinc-800/50 backdrop-blur-md px-8 py-4 rounded-[24px] border border-border-custom">
                      <p className="text-3xl font-black tracking-tighter text-primary">{userPosts.length}</p>
                      <p className="text-[10px] uppercase font-black tracking-widest text-zinc-400 mt-1">{t.myPosts}</p>
                    </div>
                    <div className="bg-zinc-100/50 dark:bg-zinc-800/50 backdrop-blur-md px-8 py-4 rounded-[24px] border border-border-custom">
                      <p className="text-3xl font-black tracking-tighter text-primary">{viewingUser.friends?.length || 0}</p>
                      <p className="text-[10px] uppercase font-black tracking-widest text-zinc-400 mt-1">{t.friends}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {userPosts.length === 0 ? (
                  <div className="col-span-full py-32 text-center bg-card rounded-[48px] border-2 border-dashed border-border-custom">
                    <ImageIcon size={64} className="mx-auto mb-6 opacity-10 text-primary" />
                    <p className="text-zinc-400 font-black text-xl tracking-tight">{t.noPosts}</p>
                  </div>
                ) : (
                  userPosts.map(post => (
                    <PostCard 
                      key={post.id} 
                      post={post} 
                      onComment={handleComment} 
                      onLike={handleLike}
                      t={t} 
                      onUserClick={viewUserProfile}
                      onAddFriend={handleRequestFriend}
                      onMessage={startChat}
                      currentUser={user}
                    />
                  ))
                )}
              </div>
            </div>
          ) : isFriendsOpen ? (
            <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <h2 className="text-5xl font-black tracking-tighter dark:text-white">{t.friends}</h2>
                <div className="bg-primary/10 text-primary px-6 py-2 rounded-full text-sm font-black tracking-tight">
                  {friends.length} {t.friends}
                </div>
              </div>

              {/* Friend Requests - Redesigned */}
              {friendRequests.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-[40px] p-10">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-8">{t.friendRequests}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {friendRequests.map(req => (
                      <div key={req.id} className="bg-card border border-border-custom p-5 rounded-[28px] flex items-center justify-between shadow-xl shadow-primary/5 hover:border-primary transition-all group">
                        <div className="flex items-center gap-4">
                          <img src={req.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.id}`} className="w-14 h-14 rounded-[20px] border-2 border-transparent group-hover:border-primary transition-all" />
                          <div>
                            <p className="text-base font-black tracking-tight">{req.name}</p>
                            <p className="text-[11px] text-zinc-400 font-bold uppercase">{t.wantsToBeFriend}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleDeclineRequest(req.id)} className="flex items-center gap-2 px-4 py-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-all rounded-[18px]">
                            <X size={22} strokeWidth={2.5} />
                            <span className="text-xs font-black uppercase">{t.decline}</span>
                          </button>
                          <button onClick={() => handleAcceptRequest(req.id)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-[18px] hover:bg-primary-hover transition-all shadow-lg shadow-primary/20">
                            <Plus size={22} strokeWidth={3} />
                            <span className="text-xs font-black uppercase">{t.accept}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Friends List - Grid Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {friends.length === 0 ? (
                  <div className="col-span-full py-32 text-center bg-zinc-100/50 dark:bg-zinc-900/50 rounded-[48px] border-2 border-dashed border-border-custom">
                    <Users size={80} className="mx-auto mb-6 opacity-5 text-primary" />
                    <p className="text-zinc-400 font-black text-xl tracking-tight">{t.noUsersFound}</p>
                  </div>
                ) : (
                  friends.map(f => (
                    <div key={f.id} className="bg-card border border-border-custom p-6 rounded-[36px] flex flex-col items-center text-center group hover:border-primary transition-all shadow-xl shadow-primary/5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-primary/10 transition-all" />
                      <button onClick={() => viewUserProfile(f.id)} className="relative mb-6">
                        <img src={f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.id}`} className="w-24 h-24 rounded-[32px] border-4 border-primary-light shadow-xl group-hover:scale-105 transition-transform duration-500" />
                      </button>
                      <h3 className="text-lg font-black tracking-tight mb-1">{f.name}</h3>
                      <p className="text-xs text-zinc-400 font-bold mb-6">{f.email}</p>
                      <div className="flex gap-3 w-full">
                        <button 
                          onClick={() => viewUserProfile(f.id)}
                          className="flex-1 py-3 rounded-[18px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-black text-xs hover:bg-zinc-200 transition-all"
                        >
                          {t.profile}
                        </button>
                        <button 
                          onClick={() => startChat(f.id)}
                          className="flex-1 py-3 rounded-[18px] bg-primary text-white font-black text-xs hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
                        >
                          {t.chat}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : isSettingsOpen ? (
            <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-5xl font-black tracking-tighter dark:text-white">{t.settings}</h2>
              <div className="bg-card border border-border-custom rounded-[40px] p-10">
                <form onSubmit={handleUpdateSettings} className="space-y-8">
                  <div className="flex flex-col md:flex-row items-center gap-10">
                    <div className="relative group">
                      <img src={editAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`} className="w-32 h-32 rounded-[32px] border-4 border-primary-light object-cover shadow-xl" />
                      <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[32px] opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                        <Camera className="text-white" size={32} />
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
                      </label>
                    </div>
                    <div className="flex-1 space-y-4 w-full">
                      <div>
                        <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">{t.name}</label>
                        <input 
                          type="text" 
                          className="w-full bg-zinc-50 dark:bg-zinc-800 border border-border-custom rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">{t.password}</label>
                        <input 
                          type="password" 
                          className="w-full bg-zinc-50 dark:bg-zinc-800 border border-border-custom rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="New Password"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-6 bg-zinc-50 dark:bg-zinc-800 rounded-3xl border border-border-custom flex items-center justify-between">
                      <div>
                        <p className="font-black text-sm mb-1 dark:text-white">
                          {editTheme === 'dark' ? (lang === 'sk' ? 'Prepnúť na biely režim' : 'Switch to Light Mode') : (lang === 'sk' ? 'Prepnúť na čierny režim' : 'Switch to Dark Mode')}
                        </p>
                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Switch appearance</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setEditTheme(editTheme === 'light' ? 'dark' : 'light')}
                        className={`w-14 h-7 rounded-full transition-all relative ${editTheme === 'dark' ? 'bg-primary shadow-lg shadow-primary/30' : 'bg-zinc-300'}`}
                      >
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${editTheme === 'dark' ? 'left-8' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="p-6 bg-zinc-50 dark:bg-zinc-800 rounded-3xl border border-border-custom">
                      <p className="font-black text-sm mb-4 dark:text-white">{t.themeColor}</p>
                      <div className="flex gap-3">
                        {['#a855f7', '#3b82f6', '#ef4444', '#10b981', '#f59e0b'].map(color => (
                          <button 
                            key={color}
                            type="button"
                            onClick={() => setEditColor(color)}
                            className={`w-8 h-8 rounded-xl border-2 transition-all hover:scale-110 ${editColor === color ? 'border-zinc-900 dark:border-white scale-110 shadow-lg' : 'border-transparent'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-6">
                    <button 
                      type="button"
                      onClick={() => setIsSettingsOpen(false)}
                      className="flex-1 py-4 rounded-2xl font-black text-sm border border-border-custom hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all dark:text-white"
                    >
                      {t.cancel}
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 bg-primary text-white py-4 rounded-2xl font-black text-sm hover:bg-primary-hover transition-all shadow-xl shadow-primary/20"
                    >
                      {t.save}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : isChatOpen ? (
            <div className="max-w-6xl mx-auto h-[calc(100vh-12rem)] flex bg-card border border-border-custom rounded-[48px] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Sidebar */}
              <div className="w-1/3 border-r border-border-custom flex flex-col">
                <div className="p-8 border-b border-border-custom flex items-center justify-between">
                  <h2 className="text-3xl font-black tracking-tighter dark:text-white">{t.messages}</h2>
                  <button onClick={() => setIsCreateGroupOpen(true)} className="bg-primary/10 text-primary p-2.5 rounded-2xl hover:bg-primary hover:text-white transition-all">
                    <Plus size={22} strokeWidth={3} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {chatRooms.map(room => (
                    <button 
                      key={room.id}
                      onClick={() => setActiveChat(room)}
                      className={`w-full p-5 flex items-center gap-4 rounded-[28px] transition-all ${activeChat?.id === room.id ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'hover:bg-primary/5 text-zinc-500 hover:text-primary'}`}
                    >
                      {room.isGroup ? (
                        <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center font-black text-xl ${activeChat?.id === room.id ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}>
                          {room.name?.[0]}
                        </div>
                      ) : (
                        <img 
                          src={room.participantDetails?.[0]?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${room.participantDetails?.[0]?.id}`} 
                          className="w-14 h-14 rounded-[20px] border-2 border-transparent group-hover:border-primary transition-all"
                        />
                      )}
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-base font-black truncate dark:text-white">
                          {room.isGroup ? room.name : (room.participantDetails?.[0]?.name || 'Chat')}
                        </p>
                        <p className={`text-xs truncate font-bold ${activeChat?.id === room.id ? 'text-white/70' : 'text-zinc-400'}`}>
                          {(() => {
                            const lastMsg = room.messages[room.messages.length - 1];
                            if (!lastMsg) return 'No messages yet';
                            if (lastMsg.type === 'image') return '📷 Fotka';
                            if (lastMsg.type === 'video') return '🎥 Video';
                            if (lastMsg.type === 'audio') return '🎤 Hlasová správa';
                            return lastMsg.text || 'Správa';
                          })()}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 flex flex-col bg-zinc-50/30 dark:bg-zinc-900/30">
                {activeChat ? (
                  <>
                    <div className="p-8 border-b border-border-custom flex items-center justify-between bg-card/50 backdrop-blur-md">
                      <div className="flex items-center gap-4">
                        {!activeChat.isGroup && activeChat.participantDetails?.[0] && (
                          <img src={activeChat.participantDetails[0].avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeChat.participantDetails[0].id}`} className="w-12 h-12 rounded-[18px] border-2 border-primary/20" />
                        )}
                        <div>
                          <h3 className="text-xl font-black tracking-tight">
                            {activeChat.isGroup ? activeChat.name : (activeChat.participantDetails?.[0]?.name || 'Chat')}
                          </h3>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Active now</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {activeChat.id !== 'global_chat' && (
                          <>
                            <button onClick={() => startCall('audio')} className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-primary transition-all">
                              <Phone size={22} />
                            </button>
                            <button onClick={() => startCall('video')} className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-primary transition-all">
                              <Video size={22} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 space-y-6">
                      {activeChat.messages.map(msg => (
                        <div key={msg.id} className={`flex flex-col ${msg.senderId === user?.id ? 'items-end' : 'items-start'}`}>
                          {activeChat.isGroup && msg.senderId !== user?.id && (
                            <span className="text-[10px] text-zinc-400 ml-4 mb-2 font-black uppercase tracking-widest">{msg.senderName}</span>
                          )}
                          <div className={`max-w-[70%] p-5 rounded-[28px] text-sm font-bold shadow-sm ${msg.senderId === user?.id ? 'bg-primary text-white rounded-tr-none shadow-primary/20' : 'bg-card border border-border-custom rounded-tl-none'}`}>
                            {msg.type === 'text' && msg.text}
                            {msg.type === 'image' && msg.url && (
                              <img src={msg.url} className="max-w-full rounded-2xl" referrerPolicy="no-referrer" />
                            )}
                            {msg.type === 'video' && msg.url && (
                              <video src={msg.url} controls className="max-w-full rounded-2xl" />
                            )}
                            {msg.type === 'audio' && msg.url && (
                              <audio src={msg.url} controls className="max-w-full" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-8 bg-card/50 backdrop-blur-md border-t border-border-custom">
                      <form onSubmit={sendMessage} className="flex gap-4 items-center">
                        <div className="flex gap-2">
                          <label className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-primary cursor-pointer transition-all">
                            <Paperclip size={22} />
                            <input type="file" accept="image/*,video/*" className="hidden" onChange={handleChatFileSelect} />
                          </label>
                          <button 
                            type="button"
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            onTouchStart={startRecording}
                            onTouchEnd={stopRecording}
                            className={`p-3 rounded-2xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-primary'}`}
                          >
                            <Mic size={22} />
                          </button>
                        </div>
                        <input 
                          type="text" 
                          placeholder={t.sendMessage}
                          className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-none rounded-[24px] px-6 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary transition-all"
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                        />
                        <button type="submit" className="bg-primary text-white p-4 rounded-[24px] hover:bg-primary-hover transition-all shadow-xl shadow-primary/20">
                          <Send size={24} strokeWidth={3} />
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 p-12 text-center">
                    <div className="w-32 h-32 bg-primary/5 rounded-[48px] flex items-center justify-center mb-8">
                      <MessageCircle size={64} className="opacity-20 text-primary" />
                    </div>
                    <h3 className="text-2xl font-black tracking-tighter text-zinc-900 dark:text-white mb-2">{t.chat}</h3>
                    <p className="max-w-xs font-bold">Select a conversation to start vibing with your friends.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-6xl font-black tracking-tighter mb-2 dark:text-white">{t.feed}</h2>
                  <p className="text-zinc-400 font-bold tracking-tight text-lg">Stay connected with your vibe.</p>
                </div>
                <div className="flex p-2 bg-zinc-100 dark:bg-zinc-800 rounded-[28px] border border-border-custom shadow-inner">
                  <button 
                    onClick={() => setFeedFilter('trending')}
                    className={`px-8 py-3 rounded-[22px] text-sm font-black transition-all ${feedFilter === 'trending' ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-zinc-500 hover:text-primary'}`}
                  >
                    Trending
                  </button>
                  <button 
                    onClick={() => setFeedFilter('latest')}
                    className={`px-8 py-3 rounded-[22px] text-sm font-black transition-all ${feedFilter === 'latest' ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-zinc-500 hover:text-primary'}`}
                  >
                    Latest
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
                {[...posts]
                  .sort((a, b) => {
                    if (feedFilter === 'trending') return b.likes - a.likes;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                  })
                  .map(post => (
                    <PostCard 
                      key={post.id} 
                      post={post} 
                      onComment={handleComment} 
                      onLike={handleLike}
                      t={t} 
                      onUserClick={viewUserProfile}
                      onAddFriend={handleRequestFriend}
                      onMessage={startChat}
                      currentUser={user}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Language Modal */}
      <AnimatePresence>
        {isLangOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLangOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-xl font-bold">{t.selectLanguage}</h2>
                <button onClick={() => setIsLangOpen(false)} className="text-zinc-400 hover:text-foreground">
                  <X size={24} />
                </button>
              </div>
              <div className="p-4 border-b border-zinc-100">
                <div className="flex items-center bg-zinc-100 rounded-xl px-4 py-2">
                  <Search size={18} className="text-zinc-400 mr-2" />
                  <input 
                    type="text" 
                    placeholder={t.searchLanguage}
                    className="bg-transparent border-none focus:ring-0 text-sm w-full"
                    value={langSearch}
                    onChange={(e) => setLangSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {filteredLanguages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {filteredLanguages.map((l) => (
                      <button 
                        key={l.code}
                        onClick={() => translateUI(l.code)}
                        className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${lang === l.code ? 'bg-primary-light text-primary border border-primary/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-transparent'}`}
                      >
                        <div className="flex flex-col">
                          <span>{l.name}</span>
                          <span className="text-[10px] uppercase opacity-50">{l.code}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-sm text-zinc-500 mb-4">No matching language found.</p>
                    <button 
                      onClick={() => translateUI('custom', langSearch)}
                      className="bg-primary text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-primary-hover transition-colors"
                    >
                      Translate to "{langSearch}"
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUploadOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <h2 className="text-xl font-bold mb-6">{t.post}</h2>
                <form onSubmit={handleUpload} className="space-y-4">
                  <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                    <button 
                      type="button"
                      onClick={() => setUploadType('image')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${uploadType === 'image' ? 'bg-white dark:bg-zinc-700 shadow-sm text-primary' : 'text-zinc-500'}`}
                    >
                      <ImageIcon size={18} /> {t.photo}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setUploadType('video')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${uploadType === 'video' ? 'bg-white dark:bg-zinc-700 shadow-sm text-primary' : 'text-zinc-500'}`}
                    >
                      <Video size={18} /> {t.video}
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">URL / File</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="https://... or select file" 
                        className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                        value={uploadUrl}
                        onChange={(e) => setUploadUrl(e.target.value)}
                      />
                      <label className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-xl cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center">
                        {isUploadingFile ? <Loader2 size={20} className="animate-spin text-primary" /> : <ImageIcon size={20} className="text-zinc-600" />}
                        <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
                      </label>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1 italic">
                      Tip: Direct video files and YouTube links are supported!
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">{t.caption}</label>
                    <textarea 
                      placeholder={t.caption}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none h-24 resize-none"
                      value={uploadCaption}
                      onChange={(e) => setUploadCaption(e.target.value)}
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={!uploadUrl || isUploadingFile}
                    className="w-full bg-primary text-white py-3 rounded-2xl font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
                  >
                    {t.upload}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Create Group Modal */}
      <AnimatePresence>
        {isCreateGroupOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateGroupOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8"
            >
              <h2 className="text-xl font-bold mb-6">Vytvoriť skupinu</h2>
              <form onSubmit={createGroup} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Názov skupiny</label>
                  <input 
                    type="text" 
                    placeholder="Názov..." 
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Vyberte členov</label>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {friends.map(f => (
                      <label key={f.id} className="flex items-center gap-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedFriends.includes(f.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedFriends([...selectedFriends, f.id]);
                            else setSelectedFriends(selectedFriends.filter(id => id !== f.id));
                          }}
                          className="w-4 h-4 rounded border-zinc-300 text-primary focus:ring-primary"
                        />
                        <img src={f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.id}`} className="w-8 h-8 rounded-full" />
                        <span className="text-sm">{f.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsCreateGroupOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-sm border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Zrušiť
                  </button>
                  <button 
                    type="submit"
                    disabled={!groupName || selectedFriends.length === 0}
                    className="flex-1 bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary-hover transition-colors disabled:opacity-50"
                  >
                    Vytvoriť
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-y-0 left-0 w-72 bg-card border-r border-border-custom flex flex-col"
            >
              <div className="p-8 flex items-center justify-between">
                <h1 className="text-3xl font-black tracking-tighter text-primary italic">VIBE</h1>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-zinc-400 hover:text-primary">
                  <X size={24} />
                </button>
              </div>
              
              <nav className="flex-1 px-6 space-y-3">
                <button 
                  onClick={() => { setViewingUser(null); setIsSettingsOpen(false); setIsChatOpen(false); setIsFriendsOpen(false); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-[24px] transition-all group ${!viewingUser && !isSettingsOpen && !isChatOpen && !isFriendsOpen ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'hover:bg-primary/10 text-zinc-500 hover:text-primary'}`}
                >
                  <Globe size={22} />
                  <span className="font-bold text-base">{t.feed}</span>
                </button>
                
                <button 
                  onClick={() => { if (user) viewUserProfile(user.id); setIsSettingsOpen(false); setIsChatOpen(false); setIsFriendsOpen(false); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-[24px] transition-all group ${viewingUser?.id === user?.id && !isSettingsOpen && !isChatOpen && !isFriendsOpen ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'hover:bg-primary/10 text-zinc-500 hover:text-primary'}`}
                >
                  <UserIcon size={22} />
                  <span className="font-bold text-base">{t.profile}</span>
                </button>

                <button 
                  onClick={() => { setIsChatOpen(true); setViewingUser(null); setIsSettingsOpen(false); setIsFriendsOpen(false); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-[24px] transition-all group ${isChatOpen ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'hover:bg-primary/10 text-zinc-500 hover:text-primary'}`}
                >
                  <MessageCircle size={22} />
                  <span className="font-bold text-base">{t.chat}</span>
                </button>

                <button 
                  onClick={() => { setIsFriendsOpen(true); setViewingUser(null); setIsChatOpen(false); setIsSettingsOpen(false); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-[24px] transition-all group ${isFriendsOpen ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'hover:bg-primary/10 text-zinc-500 hover:text-primary'}`}
                >
                  <Users size={22} />
                  <span className="font-bold text-base">{t.friends}</span>
                </button>
              </nav>

              <div className="p-6 border-t border-border-custom">
                {user ? (
                  <div className="flex items-center gap-4 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-[30px] border border-border-custom">
                    <img src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} className="w-12 h-12 rounded-full border-2 border-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate">{user.name}</p>
                      <button onClick={() => { setUser(null); setIsMobileMenuOpen(false); }} className="text-[11px] text-red-500 font-bold">
                        {t.logout}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => { setIsLoginOpen(true); setIsMobileMenuOpen(false); }}
                    className="w-full bg-primary text-white py-4 rounded-[24px] font-black text-lg"
                  >
                    {t.login}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Call Modals */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            className="fixed bottom-8 right-8 z-[100] bg-card border border-border-custom p-6 rounded-3xl shadow-2xl w-80"
          >
            <div className="flex flex-col items-center text-center">
              <img src={incomingCall.fromUserAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${incomingCall.fromUserId}`} className="w-20 h-20 rounded-full mb-4 border-4 border-primary/20" />
              <h3 className="font-bold text-lg mb-1">{incomingCall.fromUserName}</h3>
              <p className="text-sm text-zinc-400 mb-6">{incomingCall.type === 'video' ? t.videoCall : t.call}</p>
              <div className="flex gap-4 w-full">
                <button 
                  onClick={declineCall}
                  className="flex-1 bg-red-500 text-white p-3 rounded-2xl hover:bg-red-600 transition-colors flex items-center justify-center"
                >
                  <PhoneOff size={20} />
                </button>
                <button 
                  onClick={answerCall}
                  className="flex-1 bg-primary text-white p-3 rounded-2xl hover:bg-primary-hover transition-colors flex items-center justify-center"
                >
                  <Phone size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {(isCalling || (activeCall && activeCall.status === 'accepted')) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <div className="max-w-md w-full text-center text-white">
              <motion.div 
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="relative inline-block mb-8"
              >
                <img 
                  src={(activeCall?.fromUserId === user?.id ? activeChat?.participantDetails?.[0]?.avatar : activeCall?.fromUserAvatar) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeCall?.fromUserId === user?.id ? activeCall?.toUserId : activeCall?.fromUserId}`} 
                  className="w-32 h-32 rounded-full border-4 border-primary shadow-2xl" 
                />
                {isCalling && (
                  <div className="absolute inset-0 rounded-full border-4 border-primary animate-ping opacity-20" />
                )}
              </motion.div>
              
              <h2 className="text-3xl font-bold mb-2">
                {activeCall?.fromUserId === user?.id ? activeChat?.participantDetails?.[0]?.name : activeCall?.fromUserName}
              </h2>
              <p className="text-primary font-medium mb-12">
                {isCalling ? t.calling : (activeCall?.type === 'video' ? t.videoCall : t.call)}
              </p>

              {activeCall?.type === 'video' && activeCall?.status === 'accepted' && (
                <div className="aspect-video bg-zinc-900 rounded-3xl mb-12 flex items-center justify-center overflow-hidden border border-white/10">
                  <Video size={48} className="text-zinc-700" />
                  <p className="absolute text-xs text-zinc-500">Video stream simulation</p>
                </div>
              )}

              <button 
                onClick={endCall}
                className="bg-red-500 text-white p-6 rounded-full hover:bg-red-600 transition-all hover:scale-110 shadow-2xl"
              >
                <PhoneOff size={32} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface PostCardProps {
  key?: string | number;
  post: Post;
  onComment: (id: string, text: string) => void | Promise<void>;
  onLike: (id: string) => void | Promise<void>;
  t: any;
  onUserClick: (userId: string) => void;
  onAddFriend: (userId: string) => void;
  onMessage: (userId: string) => void;
  currentUser: User | null;
}

function PostCard({ post, onComment, onLike, t, onUserClick, onAddFriend, onMessage, currentUser }: PostCardProps) {
  const [commentText, setCommentText] = useState('');
  const [isLiked, setIsLiked] = useState(false);

  const handleLikeClick = () => {
    if (!isLiked) {
      onLike(post.id);
      setIsLiked(true);
    }
  };
  const [showComments, setShowComments] = useState(false);

  const isFriend = currentUser?.friends?.includes(post.userId);
  const isSelf = currentUser?.id === post.userId;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="group bg-card rounded-[32px] border border-border-custom shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden flex flex-col"
    >
      {/* Media Section with Overlay */}
      <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {post.url ? (
          post.type === 'image' ? (
            <img 
              src={post.url} 
              alt={post.caption} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
          ) : (
            getYouTubeEmbedUrl(post.url) ? (
              <iframe 
                src={getYouTubeEmbedUrl(post.url)!}
                className="w-full h-full border-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video 
                src={post.url} 
                controls 
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
              />
            )
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-400">
            <ImageIcon size={48} strokeWidth={1} />
          </div>
        )}
        
        {/* Top Overlay Actions */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
          {!isSelf && (
            <>
              <button 
                onClick={() => onMessage(post.userId)}
                className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:bg-primary hover:border-primary transition-all"
                title={t.chat}
              >
                <MessageCircle size={20} />
              </button>
              <button 
                onClick={() => onMessage(post.userId)}
                className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:bg-green-500 hover:border-green-500 transition-all"
                title="Call"
              >
                <Phone size={20} />
              </button>
            </>
          )}
          <button 
            onClick={handleLikeClick}
            className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center transition-all ${isLiked ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white/20 border-white/30 text-white hover:bg-rose-500 hover:border-rose-500'}`}
          >
            <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
          </button>
        </div>

        {/* Bottom User Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <button 
            onClick={() => onUserClick(post.userId)}
            className="flex items-center gap-3 text-left group/user"
          >
            <div className="relative">
              <img src={post.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.userId}`} className="w-12 h-12 rounded-2xl border-2 border-white/50 shadow-2xl group-hover/user:border-primary transition-colors" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-lg flex items-center justify-center border-2 border-black">
                {post.type === 'image' ? <ImageIcon size={10} className="text-white" /> : <Video size={10} className="text-white" />}
              </div>
            </div>
            <div className="text-white">
              <p className="font-black text-lg tracking-tight leading-none mb-1">{post.userName || 'Anonymous'}</p>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-70 font-mono">
                {new Date(post.createdAt).toLocaleDateString()}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 flex-1 flex flex-col bg-card">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <p className="text-sm font-medium leading-relaxed text-zinc-600 dark:text-zinc-400 line-clamp-2 group-hover:line-clamp-none transition-all duration-300">
              {post.caption}
            </p>
          </div>
          {!isSelf && !isFriend && (
            <button 
              onClick={() => onAddFriend(post.userId)}
              className="shrink-0 px-4 py-1.5 rounded-full border border-primary text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
            >
              {t.addFriend}
            </button>
          )}
        </div>

        {/* Stats & Interaction */}
        <div className="mt-auto pt-4 border-t border-border-custom flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-6 h-6 rounded-full border-2 border-card bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                  <img src={`https://picsum.photos/seed/${post.id}${i}/50/50`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <span className="text-foreground">{post.likes + (isLiked ? 1 : 0)}</span> {t.likes}
            </p>
          </div>

          <button 
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-2 text-zinc-400 hover:text-primary transition-colors"
          >
            <MessageCircle size={18} />
            <span className="text-[11px] font-bold uppercase tracking-wider">{post.comments.length}</span>
          </button>
        </div>

        {/* Comments Section (Collapsible) */}
        <AnimatePresence>
          {showComments && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-3">
                {post.comments.map(c => (
                  <div key={c.id} className="flex gap-3 group/comment">
                    <img src={c.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.userId}`} className="w-8 h-8 rounded-xl border border-border-custom" />
                    <div className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-2xl rounded-tl-none border border-border-custom">
                      <p className="text-[11px] font-black mb-1">{c.userName || 'Anonymous'}</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{c.text}</p>
                    </div>
                  </div>
                ))}
                
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!commentText.trim()) return;
                    onComment(post.id, commentText);
                    setCommentText('');
                  }}
                  className="flex items-center gap-2 pt-2"
                >
                  <input 
                    type="text" 
                    placeholder={t.addComment}
                    className="flex-1 text-xs bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <button 
                    type="submit"
                    className="p-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
