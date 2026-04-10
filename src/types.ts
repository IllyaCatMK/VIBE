export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  password?: string;
  theme?: 'light' | 'dark';
  primaryColor?: string;
  friends?: string[];
  friendRequests?: string[];
}

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  text?: string;
  type: 'text' | 'image' | 'video' | 'audio';
  url?: string;
  createdAt: string;
}

export interface ChatRoom {
  id: string;
  name?: string;
  participants: string[];
  messages: Message[];
  isGroup: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  type: 'image' | 'video';
  url: string;
  caption: string;
  likes: number;
  comments: Comment[];
  createdAt: string;
}

export type TranslationStrings = {
  feed: string;
  friends: string;
  profile: string;
  post: string;
  comment: string;
  addComment: string;
  upload: string;
  photo: string;
  video: string;
  caption: string;
  login: string;
  logout: string;
  language: string;
  addFriend: string;
  friendsList: string;
  searchLanguage: string;
  selectLanguage: string;
  settings: string;
  editProfile: string;
  save: string;
  cancel: string;
  name: string;
  profilePhoto: string;
  myPosts: string;
  chooseFile: string;
  noPosts: string;
  friendRequests: string;
  accept: string;
  decline: string;
  noRequests: string;
  alreadyFriends: string;
  requestSent: string;
  password: string;
  changePassword: string;
  darkMode: string;
  themeColor: string;
  chat: string;
  messages: string;
  sendMessage: string;
  createGroup: string;
  groupName: string;
  searchUsers: string;
  noUsersFound: string;
  call: string;
  videoCall: string;
  incomingCall: string;
  calling: string;
  endCall: string;
  answer: string;
  wantsToBeFriend: string;
};

export const initialTranslations: Record<string, TranslationStrings> = {
  en: {
    feed: "Feed",
    friends: "Friends",
    profile: "Profile",
    post: "Post",
    comment: "Comment",
    addComment: "Add a comment...",
    upload: "Upload",
    photo: "Photo",
    video: "Video",
    caption: "Write a caption...",
    login: "Login",
    logout: "Logout",
    language: "Language",
    addFriend: "Add Friend",
    friendsList: "Friends List",
    searchLanguage: "Search language...",
    selectLanguage: "Select Language",
    settings: "Settings",
    editProfile: "Edit Profile",
    save: "Save",
    cancel: "Cancel",
    name: "Name",
    profilePhoto: "Profile Photo",
    myPosts: "Posts",
    chooseFile: "Choose from gallery",
    noPosts: "No posts yet.",
    friendRequests: "Friend Requests",
    accept: "Accept",
    decline: "Decline",
    noRequests: "No pending requests.",
    alreadyFriends: "Friends",
    requestSent: "Request Sent",
    password: "Password",
    changePassword: "Change Password",
    darkMode: "Dark Mode",
    themeColor: "Theme Color",
    chat: "Chat",
    messages: "Messages",
    sendMessage: "Send message...",
    createGroup: "Create Group",
    groupName: "Group Name",
    searchUsers: "Search users...",
    noUsersFound: "No users found.",
    call: "Audio Call",
    videoCall: "Video Call",
    incomingCall: "Incoming Call",
    calling: "Calling...",
    endCall: "End Call",
    answer: "Answer",
    wantsToBeFriend: "Wants to be your friend"
  },
  sk: {
    feed: "Príspevky",
    friends: "Priatelia",
    profile: "Profil",
    post: "Pridať",
    comment: "Komentár",
    addComment: "Pridať komentár...",
    upload: "Nahrať",
    photo: "Fotka",
    video: "Video",
    caption: "Napíšte popis...",
    login: "Prihlásiť sa",
    logout: "Odhlásiť sa",
    language: "Jazyk",
    addFriend: "Pridať priateľa",
    friendsList: "Zoznam priateľov",
    searchLanguage: "Hľadať jazyk...",
    selectLanguage: "Vybrať jazyk",
    settings: "Nastavenia",
    editProfile: "Upraviť profil",
    save: "Uložiť",
    cancel: "Zrušiť",
    name: "Meno",
    profilePhoto: "Profilová fotka",
    myPosts: "Príspevky",
    chooseFile: "Vybrať z galérie",
    noPosts: "Zatiaľ žiadne príspevky.",
    friendRequests: "Žiadosti o priateľstvo",
    accept: "Prijať",
    decline: "Odmietnuť",
    noRequests: "Žiadne nové žiadosti.",
    alreadyFriends: "Priatelia",
    requestSent: "Žiadosť odoslaná",
    password: "Heslo",
    changePassword: "Zmeniť heslo",
    darkMode: "Tmavý režim",
    themeColor: "Farba témy",
    chat: "Čet",
    messages: "Správy",
    sendMessage: "Odoslať správu...",
    createGroup: "Vytvoriť skupinu",
    groupName: "Názov skupiny",
    searchUsers: "Hľadať používateľov...",
    noUsersFound: "Nenašli sa žiadni používatelia.",
    call: "Hlasový hovor",
    videoCall: "Video hovor",
    incomingCall: "Prichádzajúci hovor",
    calling: "Volám...",
    endCall: "Ukončiť",
    answer: "Prijať",
    wantsToBeFriend: "Vás žiada o priateľstvo"
  }
};

export const allLanguages = [
  { code: 'en', name: 'English' },
  { code: 'sk', name: 'Slovenčina' },
  { code: 'cs', name: 'Čeština' },
  { code: 'ru', name: 'Русский' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'pl', name: 'Polski' },
  { code: 'hu', name: 'Magyar' },
  { code: 'uk', name: 'Українська' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'ko', name: '한국어' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'pt', name: 'Português' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'sv', name: 'Svenska' },
  { code: 'da', name: 'Dansk' },
  { code: 'no', name: 'Norsk' },
  { code: 'fi', name: 'Suomi' },
  { code: 'el', name: 'Ελληνικά' },
  { code: 'he', name: 'עברית' },
  { code: 'ro', name: 'Română' },
  { code: 'bg', name: 'Български' },
  { code: 'hr', name: 'Hrvatski' },
  { code: 'sr', name: 'Српски' },
  { code: 'sl', name: 'Slovenščina' },
  { code: 'et', name: 'Eesti' },
  { code: 'lv', name: 'Latviešu' },
  { code: 'lt', name: 'Lietuvių' },
  { code: 'th', name: 'ไทย' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Bahasa Melayu' }
];
