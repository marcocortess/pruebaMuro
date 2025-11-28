// server.js
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');

const Post = require('./models/Post');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MONGO_URI = 'mongodb+srv://marquitoswslol_db_user:zZr5gsgTpzcX2Xo7@murouser.x9ag2xy.mongodb.net/?appName=MuroUser';

// ===== MongoDB =====
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB conectado.'))
  .catch(err => console.error('Error al conectar MongoDB:', err));

// ===== Middlewares =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
  secret: 'supersecreto',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 día
});
app.use(sessionMiddleware);

// ===== Sanitizador =====
function sanitizeInput(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '');
}

// ===== Routes =====

// Redirección al login
app.get('/', (req, res) => res.redirect('/login.html'));

// Registrar usuario
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: 'Faltan datos.' });

    const exists = await User.findOne({ username });
    if (exists)
      return res.status(400).json({ error: 'El usuario ya existe.' });

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      username: sanitizeInput(username),
      password: hashed
    });

    await user.save();

    req.session.user = { id: user._id, username: user.username };
    return res.json({ ok: true });

  } catch (err) {
    console.error('Error en /register:', err);
    return res.status(500).json({ error: 'Error al registrar usuario.' });
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: 'Faltan datos.' });

    const user = await User.findOne({ username });
    if (!user)
      return res.status(400).json({ error: 'Usuario no encontrado.' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok)
      return res.status(400).json({ error: 'Contraseña incorrecta.' });

    req.session.user = { id: user._id, username: user.username };
    return res.json({ ok: true });

  } catch (err) {
    console.error('Error en /login:', err);
    return res.status(500).json({ error: 'Error en login.' });
  }
});

// Logout
app.get('/logout', (req, res) => {
  if (!req.session) return res.redirect('/login.html');

  req.session.destroy(err => {
    if (err) return res.redirect('/login.html');

    res.clearCookie('connect.sid');
    return res.redirect('/login.html');
  });
});

// Datos del usuario en sesión
app.get('/me', (req, res) => {
  if (!req.session.user) return res.json(null);
  res.json(req.session.user);
});

// ===== Socket.IO + Sesión =====
io.use((socket, next) => sessionMiddleware(socket.request, {}, next));

io.on('connection', async (socket) => {
  try {
    console.log('Socket conectado:', socket.id);

    // Enviar posts iniciales
    const posts = await Post.find().sort({ createdAt: -1 }).limit(50);
    socket.emit('loadAllPosts', posts);

    // ---- Crear POST ----
    socket.on('newPost', async ({ content }) => {
      try {
        const session = socket.request.session;
        if (!session || !session.user)
          return socket.emit('postError', { message: 'No autorizado.' });

        const cleanContent = sanitizeInput(content);
        if (!cleanContent)
          return socket.emit('postError', { message: 'Contenido vacío.' });

        const post = new Post({
          author: session.user.username,
          content: cleanContent
        });

        const saved = await post.save();
        io.emit('postCreated', saved);

      } catch (err) {
        console.error('Error newPost:', err);
        socket.emit('postError', { message: 'Error al crear post.' });
      }
    });

    // ---- LIKE ----
    socket.on('likePost', async (postId) => {
      try {
        const session = socket.request.session;
        if (!session || !session.user) return;

        const post = await Post.findById(postId);
        if (!post) return;

        post.likes += 1;
        await post.save();

        io.emit('postUpdated', post);
      } catch (err) {
        console.error('Error likePost:', err);
      }
    });

    // ---- REPOST ----
    socket.on('repostPost', async (postId) => {
      try {
        const session = socket.request.session;
        if (!session || !session.user) return;

        const original = await Post.findById(postId);
        if (!original) return;

        original.reposts += 1;
        await original.save();

        const repost = new Post({
          author: session.user.username,
          content: `🔁 Repost: ${original.content}`
        });

        const saved = await repost.save();

        io.emit('postUpdated', original);
        io.emit('postCreated', saved);

      } catch (err) {
        console.error('Error repost:', err);
      }
    });

    // ---- COMENTAR ----
    socket.on('commentPost', async ({ postId, text }) => {
      try {
        const session = socket.request.session;
        if (!session || !session.user) return;

        const clean = sanitizeInput(text);

        const post = await Post.findById(postId);
        if (!post) return;

        post.comments.push({
          author: session.user.username,
          text: clean
        });

        await post.save();
        io.emit('postUpdated', post);

      } catch (err) {
        console.error('Error comentar:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket desconectado:', socket.id);
    });

  } catch (err) {
    console.error('Error conexión socket:', err);
  }
});

// Static
app.use(express.static('public'));

// Start
server.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
});
