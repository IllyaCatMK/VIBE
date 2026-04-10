import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = path.join(process.cwd(), "database");
const DB_PATH = path.join(DB_DIR, "db.json");

function ensureDbDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // In-memory data store
  const data = {
    users: [
      { 
        id: "1", 
        email: "grafikasastinzus@gmail.com", 
        name: "Grafika Sastinzus", 
        avatar: "https://picsum.photos/seed/grafika/100/100",
        password: "password123",
        theme: "light",
        primaryColor: "#a855f7",
        friends: [],
        friendRequests: []
      }
    ],
    posts: [
      {
        id: "p1",
        userId: "1",
        userName: "Grafika Sastinzus",
        userAvatar: "https://picsum.photos/seed/grafika/100/100",
        type: "image",
        url: "https://picsum.photos/seed/post1/800/600",
        caption: "Welcome to VIBE! 🚀",
        likes: 12,
        comments: [
          { id: "c1", userId: "1", userName: "Grafika Sastinzus", text: "First post!" }
        ],
        createdAt: new Date().toISOString()
      }
    ],
    chatRooms: [
      {
        id: "global_chat",
        name: "Svetový Chat 🌍",
        participants: ["1"],
        messages: [
          { id: "m1", senderId: "1", senderName: "Grafika Sastinzus", text: "Vitajte v globálnom chate! 👋", type: 'text', createdAt: new Date().toISOString() }
        ],
        isGroup: true
      }
    ] as any[],
    calls: [] as any[]
  };

  const saveData = () => {
    try {
      ensureDbDir();
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("Failed to save data:", err);
    }
  };

  const loadData = () => {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, "utf-8");
        if (raw.trim() && raw !== "{}") {
          try {
            const parsed = JSON.parse(raw);
            if (parsed.users) data.users = parsed.users;
            if (parsed.posts) data.posts = parsed.posts;
            if (parsed.chatRooms) data.chatRooms = parsed.chatRooms;
            if (parsed.calls) data.calls = parsed.calls;
            console.log("Data loaded from database/db.json");
          } catch (parseErr) {
            console.error("Failed to parse db.json, using defaults:", parseErr);
            saveData();
          }
        } else {
          saveData();
        }
      } else {
        saveData();
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    }
  };

  // Load data on startup
  loadData();

  // API Router
  const apiRouter = express.Router();

  apiRouter.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.url}`);
    next();
  });

  apiRouter.post("/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = data.users.find(u => u.email === email && u.password === password);
    if (user) {
      // Ensure user is in global chat
      const globalChat = data.chatRooms.find(r => r.id === "global_chat");
      if (globalChat && !globalChat.participants.includes(user.id)) {
        globalChat.participants.push(user.id);
        saveData();
      }
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid email or password" });
    }
  });

  apiRouter.post("/auth/signup", (req, res) => {
    const { email, name, password } = req.body;
    if (data.users.find(u => u.email === email)) {
      return res.status(400).json({ error: "User already exists" });
    }
    const newUser = {
      id: Date.now().toString(),
      email,
      name,
      password,
      avatar: `https://picsum.photos/seed/${email}/100/100`,
      theme: "light",
      primaryColor: "#a855f7",
      friends: [],
      friendRequests: []
    };
    data.users.push(newUser);
    // Add to global chat
    const globalChat = data.chatRooms.find(r => r.id === "global_chat");
    if (globalChat && !globalChat.participants.includes(newUser.id)) {
      globalChat.participants.push(newUser.id);
    }
    saveData();
    res.status(201).json(newUser);
  });

  apiRouter.get("/users/search", (req, res) => {
    const query = (req.query.q as string || "").toLowerCase();
    const results = data.users.filter(u => 
      u.name.toLowerCase().includes(query) || 
      u.email.toLowerCase().includes(query)
    );
    res.json(results);
  });

  apiRouter.put("/users/:id/settings", (req, res) => {
    const { theme, primaryColor, password, name, avatar } = req.body;
    const user = data.users.find(u => u.id === req.params.id);
    if (user) {
      if (theme) user.theme = theme;
      if (primaryColor) user.primaryColor = primaryColor;
      if (password) user.password = password;
      if (name) user.name = name;
      if (avatar) user.avatar = avatar;
      
      // Update all their posts too if name or avatar changed
      if (name || avatar) {
        data.posts.forEach(p => {
          if (p.userId === req.params.id) {
            if (name) p.userName = name;
            if (avatar) p.userAvatar = avatar;
          }
        });
      }

      saveData();
      res.json(user);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  // Chat Endpoints
  apiRouter.get("/chats/:userId", (req, res) => {
    const userId = req.params.userId;
    const rooms = data.chatRooms.filter(r => r.participants.includes(userId)).map(room => {
      // Enrich room with participant details (excluding current user for direct chats)
      const otherParticipants = room.participants.filter((id: string) => id !== userId);
      const participantDetails = otherParticipants.map((id: string) => {
        const u = data.users.find(user => user.id === id);
        return u ? { id: u.id, name: u.name, avatar: u.avatar } : { id, name: "Unknown User", avatar: "" };
      });
      return { ...room, participantDetails };
    });
    res.json(rooms);
  });

  apiRouter.post("/chats", (req, res) => {
    const { participants, name, isGroup } = req.body;
    
    // Check if direct chat already exists
    if (!isGroup && participants.length === 2) {
      const existing = data.chatRooms.find(r => 
        !r.isGroup && 
        r.participants.includes(participants[0]) && 
        r.participants.includes(participants[1])
      );
      if (existing) {
        // Enrich existing room before returning
        const otherId = participants.find((id: string) => id !== participants[0]); // Assuming 0 is the requester
        const u = data.users.find(user => user.id === otherId);
        return res.json({ 
          ...existing, 
          participantDetails: u ? [{ id: u.id, name: u.name, avatar: u.avatar }] : [] 
        });
      }
    }

    const newRoom = {
      id: `chat_${Date.now()}`,
      name: name || "",
      participants,
      messages: [],
      isGroup: !!isGroup
    };
    data.chatRooms.push(newRoom);
    saveData();
    
    // Enrich new room
    const otherParticipants = participants.filter((id: string) => id !== participants[0]);
    const participantDetails = otherParticipants.map((id: string) => {
      const u = data.users.find(user => user.id === id);
      return u ? { id: u.id, name: u.name, avatar: u.avatar } : { id, name: "Unknown User", avatar: "" };
    });
    
    res.status(201).json({ ...newRoom, participantDetails });
  });

  apiRouter.post("/chats/:roomId/messages", (req, res) => {
    const { senderId, text, type, url } = req.body;
    const room = data.chatRooms.find(r => r.id === req.params.roomId);
    if (room) {
      const sender = data.users.find(u => u.id === senderId);
      const newMessage = {
        id: `msg_${Date.now()}`,
        senderId,
        senderName: sender ? sender.name : "Neznámy",
        text,
        type: type || 'text',
        url,
        createdAt: new Date().toISOString()
      };
      room.messages.push(newMessage);
      saveData();
      res.status(201).json(newMessage);
    } else {
      res.status(404).json({ error: "Chat room not found" });
    }
  });

  apiRouter.get("/posts", (req, res) => {
    res.json(data.posts);
  });

  apiRouter.get("/users/:id/posts", (req, res) => {
    const userPosts = data.posts.filter(p => p.userId === req.params.id);
    res.json(userPosts);
  });

  apiRouter.get("/users/:id", (req, res) => {
    const user = data.users.find(u => u.id === req.params.id);
    if (user) {
      res.json(user);
    } else {
      // If user not found in static list, check if they exist in posts (for dynamic users)
      const postUser = data.posts.find(p => p.userId === req.params.id);
      if (postUser) {
        res.json({
          id: postUser.userId,
          name: postUser.userName,
          avatar: postUser.userAvatar,
          email: ""
        });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    }
  });

  apiRouter.put("/users/:id", (req, res) => {
    const { name, avatar } = req.body;
    let user = data.users.find(u => u.id === req.params.id);
    
    if (!user) {
      // Create user if they don't exist (for dynamic login simulation)
      user = { 
        id: req.params.id, 
        email: "", 
        name, 
        avatar, 
        password: "", 
        theme: "light", 
        primaryColor: "#a855f7", 
        friends: [], 
        friendRequests: [] 
      };
      data.users.push(user);
    } else {
      user.name = name || user.name;
      user.avatar = avatar || user.avatar;
    }

    // Update all their posts too
    data.posts.forEach(p => {
      if (p.userId === req.params.id) {
        p.userName = user!.name;
        p.userAvatar = user!.avatar;
      }
    });

    saveData();
    res.json(user);
  });

  apiRouter.post("/posts", (req, res) => {
    const newPost = {
      id: `p${Date.now()}`,
      ...req.body,
      likes: 0,
      comments: [],
      createdAt: new Date().toISOString()
    };
    data.posts.unshift(newPost);
    saveData();
    res.status(201).json(newPost);
  });

  apiRouter.post("/posts/:id/comments", (req, res) => {
    const post = data.posts.find(p => p.id === req.params.id);
    if (post) {
      const comment = {
        id: `c${Date.now()}`,
        ...req.body
      };
      post.comments.push(comment);
      saveData();
      res.status(201).json(comment);
    } else {
      res.status(404).json({ error: "Post not found" });
    }
  });

  apiRouter.post("/posts/:id/like", (req, res) => {
    const post = data.posts.find(p => p.id === req.params.id);
    if (post) {
      post.likes = (post.likes || 0) + 1;
      saveData();
      res.json({ likes: post.likes });
    } else {
      res.status(404).json({ error: "Post not found" });
    }
  });

  // Friend Request Endpoints
  apiRouter.post("/friends/request", (req, res) => {
    const { fromUserId, toUserId } = req.body;
    const toUser = data.users.find(u => u.id === toUserId);
    
    if (!toUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!toUser.friendRequests) toUser.friendRequests = [];
    if (!toUser.friendRequests.includes(fromUserId)) {
      toUser.friendRequests.push(fromUserId);
      saveData();
    }
    res.json({ success: true });
  });

  apiRouter.post("/friends/accept", (req, res) => {
    const { userId, friendId } = req.body;
    const user = data.users.find(u => u.id === userId);
    const friend = data.users.find(u => u.id === friendId);

    if (!user || !friend) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.friends) user.friends = [];
    if (!friend.friends) friend.friends = [];

    if (!user.friends.includes(friendId)) user.friends.push(friendId);
    if (!friend.friends.includes(userId)) friend.friends.push(userId);

    // Remove from requests
    user.friendRequests = user.friendRequests?.filter(id => id !== friendId) || [];
    
    saveData();
    res.json({ success: true });
  });

  apiRouter.post("/friends/decline", (req, res) => {
    const { userId, friendId } = req.body;
    const user = data.users.find(u => u.id === userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.friendRequests = user.friendRequests?.filter(id => id !== friendId) || [];
    saveData();
    res.json({ success: true });
  });

  apiRouter.get("/users/:id/requests", (req, res) => {
    const user = data.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    const requests = (user.friendRequests || []).map(id => {
      return data.users.find(u => u.id === id) || { id, name: "Unknown", avatar: "" };
    });
    res.json(requests);
  });

  apiRouter.get("/users/:id/friends", (req, res) => {
    const user = data.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    const friends = (user.friends || []).map(id => {
      return data.users.find(u => u.id === id) || { id, name: "Unknown", avatar: "" };
    });
    res.json(friends);
  });

  // Call Signaling
  apiRouter.post("/calls", (req, res) => {
    const { fromUserId, toUserId, type, roomId } = req.body;
    const fromUser = data.users.find(u => u.id === fromUserId);
    if (!fromUser) return res.status(404).json({ error: "Sender not found" });

    const newCall = {
      id: `call_${Date.now()}`,
      fromUserId,
      fromUserName: fromUser.name,
      fromUserAvatar: fromUser.avatar,
      toUserId,
      type, // 'audio' | 'video'
      roomId,
      status: 'ringing', // 'ringing' | 'accepted' | 'declined' | 'ended'
      createdAt: new Date().toISOString()
    };
    data.calls.push(newCall);
    saveData();
    res.status(201).json(newCall);
  });

  apiRouter.get("/calls/incoming/:userId", (req, res) => {
    const userId = req.params.userId;
    const incomingCall = data.calls.find(c => c.toUserId === userId && c.status === 'ringing');
    res.json(incomingCall || null);
  });

  apiRouter.get("/calls/:callId", (req, res) => {
    const call = data.calls.find(c => c.id === req.params.callId);
    if (!call) return res.status(404).json({ error: "Call not found" });
    res.json(call);
  });

  apiRouter.put("/calls/:callId", (req, res) => {
    const { status } = req.body;
    const call = data.calls.find(c => c.id === req.params.callId);
    if (call) {
      call.status = status;
      saveData();
      res.json(call);
    } else {
      res.status(404).json({ error: "Call not found" });
    }
  });

  apiRouter.delete("/calls/cleanup", (req, res) => {
    // Basic cleanup for old calls
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    data.calls = data.calls.filter(c => c.createdAt > oneHourAgo || c.status === 'ringing');
    saveData();
    res.json({ success: true });
  });

  // Catch-all for API router
  apiRouter.all("*", (req, res) => {
    res.status(404).json({ error: "API route not found", path: req.url });
  });

  // Error handler for API router
  apiRouter.use((err: any, req: any, res: any, next: any) => {
    console.error("API Error:", err);
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message,
      path: req.url
    });
  });

  // Mount API Router
  app.use("/api", apiRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
