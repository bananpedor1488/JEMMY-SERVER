const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

console.log('\n🔥 SERVER STARTING 🔥');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Vercel:', process.env.VERCEL ? 'YES' : 'NO');
console.log('MongoDB URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
console.log('===================\n');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { 
  cors: { 
    origin: "*",
    methods: ["GET", "POST"]
  } 
});

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Увеличен лимит для аватарок
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Simple logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

let mongoConnected = false;

app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    mongodb: mongoConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mongodb: mongoConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

const userSchema = new mongoose.Schema({
  device_id: { type: String, required: true, unique: true },
  current_identity_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Identity' },
  ephemeral_identity_enabled: { type: Boolean, default: false }
}, { timestamps: true });

const identitySchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true, unique: true },
  avatar: { type: String, default: '' },
  avatar_updated_at: { type: Date, default: null },
  bio: { type: String, default: '' },
  public_key: { type: String, required: true },
  is_active: { type: Boolean, default: true },
  expires_at: { type: Date, default: null },
  last_seen: { type: Date, default: null },
  privacy_settings: {
    type: Object,
    default: {
      who_can_message: 'everyone',
      who_can_see_profile: 'everyone',
      who_can_see_online: 'everyone',
      who_can_see_last_seen: 'everyone',
      auto_delete_messages: 0,
      screenshot_protection: false
    }
  },
  blocked_users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Identity' }]
}, { timestamps: true });

const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Identity' }],
  is_group: { type: Boolean, default: false },
  group_name: String
}, { timestamps: true });

// Chat settings per user (pin, mute, etc.)
const chatSettingsSchema = new mongoose.Schema({
  chat_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  identity_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Identity', required: true },
  is_pinned: { type: Boolean, default: false },
  is_muted: { type: Boolean, default: false }
}, { timestamps: true });

// Compound index to ensure one settings doc per user per chat
chatSettingsSchema.index({ chat_id: 1, identity_id: 1 }, { unique: true });

const messageSchema = new mongoose.Schema({
  chat_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  sender_identity_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Identity', required: true },
  encrypted_content: { type: String, required: true },
  type: { type: String, default: 'text' },
  delivered: { type: Boolean, default: false },
  delivered_at: { type: Date, default: null },
  read: { type: Boolean, default: false },
  read_at: { type: Date, default: null }
}, { timestamps: true });

const oneTimeLinkSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  identity_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Identity', required: true },
  expires_at: { type: Date, required: true },
  used: { type: Boolean, default: false },
  use_count: { type: Number, default: 0 },
  max_uses: { type: Number, default: 5 }
}, { timestamps: true });

const deviceSchema = new mongoose.Schema({
  identity_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Identity', required: true },
  device_id: { type: String, required: true, unique: true },
  device_name: { type: String, required: true },
  device_model: { type: String, required: true },
  platform: { type: String, required: true }, // 'android', 'ios', 'macos'
  os_version: { type: String, required: true },
  app_version: { type: String, required: true },
  last_active: { type: Date, default: Date.now }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Identity = mongoose.model('Identity', identitySchema);
const Chat = mongoose.model('Chat', chatSchema);
const ChatSettings = mongoose.model('ChatSettings', chatSettingsSchema);
const Message = mongoose.model('Message', messageSchema);
const OneTimeLink = mongoose.model('OneTimeLink', oneTimeLinkSchema);
const Device = mongoose.model('Device', deviceSchema);

function generateUsername() {
  const adjectives = ['Silent', 'Ghost', 'Shadow', 'Phantom', 'Mystic', 'Cosmic', 'Neon', 'Cyber'];
  const nouns = ['Wolf', 'Raven', 'Fox', 'Tiger', 'Dragon', 'Phoenix', 'Viper', 'Hawk'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 9999);
  return `${adj}${noun}${num}`;
}

function generateSeed() {
  return Math.random().toString(36).substring(2, 15);
}

function isValidUsername(username) {
  const regex = /^[a-zA-Z0-9_]{4,16}$/;
  return regex.test(username);
}

app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('📡 POST /api/auth/register');
    console.log('📦 Request body:', JSON.stringify(req.body));
    
    const { device_id, public_key } = req.body;
    
    if (!device_id || !public_key) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'Missing device_id or public_key' });
    }
    
    console.log('📦 Device ID:', device_id);
    
    let user = await User.findOne({ device_id });
    
    if (!user) {
      console.log('🆕 Creating new user...');
      user = new User({ device_id, ephemeral_identity_enabled: false });
      
      try {
        await user.save();
        console.log('✅ User saved');
      } catch (saveError) {
        if (saveError.code === 11000) {
          console.log('⚠️ Duplicate key, refetching user...');
          user = await User.findOne({ device_id });
        } else {
          throw saveError;
        }
      }
      
      if (user && !user.current_identity_id) {
        const username = generateUsername();
        const identity = new Identity({
          user_id: user._id,
          username: username,
          avatar: '',
          bio: '',
          public_key,
          is_active: true,
          expires_at: null
        });
        await identity.save();
        user.current_identity_id = identity._id;
        await user.save();
        console.log('✅ New identity created:', identity.username);
      }
    } else {
      console.log('👤 Existing user found');
      
      // Check if user has a valid identity
      let identity = null;
      if (user.current_identity_id) {
        identity = await Identity.findById(user.current_identity_id);
      }
      
      // If identity doesn't exist (was deleted), create a new one
      if (!identity) {
        console.log('⚠️ User exists but identity missing - creating new identity');
        const username = generateUsername();
        identity = new Identity({
          user_id: user._id,
          username: username,
          avatar: '',
          bio: '',
          public_key,
          is_active: true,
          expires_at: null
        });
        await identity.save();
        user.current_identity_id = identity._id;
        await user.save();
        console.log('✅ New identity created for existing user:', identity.username);
      }
    }
    
    if (!user) {
      throw new Error('User not found after creation');
    }

    const identity = await Identity.findById(user.current_identity_id);
    
    if (!identity) {
      throw new Error('Identity not found');
    }
    
    const response = {
      user_id: user._id.toString(),
      identity: {
        _id: identity._id.toString(),
        username: identity.username,
        avatar: identity.avatar || '',
        bio: identity.bio || '',
        expires_at: identity.expires_at
      }
    };
    
    console.log('✅ Registration successful');
    console.log('📤 Response:', JSON.stringify(response));
    res.status(200).json(response);
  } catch (error) {
    console.error('❌ Registration error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Registration failed',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.post('/api/auth/toggle-ephemeral', async (req, res) => {
  try {
    const { device_id, enabled } = req.body;
    const user = await User.findOne({ device_id });
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.ephemeral_identity_enabled = enabled;
    await user.save();

    if (enabled) {
      await Identity.updateMany({ user_id: user._id }, { is_active: false });
      const newIdentity = new Identity({
        user_id: user._id,
        username: generateUsername(),
        avatar: '',
        bio: '',
        public_key: generateSeed(),
        is_active: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      await newIdentity.save();
      user.current_identity_id = newIdentity._id;
      await user.save();
    } else {
      await Identity.findByIdAndUpdate(user.current_identity_id, { expires_at: null });
    }

    res.json({ success: true, ephemeral_enabled: enabled });
  } catch (error) {
    console.error('❌ Toggle ephemeral error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat/create', async (req, res) => {
  try {
    const { identity_ids, is_group } = req.body;
    const chat = new Chat({ participants: identity_ids, is_group: is_group || false });
    await chat.save();
    res.json(chat);
  } catch (error) {
    console.error('❌ Create chat error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/chat/user/:identity_id', async (req, res) => {
  try {
    const { identity_id } = req.params;
    const chats = await Chat.find({ participants: identity_id }).populate('participants');
    res.json(chats);
  } catch (error) {
    console.error('❌ Get chats error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/identity/check-username/:username', async (req, res) => {
  try {
    console.log('📡 GET /api/identity/check-username/:username');
    const { username } = req.params;
    console.log('📦 Username:', username);
    
    if (!isValidUsername(username)) {
      console.log('❌ Invalid username format');
      return res.json({ available: false, error: 'Invalid format (4-16 chars, a-z, 0-9, _)' });
    }
    
    const existing = await Identity.findOne({ username: username, is_active: true });
    
    if (existing) {
      console.log('❌ Username taken');
      res.json({ available: false });
    } else {
      console.log('✅ Username available');
      res.json({ available: true });
    }
  } catch (error) {
    console.error('❌ Check username error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/identity/search/:username', async (req, res) => {
  try {
    console.log('📡 GET /api/identity/search/:username');
    const { username } = req.params;
    const { current_identity_id } = req.query;
    console.log('📦 Username:', username);
    console.log('📦 Excluding:', current_identity_id || 'none');
    
    // Убираем @ если есть
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    
    // Создаем фильтр для поиска
    const filter = {
      username: new RegExp(`^${cleanUsername}`, 'i'), // case-insensitive, начинается с query
      is_active: true
    };
    
    // Исключаем текущего пользователя из результатов
    if (current_identity_id) {
      filter._id = { $ne: current_identity_id };
    }
    
    const identities = await Identity.find(filter).limit(20);
    
    console.log(`✅ Found ${identities.length} results`);
    
    // Return with avatar_updated_at as timestamp
    const results = identities.map(identity => ({
      _id: identity._id.toString(),
      username: identity.username,
      avatar: identity.avatar || '',
      avatar_updated_at: identity.avatar_updated_at ? identity.avatar_updated_at.getTime() : null,
      bio: identity.bio || '',
      expires_at: identity.expires_at
    }));
    
    res.json({ results });
  } catch (error) {
    console.error('❌ Search error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/identity/update', async (req, res) => {
  try {
    console.log('📡 POST /api/identity/update');
    console.log('📦 Body:', req.body);
    
    const { identity_id, username, bio, avatar } = req.body;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(identity_id)) {
      console.log('❌ Invalid ObjectId format:', identity_id);
      console.log('🔍 Searching all identities...');
      const allIdentities = await Identity.find({}).limit(5);
      console.log('📋 Sample identities:', allIdentities.map(i => ({ id: i._id.toString(), username: i.username })));
      return res.status(400).json({ error: 'Invalid identity_id format' });
    }
    
    const updates = {};
    if (bio !== undefined) updates.bio = bio;
    if (avatar !== undefined) {
      updates.avatar = avatar;
      updates.avatar_updated_at = new Date();
      console.log('📸 Avatar updated, size:', avatar.length, 'chars');
    }
    
    if (username) {
      if (!isValidUsername(username)) {
        console.log('❌ Invalid username format');
        return res.status(400).json({ error: 'Invalid username format (4-16 chars, a-z, 0-9, _)' });
      }
      const existingUsername = await Identity.findOne({ username: username, _id: { $ne: identity_id } });
      if (existingUsername) {
        console.log('❌ Username already taken:', username);
        return res.status(400).json({ error: 'Username already taken' });
      }
      updates.username = username;
    }
    
    const identity = await Identity.findByIdAndUpdate(identity_id, updates, { new: true });
    
    if (!identity) {
      console.log('❌ Identity not found:', identity_id);
      console.log('🔍 Searching all identities...');
      const allIdentities = await Identity.find({}).limit(5);
      console.log('📋 Sample identities:', allIdentities.map(i => ({ id: i._id.toString(), username: i.username })));
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    console.log('✅ Profile updated:', identity.username);
    
    // Return with avatar_updated_at as timestamp
    const response = {
      _id: identity._id.toString(),
      username: identity.username,
      avatar: identity.avatar || '',
      avatar_updated_at: identity.avatar_updated_at ? identity.avatar_updated_at.getTime() : null,
      bio: identity.bio || '',
      expires_at: identity.expires_at
    };
    
    res.json(response);
  } catch (error) {
    console.error('❌ Update error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/identity/upload-avatar', async (req, res) => {
  try {
    console.log('📡 POST /api/identity/upload-avatar');
    const { identity_id, avatar } = req.body;
    console.log('📦 Identity ID:', identity_id);
    console.log('📦 Avatar size:', avatar ? avatar.length : 0, 'chars');
    
    if (!avatar) {
      return res.status(400).json({ error: 'No avatar provided' });
    }
    
    const identity = await Identity.findByIdAndUpdate(
      identity_id, 
      { 
        avatar: avatar,
        avatar_updated_at: new Date()
      }, 
      { new: true }
    );
    
    if (!identity) {
      console.log('❌ Identity not found');
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    console.log('✅ Avatar uploaded, updated_at:', identity.avatar_updated_at);
    res.json({ 
      success: true, 
      identity: {
        _id: identity._id.toString(),
        username: identity.username,
        avatar: identity.avatar,
        avatar_updated_at: identity.avatar_updated_at ? identity.avatar_updated_at.getTime() : null,
        bio: identity.bio
      }
    });
  } catch (error) {
    console.error('❌ Upload avatar error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/identity/generate-link', async (req, res) => {
  try {
    console.log('📡 POST /api/identity/generate-link');
    const { identity_id } = req.body;
    console.log('📦 Identity ID:', identity_id);
    
    const token = generateSeed() + generateSeed();
    const link = new OneTimeLink({
      token,
      identity_id,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      used: false,
      use_count: 0,
      max_uses: 5
    });
    await link.save();
    
    const linkUrl = `https://weeky-six.vercel.app/api/u/${token}`;
    console.log('✅ Link generated:', linkUrl);
    res.json({ url: linkUrl });
  } catch (error) {
    console.error('❌ Generate link error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/invite/preview/:token', async (req, res) => {
  try {
    console.log('📡 GET /api/invite/preview/:token');
    const { token } = req.params;
    console.log('📦 Token:', token);
    
    const link = await OneTimeLink.findOne({ token });
    
    if (!link) {
      console.log('❌ Link not found');
      return res.status(404).json({ error: 'Link not found' });
    }
    
    if (link.use_count >= link.max_uses) {
      console.log('❌ Link max uses reached');
      return res.status(400).json({ error: 'Link max uses reached' });
    }
    
    if (link.expires_at < new Date()) {
      console.log('❌ Link expired');
      return res.status(400).json({ error: 'Link expired' });
    }
    
    const identity = await Identity.findById(link.identity_id);
    
    if (!identity) {
      console.log('❌ Identity not found');
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    console.log(`✅ Link preview loaded - ${link.use_count}/${link.max_uses} uses`);
    res.json({ identity: identity, uses_left: link.max_uses - link.use_count });
  } catch (error) {
    console.error('❌ Preview link error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Alias for new API path
app.get('/api/identity/invite/preview/:token', async (req, res) => {
  try {
    console.log('📡 GET /api/identity/invite/preview/:token');
    const { token } = req.params;
    console.log('📦 Token:', token);
    
    const link = await OneTimeLink.findOne({ token });
    
    if (!link) {
      console.log('❌ Link not found');
      return res.status(404).json({ error: 'Link not found' });
    }
    
    if (link.use_count >= link.max_uses) {
      console.log('❌ Link max uses reached');
      return res.status(400).json({ error: 'Link max uses reached' });
    }
    
    if (link.expires_at < new Date()) {
      console.log('❌ Link expired');
      return res.status(400).json({ error: 'Link expired' });
    }
    
    const identity = await Identity.findById(link.identity_id);
    
    if (!identity) {
      console.log('❌ Identity not found');
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    console.log(`✅ Link preview loaded - ${link.use_count}/${link.max_uses} uses`);
    res.json({ identity: identity, uses_left: link.max_uses - link.use_count });
  } catch (error) {
    console.error('❌ Preview link error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/invite/:token', async (req, res) => {
  try {
    console.log('📡 GET /api/invite/:token (CONSUME)');
    const { token } = req.params;
    console.log('📦 Token:', token);
    
    const link = await OneTimeLink.findOne({ token });
    
    if (!link) {
      console.log('❌ Link not found');
      return res.status(404).json({ error: 'Link not found' });
    }
    
    if (link.use_count >= link.max_uses) {
      console.log('❌ Link max uses reached');
      return res.status(400).json({ error: 'Link max uses reached' });
    }
    
    if (link.expires_at < new Date()) {
      console.log('❌ Link expired');
      return res.status(400).json({ error: 'Link expired' });
    }
    
    const identity = await Identity.findById(link.identity_id);
    
    if (!identity) {
      console.log('❌ Identity not found');
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    link.use_count += 1;
    if (link.use_count >= link.max_uses) {
      link.used = true;
    }
    await link.save();
    
    console.log(`✅ Link consumed successfully - ${link.use_count}/${link.max_uses}`);
    res.json({ identity: identity, uses_left: link.max_uses - link.use_count });
  } catch (error) {
    console.error('❌ Use link error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/u/:token', async (req, res) => {
  try {
    console.log('📡 GET /api/u/:token');
    const { token } = req.params;
    console.log('📦 Token:', token);
    
    const link = await OneTimeLink.findOne({ token });
    
    if (!link) {
      console.log('❌ Link not found');
      return res.send('<html><body style="background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1>Ссылка не найдена</h1><p>Эта ссылка недействительна</p></div></body></html>');
    }
    
    if (link.use_count >= link.max_uses) {
      console.log('❌ Link max uses reached');
      return res.send('<html><body style="background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1>Ссылка исчерпана</h1><p>Эта ссылка была использована максимальное количество раз (5)</p></div></body></html>');
    }
    
    if (link.expires_at < new Date()) {
      console.log('❌ Link expired');
      return res.send('<html><body style="background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1>Ссылка истекла</h1><p>Срок действия этой ссылки истёк (24 часа)</p></div></body></html>');
    }
    
    const identity = await Identity.findById(link.identity_id);
    
    if (!identity) {
      console.log('❌ Identity not found');
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    link.use_count += 1;
    if (link.use_count >= link.max_uses) {
      link.used = true;
    }
    await link.save();
    
    console.log(`✅ Link used successfully - ${link.use_count}/${link.max_uses}`);
    
    // Генерируем HTML с аватаркой если есть
    const avatarHtml = identity.avatar 
      ? `<img src="data:image/jpeg;base64,${identity.avatar}" class="avatar" alt="${identity.username}">`
      : `<div class="avatar">${identity.username.substring(0,2).toUpperCase()}</div>`;
    
    res.send(`<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${identity.username} - Jemmy</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}.container{text-align:center;max-width:400px;width:100%}.avatar{width:120px;height:120px;border-radius:60px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:48px;font-weight:600;color:#fff;object-fit:cover}h1{font-size:32px;font-weight:600;margin-bottom:12px}.bio{font-size:17px;color:rgba(255,255,255,0.6);line-height:1.5;margin-bottom:32px}.button{display:block;width:100%;padding:18px;background:rgba(52,199,89,0.8);color:#fff;text-decoration:none;border-radius:16px;font-size:19px;font-weight:600;transition:all 0.2s;border:none;cursor:pointer}.button:hover{background:rgba(52,199,89,1);transform:scale(1.02)}.button:active{transform:scale(0.98)}.footer{margin-top:32px;font-size:15px;color:rgba(255,255,255,0.4)}.logo{font-size:24px;font-weight:700;margin-bottom:8px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}</style></head><body><div class="container">${avatarHtml}<h1>${identity.username}</h1>${identity.bio ? `<p class="bio">${identity.bio}</p>` : ''}<button class="button" onclick="window.location.href='jemmy://invite/${token}'">💬 Открыть в Jemmy</button><div class="footer"><div class="logo">Jemmy</div><p>Анонимный мессенджер</p></div></div></body></html>`);
  } catch (error) {
    console.error('❌ Use link error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/identity/use-link', async (req, res) => {
  try {
    const { token, my_identity_id } = req.body;
    const link = await OneTimeLink.findOne({ token });
    
    if (!link || link.expires_at < new Date()) {
      return res.status(404).json({ error: 'Link expired or invalid' });
    }
    
    if (link.use_count >= link.max_uses) {
      return res.status(400).json({ error: 'Link max uses reached' });
    }
    
    const chat = new Chat({ participants: [link.identity_id, my_identity_id], is_group: false });
    await chat.save();
    
    link.use_count += 1;
    if (link.use_count >= link.max_uses) {
      link.used = true;
    }
    await link.save();
    
    res.json({ chat_id: chat._id, uses_left: link.max_uses - link.use_count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat/start', async (req, res) => {
  try {
    console.log('📡 POST /api/chat/start');
    const { token, my_identity_id } = req.body;
    console.log('📦 Token:', token);
    console.log('📦 My Identity ID:', my_identity_id);
    
    if (!token || !my_identity_id) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'Missing token or my_identity_id' });
    }
    
    const link = await OneTimeLink.findOne({ token });
    
    if (!link) {
      console.log('❌ Link not found');
      return res.status(404).json({ error: 'Link not found' });
    }
    
    if (link.expires_at < new Date()) {
      console.log('❌ Link expired');
      return res.status(400).json({ error: 'Link expired' });
    }
    
    if (link.use_count >= link.max_uses) {
      console.log('❌ Link max uses reached');
      return res.status(400).json({ error: 'Link max uses reached' });
    }
    
    // Check if chat already exists
    const existingChat = await Chat.findOne({
      participants: { $all: [link.identity_id, my_identity_id] },
      is_group: false
    });
    
    if (existingChat) {
      console.log('✅ Chat already exists:', existingChat._id);
      const otherIdentity = await Identity.findById(link.identity_id);
      return res.json({
        chat_id: existingChat._id.toString(),
        other_user: {
          _id: otherIdentity._id.toString(),
          username: otherIdentity.username,
          avatar: otherIdentity.avatar,
          bio: otherIdentity.bio
        }
      });
    }
    
    // Create new chat
    const chat = new Chat({ 
      participants: [link.identity_id, my_identity_id], 
      is_group: false 
    });
    await chat.save();
    
    link.use_count += 1;
    if (link.use_count >= link.max_uses) {
      link.used = true;
    }
    await link.save();
    
    const otherIdentity = await Identity.findById(link.identity_id);
    
    console.log('✅ Chat created:', chat._id);
    res.json({
      chat_id: chat._id.toString(),
      other_user: {
        _id: otherIdentity._id.toString(),
        username: otherIdentity.username,
        avatar: otherIdentity.avatar,
        bio: otherIdentity.bio
      }
    });
  } catch (error) {
    console.error('❌ Start chat error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Create chat directly by identity IDs (for search feature)
app.post('/api/chat/direct', async (req, res) => {
  try {
    console.log('📡 POST /api/chat/direct');
    const { my_identity_id, other_identity_id } = req.body;
    console.log('📦 My Identity ID:', my_identity_id);
    console.log('📦 Other Identity ID:', other_identity_id);
    
    if (!my_identity_id || !other_identity_id) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'Missing identity IDs' });
    }
    
    // Check if chat already exists
    const existingChat = await Chat.findOne({
      participants: { $all: [my_identity_id, other_identity_id] },
      is_group: false
    });
    
    if (existingChat) {
      console.log('✅ Chat already exists:', existingChat._id);
      const otherIdentity = await Identity.findById(other_identity_id);
      return res.json({
        chat_id: existingChat._id.toString(),
        other_user: {
          _id: otherIdentity._id.toString(),
          username: otherIdentity.username,
          avatar: otherIdentity.avatar,
          bio: otherIdentity.bio
        }
      });
    }
    
    // Create new chat
    const chat = new Chat({ 
      participants: [my_identity_id, other_identity_id], 
      is_group: false 
    });
    await chat.save();
    
    const otherIdentity = await Identity.findById(other_identity_id);
    
    console.log('✅ Chat created:', chat._id);
    res.json({
      chat_id: chat._id.toString(),
      other_user: {
        _id: otherIdentity._id.toString(),
        username: otherIdentity.username,
        avatar: otherIdentity.avatar,
        bio: otherIdentity.bio
      }
    });
  } catch (error) {
    console.error('❌ Direct chat error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get all chats for user
app.get('/api/chats', async (req, res) => {
  try {
    console.log('📡 GET /api/chats');
    const { identity_id } = req.query;
    console.log('📦 Identity ID:', identity_id);
    
    if (!identity_id) {
      console.log('❌ Missing identity_id');
      return res.status(400).json({ error: 'Missing identity_id' });
    }
    
    const chats = await Chat.find({ participants: identity_id }).sort({ updatedAt: -1 });
    
    const chatList = await Promise.all(chats.map(async (chat) => {
      const otherUserId = chat.participants.find(p => p.toString() !== identity_id);
      const otherUser = await Identity.findById(otherUserId);
      
      if (!otherUser) {
        return null;
      }
      
      const lastMessage = await Message.findOne({ chat_id: chat._id }).sort({ createdAt: -1 });
      
      const messageTime = lastMessage ? lastMessage.createdAt : chat.createdAt;
      
      // Load chat settings for this user
      const settings = await ChatSettings.findOne({ chat_id: chat._id, identity_id: identity_id });
      
      return {
        id: chat._id.toString(),
        otherUserId: otherUser._id.toString(),
        lastMessage: lastMessage ? lastMessage.encrypted_content : '',
        lastMessageTime: messageTime.toISOString(),
        isPinned: settings ? settings.is_pinned : false,
        isMuted: settings ? settings.is_muted : false,
        user: {
          _id: otherUser._id.toString(),
          username: otherUser.username,
          avatar: otherUser.avatar,
          avatarUpdatedAt: otherUser.avatar_updated_at ? otherUser.avatar_updated_at.getTime() : null,
          bio: otherUser.bio
        }
      };
    }));
    
    // Remove nulls and duplicates (keep only latest chat per user)
    const filteredChats = chatList.filter(c => c !== null);
    const uniqueChats = [];
    const seenUsers = new Set();
    
    for (const chat of filteredChats) {
      if (!seenUsers.has(chat.otherUserId)) {
        seenUsers.add(chat.otherUserId);
        uniqueChats.push({
          id: chat.id,
          lastMessage: chat.lastMessage,
          lastMessageTime: chat.lastMessageTime,
          isPinned: chat.isPinned,
          isMuted: chat.isMuted,
          user: chat.user
        });
      }
    }
    
    console.log('📥 chats loaded:', uniqueChats.length);
    res.json(uniqueChats);
  } catch (error) {
    console.error('❌ Get chats error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Toggle pin chat
app.post('/api/chats/:chat_id/pin', async (req, res) => {
  try {
    console.log('📡 POST /api/chats/:chat_id/pin');
    const { chat_id } = req.params;
    const { identity_id, is_pinned } = req.body;
    console.log('📦 Chat ID:', chat_id, 'Identity ID:', identity_id, 'Pin:', is_pinned);
    
    if (!identity_id) {
      return res.status(400).json({ error: 'Missing identity_id' });
    }
    
    // Upsert chat settings
    const settings = await ChatSettings.findOneAndUpdate(
      { chat_id, identity_id },
      { is_pinned },
      { upsert: true, new: true }
    );
    
    console.log('✅ Chat pin toggled:', is_pinned);
    res.json({ success: true, is_pinned: settings.is_pinned });
  } catch (error) {
    console.error('❌ Toggle pin error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Toggle mute chat
app.post('/api/chats/:chat_id/mute', async (req, res) => {
  try {
    console.log('📡 POST /api/chats/:chat_id/mute');
    const { chat_id } = req.params;
    const { identity_id, is_muted } = req.body;
    console.log('📦 Chat ID:', chat_id, 'Identity ID:', identity_id, 'Mute:', is_muted);
    
    if (!identity_id) {
      return res.status(400).json({ error: 'Missing identity_id' });
    }
    
    // Upsert chat settings
    const settings = await ChatSettings.findOneAndUpdate(
      { chat_id, identity_id },
      { is_muted },
      { upsert: true, new: true }
    );
    
    console.log('✅ Chat mute toggled:', is_muted);
    res.json({ success: true, is_muted: settings.is_muted });
  } catch (error) {
    console.error('❌ Toggle mute error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Search identity by username
app.get('/api/identity/:identity_id', async (req, res) => {
  try {
    console.log('📡 GET /api/identity/:identity_id');
    const { identity_id } = req.params;
    console.log('📦 Identity ID:', identity_id);
    
    const identity = await Identity.findById(identity_id);
    
    if (!identity) {
      console.log('❌ Identity not found:', identity_id);
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    console.log('✅ Profile loaded:', identity.username);
    
    // Return with avatar_updated_at as timestamp
    const response = {
      _id: identity._id.toString(),
      username: identity.username,
      avatar: identity.avatar || '',
      avatar_updated_at: identity.avatar_updated_at ? identity.avatar_updated_at.getTime() : null,
      bio: identity.bio || '',
      expires_at: identity.expires_at,
      last_seen: identity.last_seen
    };
    
    res.json(response);
  } catch (error) {
    console.error('❌ Get profile error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Check if device exists in database
app.get('/api/auth/check-device/:deviceId', async (req, res) => {
  try {
    console.log('📡 GET /api/auth/check-device/:deviceId');
    const { deviceId } = req.params;
    console.log('📦 Device ID:', deviceId);
    
    const user = await User.findOne({ device_id: deviceId });
    
    if (!user) {
      console.log('❌ User not found');
      return res.json({ exists: false });
    }
    
    const identity = await Identity.findById(user.current_identity_id);
    
    if (!identity) {
      console.log('❌ Identity not found');
      return res.json({ exists: false });
    }
    
    console.log('✅ Device found:', identity.username);
    res.json({
      exists: true,
      user_id: user._id.toString(),
      identity: {
        _id: identity._id.toString(),
        username: identity.username,
        avatar: identity.avatar || '',
        bio: identity.bio || '',
        expires_at: identity.expires_at
      }
    });
  } catch (error) {
    console.error('❌ Check device error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/account/delete', async (req, res) => {
  try {
    console.log('📡 POST /api/account/delete');
    const { device_id } = req.body;
    console.log('📦 Device ID:', device_id);
    console.log('📦 Device ID type:', typeof device_id);
    console.log('📦 Device ID length:', device_id?.length);
    
    // Debug: show sample users
    const sampleUsers = await User.find({}).limit(3);
    console.log('👥 Sample users in DB:', sampleUsers.map(u => ({ 
      id: u._id.toString(), 
      device_id: u.device_id,
      device_id_length: u.device_id?.length 
    })));
    
    const user = await User.findOne({ device_id });
    
    if (!user) {
      console.log('❌ User not found:', device_id);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('✅ Found user:', user._id);
    
    await Identity.deleteMany({ user_id: user._id });
    console.log('🗑️ Identities deleted');
    
    const identities = await Identity.find({ user_id: user._id });
    const identityIds = identities.map(i => i._id);
    await Chat.deleteMany({ participants: { $in: identityIds } });
    console.log('🗑️ Chats deleted');
    
    await User.deleteOne({ _id: user._id });
    console.log('🗑️ User deleted');
    
    console.log('✅ Account deleted successfully');
    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    console.error('❌ Delete account error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/message', async (req, res) => {
  try {
    console.log('📡 POST /api/message');
    const { chat_id, sender_identity_id, text, client_time } = req.body;
    console.log('📦 Chat ID:', chat_id);
    console.log('📦 Sender:', sender_identity_id);
    console.log('📤 Text:', text);
    console.log('⏱️ Client time:', client_time);
    
    if (!chat_id || !sender_identity_id || !text) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get chat participants
    const chat = await Chat.findById(chat_id);
    if (!chat) {
      console.log('❌ Chat not found');
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    // Find receiver (other participant)
    const receiverId = chat.participants.find(p => p.toString() !== sender_identity_id);
    if (!receiverId) {
      console.log('❌ Receiver not found');
      return res.status(400).json({ error: 'Receiver not found' });
    }
    
    // Check if sender is blocked by receiver
    const receiverIdentity = await Identity.findById(receiverId);
    if (receiverIdentity && receiverIdentity.blocked_users && receiverIdentity.blocked_users.includes(sender_identity_id)) {
      console.log('🚫 Sender is blocked by receiver');
      return res.status(403).json({ error: 'blocked', message: 'You are blocked by this user' });
    }
    
    // Check receiver's privacy settings
    if (receiverIdentity && receiverIdentity.privacy_settings) {
      const whoCanMessage = receiverIdentity.privacy_settings.who_can_message || 'everyone';
      if (whoCanMessage === 'nobody') {
        console.log('🚫 Receiver does not accept messages from anyone');
        return res.status(403).json({ error: 'privacy', message: 'This user does not accept messages' });
      }
    }
    
    const message = new Message({
      chat_id,
      sender_identity_id,
      encrypted_content: text,
      type: 'text'
    });
    await message.save();
    
    // Update chat timestamp
    await Chat.findByIdAndUpdate(chat_id, { updatedAt: new Date() });
    
    // console.log('✅ Message sent:', message._id);
    
    const messageResponse = {
      _id: message._id.toString(),
      chat_id: message.chat_id.toString(),
      sender_identity_id: message.sender_identity_id.toString(),
      encrypted_content: message.encrypted_content,
      type: message.type,
      delivered: message.delivered,
      delivered_at: message.delivered_at,
      read: message.read,
      read_at: message.read_at,
      client_time: client_time || null,
      server_time: message.createdAt.getTime(),
      createdAt: message.createdAt.toISOString()
    };
    
    // Emit via WebSocket
    io.to(`chat:${chat_id}`).emit('receive_message', messageResponse);
    
    res.json(messageResponse);
  } catch (error) {
    console.error('❌ Send message error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    console.log('📡 GET /api/messages');
    const { chat_id } = req.query;
    console.log('📦 Chat ID:', chat_id);
    
    if (!chat_id) {
      console.log('❌ Missing chat_id');
      return res.status(400).json({ error: 'Missing chat_id' });
    }
    
    const messages = await Message.find({ chat_id }).sort({ createdAt: 1 });
    
    const messagesFormatted = messages.map(msg => ({
      _id: msg._id.toString(),
      chat_id: msg.chat_id.toString(),
      sender_identity_id: msg.sender_identity_id.toString(),
      encrypted_content: msg.encrypted_content,
      type: msg.type,
      delivered: msg.delivered,
      delivered_at: msg.delivered_at,
      read: msg.read,
      read_at: msg.read_at,
      server_time: msg.createdAt.getTime(),
      createdAt: msg.createdAt.toISOString()
    }));
    
    console.log(`✅ Messages loaded: ${messagesFormatted.length} (with read/delivered status from DB)`);
    res.json(messagesFormatted);
  } catch (error) {
    console.error('❌ Get messages error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/chat/:chat_id', async (req, res) => {
  try {
    console.log('📡 DELETE /api/chat/:chat_id');
    const { chat_id } = req.params;
    console.log('📦 Chat ID:', chat_id);
    
    if (!chat_id) {
      console.log('❌ Missing chat_id');
      return res.status(400).json({ error: 'Missing chat_id' });
    }
    
    // Delete all messages in the chat
    const deletedMessages = await Message.deleteMany({ chat_id });
    console.log(`🗑️ Deleted ${deletedMessages.deletedCount} messages`);
    
    // Delete the chat
    const deletedChat = await Chat.findByIdAndDelete(chat_id);
    
    if (!deletedChat) {
      console.log('❌ Chat not found');
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    console.log('✅ Chat deleted successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete chat error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/user/status/:identity_id', async (req, res) => {
  try {
    const { identity_id } = req.params;
    const isOnline = onlineUsers.has(identity_id);
    
    // Если онлайн - берем текущий timestamp, если оффлайн - из БД
    let lastSeen = 0;
    if (isOnline) {
      lastSeen = onlineUsers.get(identity_id) || Date.now();
    } else {
      const identity = await Identity.findById(identity_id);
      if (identity && identity.last_seen) {
        lastSeen = identity.last_seen.getTime();
      }
    }
    
    res.json({ 
      identity_id, 
      online: isOnline, 
      last_seen: lastSeen 
    });
  } catch (error) {
    console.error('❌ Get status error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const userSockets = new Map(); // identity_id -> socket.id
const onlineUsers = new Map(); // identity_id -> last_seen timestamp

io.on('connection', (socket) => {
  console.log(`🔌 WebSocket connected: ${socket.id}`);

  socket.on('register', async (data) => {
    const { identity_id } = data;
    
    console.log(`📝 User CONNECTING: ${identity_id}`);
    
    // Store socket mapping
    userSockets.set(identity_id, socket.id);
    socket.join(`user:${identity_id}`);
    
    // Mark user as online and update DB
    const timestamp = Date.now();
    onlineUsers.set(identity_id, timestamp);
    
    try {
      await Identity.findByIdAndUpdate(identity_id, { 
        last_seen: new Date(timestamp) 
      });
      console.log(`💾 Updated last_seen in DB for ${identity_id}: ${timestamp}`);
    } catch (error) {
      console.error(`❌ Error updating DB:`, error);
    }
    
    // Broadcast online status to all users
    const statusData = { identity_id, online: true, last_seen: timestamp };
    console.log(`📡 Broadcasting ONLINE status: ${identity_id}`);
    io.emit('user_status', statusData);
    
    console.log(`✅ User ONLINE: ${identity_id} | Total online: ${onlineUsers.size}`);
  });

  socket.on('join_chat', (data) => {
    const { chat_id } = data;
    socket.join(`chat:${chat_id}`);
    console.log(`🚪 Socket ${socket.id} joined chat room: chat:${chat_id}`);
  });

  socket.on('send_message', async (data) => {
    try {
      if (!mongoConnected) {
        socket.emit('error', { message: 'MongoDB не подключена' });
        return;
      }
      
      // Get chat participants
      const chat = await Chat.findById(data.chat_id);
      if (!chat) {
        socket.emit('error', { message: 'Chat not found' });
        return;
      }
      
      // Find receiver (other participant)
      const receiverId = chat.participants.find(p => p.toString() !== data.sender_identity_id);
      if (!receiverId) {
        socket.emit('error', { message: 'Receiver not found' });
        return;
      }
      
      // Check if sender is blocked by receiver
      const receiverIdentity = await Identity.findById(receiverId);
      if (receiverIdentity && receiverIdentity.blocked_users && receiverIdentity.blocked_users.includes(data.sender_identity_id)) {
        console.log('🚫 Sender is blocked by receiver');
        socket.emit('message_blocked', { 
          reason: 'blocked',
          message: 'You are blocked by this user' 
        });
        return;
      }
      
      // Check receiver's privacy settings
      if (receiverIdentity && receiverIdentity.privacy_settings) {
        const whoCanMessage = receiverIdentity.privacy_settings.who_can_message || 'everyone';
        if (whoCanMessage === 'nobody') {
          console.log('🚫 Receiver does not accept messages from anyone');
          socket.emit('message_blocked', { 
            reason: 'privacy',
            message: 'This user does not accept messages' 
          });
          return;
        }
      }
      
      const message = new Message({
        chat_id: data.chat_id,
        sender_identity_id: data.sender_identity_id,
        encrypted_content: data.encrypted_content,
        type: data.type || 'text'
      });
      await message.save();

      const messageResponse = {
        _id: message._id.toString(),
        chat_id: message.chat_id.toString(),
        sender_identity_id: message.sender_identity_id.toString(),
        encrypted_content: message.encrypted_content,
        type: message.type,
        delivered: message.delivered,
        delivered_at: message.delivered_at,
        read: message.read,
        read_at: message.read_at,
        client_time: data.client_time || null,
        server_time: message.createdAt.getTime(),
        createdAt: message.createdAt.toISOString()
      };

      // Отправляем сообщение всем в чате
      io.to(`chat:${data.chat_id}`).emit('receive_message', messageResponse);
      
      // Автоматически помечаем как delivered для всех кто в чате (кроме отправителя)
      setTimeout(async () => {
        try {
          await Message.findByIdAndUpdate(message._id, {
            delivered: true,
            delivered_at: new Date()
          });
          
          console.log(`✅ Auto-marked message ${message._id} as delivered`);
          
          // Отправляем обновление статуса
          io.to(`chat:${data.chat_id}`).emit('message_status_update', {
            message_id: message._id.toString(),
            delivered: true,
            delivered_at: new Date(),
            read: false,
            read_at: null
          });
        } catch (err) {
          console.error('❌ Error auto-marking delivered:', err);
        }
      }, 100); // Небольшая задержка чтобы сообщение успело дойти
      
    } catch (error) {
      console.error('❌ Send message error:', error);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('typing', (data) => {
    socket.to(`chat:${data.chat_id}`).emit('typing', data);
  });
  
  // Mark message as delivered
  socket.on('message_delivered', async (data) => {
    try {
      const { message_id, chat_id } = data;
      
      const message = await Message.findById(message_id);
      if (!message) {
        console.log(`⚠️ Message ${message_id} not found`);
        return;
      }
      
      message.delivered = true;
      message.delivered_at = new Date();
      await message.save();
      
      console.log(`✅ Message ${message_id} marked as delivered`);
      io.to(`chat:${chat_id}`).emit('message_status_update', {
        message_id,
        delivered: true,
        delivered_at: message.delivered_at,
        read: message.read,
        read_at: message.read_at
      });
    } catch (error) {
      console.error('❌ Error marking message as delivered:', error);
    }
  });
  
  // Mark message as read
  socket.on('message_read', async (data) => {
    try {
      const { message_id, chat_id } = data;
      
      const message = await Message.findById(message_id);
      if (!message) {
        console.log(`⚠️ Message ${message_id} not found`);
        return;
      }
      
      message.delivered = true;
      message.delivered_at = message.delivered_at || new Date();
      message.read = true;
      message.read_at = new Date();
      await message.save();
      
      console.log(`✅ Message ${message_id} marked as read`);
      io.to(`chat:${chat_id}`).emit('message_status_update', {
        message_id,
        delivered: true,
        delivered_at: message.delivered_at,
        read: true,
        read_at: message.read_at
      });
    } catch (error) {
      console.error('❌ Error marking message as read:', error);
    }
  });
  
  // Mark multiple messages as read (batch)
  socket.on('messages_read', async (data) => {
    try {
      const { message_ids, chat_id } = data;
      
      if (!message_ids || !Array.isArray(message_ids) || message_ids.length === 0) {
        console.log('⚠️ No message IDs provided');
        return;
      }
      
      console.log(`📖 Marking ${message_ids.length} messages as read in chat ${chat_id}`);
      
      // Обновляем все сообщения в БД
      const result = await Message.updateMany(
        { _id: { $in: message_ids } },
        { 
          $set: { 
            delivered: true,
            delivered_at: new Date(),
            read: true, 
            read_at: new Date() 
          } 
        }
      );
      
      console.log(`✅ Updated ${result.modifiedCount} messages as read`);
      
      // Отправляем событие всем в чате
      io.to(`chat:${chat_id}`).emit('messages_read', {
        message_ids,
        chat_id
      });
      
      console.log(`📡 Broadcasted messages_read event to chat ${chat_id}`);
    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
    }
  });
  
  // Request online status for specific user
  socket.on('request_status', async (data) => {
    const { identity_id } = data;
    const isOnline = onlineUsers.has(identity_id);
    
    let lastSeen = 0;
    if (isOnline) {
      lastSeen = onlineUsers.get(identity_id) || Date.now();
      console.log(`📊 Status request: ${identity_id} | ONLINE | lastSeen=${lastSeen}`);
    } else {
      // Загружаем из БД если оффлайн
      try {
        const identity = await Identity.findById(identity_id);
        if (identity && identity.last_seen) {
          lastSeen = identity.last_seen.getTime();
          console.log(`📊 Status request: ${identity_id} | OFFLINE | lastSeen=${lastSeen} (from DB)`);
        } else {
          console.log(`📊 Status request: ${identity_id} | OFFLINE | no last_seen in DB`);
        }
      } catch (error) {
        console.error('❌ Error loading last_seen from DB:', error);
      }
    }
    
    const statusData = { 
      identity_id, 
      online: isOnline, 
      last_seen: lastSeen 
    };
    
    console.log(`📤 Sending status to ${socket.id}:`, statusData);
    socket.emit('user_status', statusData);
  });

  // Screenshot notification
  socket.on('screenshot_taken', async (data) => {
    try {
      const { chat_id, taker_identity_id, taker_username } = data;
      
      console.log(`📸 Screenshot taken in chat ${chat_id} by ${taker_username}`);
      
      // Broadcast to all participants in the chat
      io.to(`chat:${chat_id}`).emit('screenshot_notification', {
        chat_id,
        taker_identity_id,
        taker_username,
        timestamp: Date.now()
      });
      
      console.log(`📡 Broadcasted screenshot notification to chat ${chat_id}`);
    } catch (error) {
      console.error('❌ Error handling screenshot notification:', error);
    }
  });

  socket.on('disconnect', async () => {
    console.log(`🔌 Socket disconnecting: ${socket.id}`);
    
    // Find user by socket
    const identity_id = Array.from(userSockets.entries())
      .find(([_, socketId]) => socketId === socket.id)?.[0];
    
    if (identity_id) {
      console.log(`📴 User going OFFLINE: ${identity_id}`);
      userSockets.delete(identity_id);
      
      // Mark as offline with last seen time
      const lastSeen = Date.now();
      onlineUsers.delete(identity_id);
      
      // Сохраняем last_seen в БД
      try {
        await Identity.findByIdAndUpdate(identity_id, { last_seen: new Date(lastSeen) });
        console.log(`💾 Saved last_seen to DB: ${identity_id} = ${lastSeen}`);
      } catch (error) {
        console.error(`❌ Error saving last_seen:`, error);
      }
      
      // Broadcast offline status
      const statusData = { identity_id, online: false, last_seen: lastSeen };
      console.log(`📡 Broadcasting OFFLINE status: ${identity_id}`);
      io.emit('user_status', statusData);
      
      console.log(`❌ User OFFLINE: ${identity_id} | Total online: ${onlineUsers.size}`);
    } else {
      console.log(`⚠️ No identity found for socket ${socket.id}`);
    }
  });
});

setInterval(async () => {
  if (!mongoConnected) return;
  
  try {
    const expiredIdentities = await Identity.find({ expires_at: { $lt: new Date() }, is_active: true });

    if (expiredIdentities.length > 0) {
      console.log(`🔄 Проверка ротации: найдено ${expiredIdentities.length} истекших личностей`);
    }

    for (const identity of expiredIdentities) {
      await Identity.updateMany({ user_id: identity.user_id }, { is_active: false });
      
      const newIdentity = new Identity({
        user_id: identity.user_id,
        username: generateUsername(),
        avatar: '',
        bio: '',
        public_key: generateSeed(),
        is_active: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      await newIdentity.save();

      await User.findByIdAndUpdate(identity.user_id, { current_identity_id: newIdentity._id });
      io.to(`user:${identity.user_id}`).emit('identity_updated', newIdentity);
      console.log(`✅ Личность обновлена: ${newIdentity.username}`);
    }
  } catch (error) {
    console.error('Ошибка ротации личностей:', error);
  }
}, 10 * 60 * 1000);

// ============================================
// PRIVACY SETTINGS ROUTES
// ============================================

// Update privacy settings
app.patch('/api/identity/privacy/update', async (req, res) => {
  try {
    console.log('📡 PATCH /api/identity/privacy/update');
    const { identity_id, settings } = req.body;
    console.log('📦 Identity ID:', identity_id);
    console.log('📦 Settings:', JSON.stringify(settings));
    
    if (!identity_id || !settings) {
      return res.status(400).json({ error: 'Missing identity_id or settings' });
    }
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(identity_id)) {
      console.log('❌ Invalid ObjectId format:', identity_id);
      return res.status(400).json({ error: 'Invalid identity_id format' });
    }
    
    const identity = await Identity.findById(identity_id);
    if (!identity) {
      console.log('❌ Identity not found');
      console.log('🔍 Searching all identities...');
      const allIdentities = await Identity.find({}).limit(5);
      console.log('📋 Sample identities:', allIdentities.map(i => ({ id: i._id.toString(), username: i.username })));
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    // Initialize privacy_settings if not exists
    if (!identity.privacy_settings) {
      identity.privacy_settings = {
        who_can_message: 'everyone',
        who_can_see_profile: 'everyone',
        who_can_see_online: 'everyone',
        who_can_see_last_seen: 'everyone',
        auto_delete_messages: 0,
        screenshot_protection: false
      };
    }
    
    // Update settings
    identity.privacy_settings = {
      ...identity.privacy_settings,
      ...settings
    };
    
    await identity.save();
    
    console.log('✅ Privacy settings updated');
    
    // Broadcast privacy settings change to all active chats with this user
    try {
      const chats = await Chat.find({ participants: identity_id });
      console.log(`📡 Broadcasting privacy_settings_changed to ${chats.length} chats`);
      
      for (const chat of chats) {
        io.to(`chat:${chat._id}`).emit('privacy_settings_changed', {
          identity_id: identity_id,
          username: identity.username,
          privacy_settings: identity.privacy_settings
        });
      }
    } catch (broadcastError) {
      console.error('❌ Error broadcasting privacy settings:', broadcastError);
    }
    
    res.json({
      success: true,
      privacy_settings: identity.privacy_settings
    });
  } catch (error) {
    console.error('❌ Update privacy settings error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get privacy settings
app.get('/api/identity/privacy/:identity_id', async (req, res) => {
  try {
    console.log('📡 GET /api/identity/privacy/:identity_id');
    const { identity_id } = req.params;
    console.log('📦 Identity ID:', identity_id);
    
    const identity = await Identity.findById(identity_id);
    if (!identity) {
      console.log('❌ Identity not found');
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    // Ensure privacy_settings exists with all fields
    if (!identity.privacy_settings) {
      identity.privacy_settings = {
        who_can_message: 'everyone',
        who_can_see_profile: 'everyone',
        who_can_see_online: 'everyone',
        who_can_see_last_seen: 'everyone',
        auto_delete_messages: 0,
        screenshot_protection: false
      };
      await identity.save();
      console.log('✅ Created default privacy settings');
    } else if (identity.privacy_settings.screenshot_protection === undefined) {
      // Migrate old records - add screenshot_protection field
      identity.privacy_settings.screenshot_protection = false;
      await identity.save();
      console.log('✅ Migrated privacy settings - added screenshot_protection');
    }
    
    console.log('✅ Privacy settings loaded:', identity.privacy_settings);
    res.json({ privacy_settings: identity.privacy_settings });
  } catch (error) {
    console.error('❌ Get privacy settings error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Block user
app.post('/api/identity/block', async (req, res) => {
  try {
    console.log('📡 POST /api/identity/block');
    const { blocker_identity_id, blocked_identity_id } = req.body;
    console.log('📦 Blocker:', blocker_identity_id);
    console.log('📦 Blocked:', blocked_identity_id);
    
    if (!blocker_identity_id || !blocked_identity_id) {
      return res.status(400).json({ error: 'Missing identity IDs' });
    }
    
    // Check if already blocked
    const blockerIdentity = await Identity.findById(blocker_identity_id);
    if (!blockerIdentity) {
      return res.status(404).json({ error: 'Blocker identity not found' });
    }
    
    if (!blockerIdentity.blocked_users) {
      blockerIdentity.blocked_users = [];
    }
    
    if (blockerIdentity.blocked_users.includes(blocked_identity_id)) {
      console.log('⚠️ User already blocked');
      return res.json({ success: true, message: 'User already blocked' });
    }
    
    blockerIdentity.blocked_users.push(blocked_identity_id);
    await blockerIdentity.save();
    
    console.log('✅ User blocked');
    
    // Broadcast block event via WebSocket
    try {
      // Notify blocker's devices
      io.to(`user:${blocker_identity_id}`).emit('user_blocked', {
        blocker_identity_id,
        blocked_identity_id,
        timestamp: Date.now()
      });
      
      // Notify blocked user's devices (they need to know they can't message anymore)
      io.to(`user:${blocked_identity_id}`).emit('blocked_by_user', {
        blocker_identity_id,
        blocked_identity_id,
        timestamp: Date.now()
      });
      
      console.log('📡 Broadcasted block events');
    } catch (broadcastError) {
      console.error('❌ Error broadcasting block:', broadcastError);
    }
    
    res.json({ success: true, message: 'User blocked' });
  } catch (error) {
    console.error('❌ Block user error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Unblock user
app.post('/api/identity/unblock', async (req, res) => {
  try {
    console.log('📡 POST /api/identity/unblock');
    const { blocker_identity_id, blocked_identity_id } = req.body;
    console.log('📦 Blocker:', blocker_identity_id);
    console.log('📦 Unblocking:', blocked_identity_id);
    
    if (!blocker_identity_id || !blocked_identity_id) {
      return res.status(400).json({ error: 'Missing identity IDs' });
    }
    
    const blockerIdentity = await Identity.findById(blocker_identity_id);
    if (!blockerIdentity) {
      return res.status(404).json({ error: 'Blocker identity not found' });
    }
    
    if (!blockerIdentity.blocked_users) {
      blockerIdentity.blocked_users = [];
    }
    
    blockerIdentity.blocked_users = blockerIdentity.blocked_users.filter(
      id => id.toString() !== blocked_identity_id
    );
    await blockerIdentity.save();
    
    console.log('✅ User unblocked');
    
    // Broadcast unblock event via WebSocket
    try {
      // Notify blocker's devices
      io.to(`user:${blocker_identity_id}`).emit('user_unblocked', {
        blocker_identity_id,
        blocked_identity_id,
        timestamp: Date.now()
      });
      
      // Notify unblocked user's devices
      io.to(`user:${blocked_identity_id}`).emit('unblocked_by_user', {
        blocker_identity_id,
        blocked_identity_id,
        timestamp: Date.now()
      });
      
      console.log('📡 Broadcasted unblock events');
    } catch (broadcastError) {
      console.error('❌ Error broadcasting unblock:', broadcastError);
    }
    
    res.json({ success: true, message: 'User unblocked' });
  } catch (error) {
    console.error('❌ Unblock user error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get blocked users list
app.get('/api/identity/blocked-list/:identity_id', async (req, res) => {
  try {
    console.log('📡 GET /api/identity/blocked-list/:identity_id');
    const { identity_id } = req.params;
    console.log('📦 Identity ID:', identity_id);
    
    const identity = await Identity.findById(identity_id);
    if (!identity) {
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    const blockedIds = identity.blocked_users || [];
    const blockedUsers = await Identity.find({ _id: { $in: blockedIds } });
    
    const blockedUsersFormatted = blockedUsers.map(user => ({
      _id: user._id.toString(),
      username: user.username,
      avatar: user.avatar || '',
      bio: user.bio || ''
    }));
    
    console.log('✅ Blocked users loaded:', blockedUsersFormatted.length);
    res.json({ blocked_users: blockedUsersFormatted });
  } catch (error) {
    console.error('❌ Get blocked users error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Check if user can message
app.get('/api/identity/can-message/:from_id/:to_id', async (req, res) => {
  try {
    const { from_id, to_id } = req.params;
    
    const toIdentity = await Identity.findById(to_id);
    if (!toIdentity) {
      return res.json({ can_message: false });
    }
    
    // Check if blocked
    if (toIdentity.blocked_users && toIdentity.blocked_users.includes(from_id)) {
      return res.json({ can_message: false });
    }
    
    // Check privacy settings
    const whoCanMessage = toIdentity.privacy_settings?.who_can_message || 'everyone';
    
    if (whoCanMessage === 'nobody') {
      return res.json({ can_message: false });
    }
    
    res.json({ can_message: true });
  } catch (error) {
    console.error('❌ Can message error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Check if user can see profile
app.get('/api/identity/can-see-profile/:viewer_id/:target_id', async (req, res) => {
  try {
    const { viewer_id, target_id } = req.params;
    
    const targetIdentity = await Identity.findById(target_id);
    if (!targetIdentity) {
      return res.json({ can_see: false });
    }
    
    const whoCanSee = targetIdentity.privacy_settings?.who_can_see_profile || 'everyone';
    
    if (whoCanSee === 'nobody') {
      return res.json({ can_see: false });
    }
    
    res.json({ can_see: true });
  } catch (error) {
    console.error('❌ Can see profile error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Check if I am blocked by another user
app.get('/api/identity/am-i-blocked/:my_id/:other_id', async (req, res) => {
  try {
    console.log('📡 GET /api/identity/am-i-blocked/:my_id/:other_id');
    const { my_id, other_id } = req.params;
    console.log('📦 My ID:', my_id);
    console.log('📦 Other ID:', other_id);
    
    const otherIdentity = await Identity.findById(other_id);
    if (!otherIdentity) {
      return res.json({ is_blocked: false });
    }
    
    const isBlocked = otherIdentity.blocked_users && otherIdentity.blocked_users.includes(my_id);
    
    console.log('✅ Am I blocked:', isBlocked);
    res.json({ is_blocked: isBlocked });
  } catch (error) {
    console.error('❌ Am I blocked error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DEVICES MANAGEMENT ROUTES
// ============================================

// Get all devices for identity
app.get('/api/devices/:identityId', async (req, res) => {
  try {
    console.log('📡 GET /api/devices/:identityId');
    const { identityId } = req.params;
    console.log('📦 Identity ID:', identityId);
    
    const devices = await Device.find({ identity_id: identityId })
      .sort({ last_active: -1 });
    
    const currentDeviceId = req.headers['x-device-id'];
    
    const devicesWithCurrent = devices.map(d => ({
      id: d._id.toString(),
      identityId: d.identity_id.toString(),
      deviceName: d.device_name,
      deviceModel: d.device_model,
      platform: d.platform,
      osVersion: d.os_version,
      appVersion: d.app_version,
      lastActive: d.last_active.getTime(),
      isCurrent: d.device_id === currentDeviceId
    }));
    
    console.log('✅ Devices loaded:', devicesWithCurrent.length);
    res.json({ devices: devicesWithCurrent });
  } catch (error) {
    console.error('❌ Get devices error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Register or update device
app.post('/api/devices/register', async (req, res) => {
  try {
    console.log('📡 POST /api/devices/register');
    const { identityId, deviceName, deviceModel, platform, osVersion, appVersion } = req.body;
    const deviceId = req.headers['x-device-id'];
    
    console.log('📦 Identity ID:', identityId);
    console.log('📦 Device ID:', deviceId);
    console.log('📦 Device Name:', deviceName);
    console.log('📦 Platform:', platform);
    
    if (!deviceId) {
      return res.status(400).json({ error: 'Missing x-device-id header' });
    }
    
    let device = await Device.findOne({ device_id: deviceId });
    
    if (device) {
      // Update existing device
      device.identity_id = identityId;
      device.device_name = deviceName;
      device.device_model = deviceModel;
      device.platform = platform;
      device.os_version = osVersion;
      device.app_version = appVersion;
      device.last_active = new Date();
      await device.save();
      console.log('✅ Device updated');
    } else {
      // Create new device
      device = new Device({
        identity_id: identityId,
        device_id: deviceId,
        device_name: deviceName,
        device_model: deviceModel,
        platform: platform,
        os_version: osVersion,
        app_version: appVersion
      });
      await device.save();
      console.log('✅ Device registered');
    }
    
    const response = {
      id: device._id.toString(),
      identityId: device.identity_id.toString(),
      deviceName: device.device_name,
      deviceModel: device.device_model,
      platform: device.platform,
      osVersion: device.os_version,
      appVersion: device.app_version,
      lastActive: device.last_active.getTime(),
      isCurrent: true
    };
    
    res.json(response);
  } catch (error) {
    console.error('❌ Register device error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Logout device (delete)
app.post('/api/devices/logout', async (req, res) => {
  try {
    console.log('📡 POST /api/devices/logout');
    const { deviceId } = req.body;
    console.log('📦 Device ID:', deviceId);
    
    if (!deviceId) {
      return res.status(400).json({ error: 'Missing deviceId' });
    }
    
    await Device.findByIdAndDelete(deviceId);
    console.log('✅ Device logged out');
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Logout device error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update device activity
app.put('/api/devices/:deviceId/activity', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    await Device.findByIdAndUpdate(deviceId, { last_active: new Date() });
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Update device activity error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SYNC SYSTEM ROUTES (Obfuscated Currency)
// ============================================

const uDataSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  pts: { type: Number, required: true, default: 0 },
  lck: { type: Number, default: 0 },
  typ: { type: String, default: 'JEM' }
}, { timestamps: true });

const uLogSchema = new mongoose.Schema({
  act: { type: String, required: true },
  src: String,
  dst: String,
  val: { type: Number, required: true },
  sts: { type: String, required: true },
  meta: Object,
  cmp: Date
}, { timestamps: true });

const uItemSchema = new mongoose.Schema({
  uid: { type: String, required: true },
  iid: { type: String, required: true },
  inm: { type: String, required: true },
  val: { type: Number, required: true },
  tid: String,
  sts: { type: String, required: true }
}, { timestamps: true });

const UData = mongoose.model('UData', uDataSchema);
const ULog = mongoose.model('ULog', uLogSchema);
const UItem = mongoose.model('UItem', uItemSchema);

// w8m - Data operations
app.get('/api/sync/w8m/val/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const data = await UData.findOne({ uid });
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json({ val: data.pts, typ: data.typ });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sync/w8m/info/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const data = await UData.findOne({ uid });
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json({
      uid: data.uid,
      pts: data.pts,
      lck: data.lck,
      typ: data.typ,
      ts: data.createdAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sync/w8m/add', async (req, res) => {
  try {
    const { uid, val, src } = req.body;
    if (val <= 0) return res.status(400).json({ error: 'Invalid value' });
    
    const data = await UData.findOne({ uid });
    if (!data) return res.status(404).json({ error: 'Not found' });
    
    data.pts += val;
    await data.save();
    
    res.json({ ok: true, nval: data.pts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// q7x - Action operations
app.post('/api/sync/q7x/act', async (req, res) => {
  try {
    const { src, dst, val } = req.body;
    if (src === dst) return res.status(400).json({ error: 'Invalid operation' });
    if (val <= 0) return res.status(400).json({ error: 'Invalid value' });
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const srcData = await UData.findOne({ uid: src }).session(session);
      if (!srcData || srcData.pts < val) {
        throw new Error('Insufficient data');
      }
      
      const dstData = await UData.findOne({ uid: dst }).session(session);
      if (!dstData) throw new Error('Target not found');
      
      const log = new ULog({
        act: 'TRF',
        src,
        dst,
        val,
        sts: 'PND',
        meta: {}
      });
      await log.save({ session });
      
      srcData.pts -= val;
      dstData.pts += val;
      
      await srcData.save({ session });
      await dstData.save({ session });
      
      log.sts = 'CMP';
      log.cmp = new Date();
      await log.save({ session });
      
      await session.commitTransaction();
      
      res.json({
        ok: true,
        lid: log._id,
        nval: srcData.pts
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sync/q7x/hist/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const limit = parseInt(req.query.lim) || 50;
    const logs = await ULog.find({
      $or: [{ src: uid }, { dst: uid }]
    }).sort({ createdAt: -1 }).limit(limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sync/q7x/chk/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const log = await ULog.findById(id);
    res.json({ vld: !!log && log.sts === 'CMP' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sync/q7x/cncl/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const log = await ULog.findById(id);
    if (!log) return res.status(404).json({ error: 'Not found' });
    if (log.sts !== 'PND') return res.status(400).json({ error: 'Cannot cancel' });
    
    log.sts = 'CNC';
    await log.save();
    
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// n3k - Item operations
app.post('/api/sync/n3k/proc', async (req, res) => {
  try {
    const { uid, iid, val } = req.body;
    if (val <= 0) return res.status(400).json({ error: 'Invalid value' });
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const data = await UData.findOne({ uid }).session(session);
      if (!data || data.pts < val) {
        throw new Error('Insufficient data');
      }
      
      data.pts -= val;
      data.lck += val;
      await data.save({ session });
      
      const item = new UItem({
        uid,
        iid,
        inm: `item_${iid}`,
        val,
        tid: '',
        sts: 'PND'
      });
      await item.save({ session });
      
      const log = new ULog({
        act: 'ITM',
        src: uid,
        dst: null,
        val,
        sts: 'CMP',
        meta: { iid },
        cmp: new Date()
      });
      await log.save({ session });
      
      item.tid = log._id.toString();
      await item.save({ session });
      
      data.lck -= val;
      await data.save({ session });
      
      item.sts = 'CMP';
      await item.save({ session });
      
      await session.commitTransaction();
      
      res.json({
        ok: true,
        iid: item._id,
        itm: item
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sync/n3k/rev/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await UItem.findById(id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (item.sts === 'REV') return res.status(400).json({ error: 'Already reversed' });
    
    const data = await UData.findOne({ uid: item.uid });
    if (!data) return res.status(404).json({ error: 'Data not found' });
    
    data.pts += item.val;
    await data.save();
    
    item.sts = 'REV';
    await item.save();
    
    const log = new ULog({
      act: 'REV',
      src: null,
      dst: item.uid,
      val: item.val,
      sts: 'CMP',
      meta: { oid: id },
      cmp: new Date()
    });
    await log.save();
    
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sync/n3k/hist/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const limit = parseInt(req.query.lim) || 50;
    const items = await UItem.find({ uid }).sort({ createdAt: -1 }).limit(limit);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sync/n3k/chk/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await UItem.findById(id);
    res.json({ vld: !!item && item.sts === 'CMP' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// END SYNC SYSTEM ROUTES
// ============================================

const PORT = process.env.PORT || 25594;

// Global error handler
app.use((err, req, res, next) => {
  console.error('\n!!! GLOBAL ERROR HANDLER !!!');
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  console.error('Request:', req.method, req.url);
  console.error('Body:', JSON.stringify(req.body));
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
  
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

console.log('🔄 Подключение к MongoDB...');
console.log(`📍 URI: ${process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 50) + '...' : 'NOT SET'}`);

const connectMongo = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI не установлен в .env файле');
    mongoConnected = false;
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      retryWrites: true,
      dbName: 'jemmy'
    });
    
    mongoConnected = true;
    console.log('✅ MongoDB подключена успешно!');
    console.log('📁 Database: jemmy');
    console.log('📦 Collections: users, identities, chats, messages, onetimelinks');
  } catch (err) {
    console.error('❌ Ошибка MongoDB:', err.message);
    console.error('Stack:', err.stack);
    mongoConnected = false;
    
    // Retry after 2 seconds
    setTimeout(() => {
      console.log('🔄 Повторная попытка подключения к MongoDB...');
      connectMongo();
    }, 2000);
  }
};

// Connect immediately
connectMongo();

// For Vercel serverless
if (process.env.VERCEL) {
  console.log('🚀 Running on Vercel serverless');
  module.exports = app;
} else {
  // For local development
  server.listen(25594, '0.0.0.0', () => {
    console.log('\n🚀 Jemmy Server запущен!');
    console.log(`📡 HTTP: http://0.0.0.0:25594`);
    console.log(`📡 HTTP: http://178.104.40.37:25594`);
    console.log(`🔌 WebSocket: ws://178.104.40.37:25594`);
    console.log(`⏰ Identity Rotation: автоматическая (24ч жизни)\n`);
  });
}
