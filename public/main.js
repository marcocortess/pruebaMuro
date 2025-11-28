// public/script.js
const socket = io();

// obtener usuario (me)
async function getUser() {
  const res = await fetch('/me');
  return res.ok ? await res.json() : null;
}

//Color en los avatares
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;

  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  const toHex = x => {
    const hex = Math.round(x * 255).toString(16).padStart(2, '0');
    return hex;
  };

  return `${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

function generateColorFromName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return { h: hue, s: 70, l: 50 };
}


let user;

document.addEventListener('DOMContentLoaded', async () => {
  user = await getUser();
  if (!user) {
    window.location.href = '/login.html';
    return;
  }

  // DOM
  const loggedUserName = document.getElementById('loggedUserName');
  const avatarPreview = document.getElementById('avatarPreview');
  const avatarPreview2 = document.getElementById('avatarPreview2');
  const postForm = document.getElementById('postForm');
  const contentInput = document.getElementById('content');
  const postsList = document.getElementById('postsList');
  const logoutBtn = document.getElementById('logoutBtn');

  // mostrar nombre y avatar
  const initial = user.username.charAt(0).toUpperCase();
  const userColor = generateColorFromName(user.username);
  const hex = hslToHex(userColor.h, userColor.s, userColor.l);
  const avatarUrl = `https://placehold.co/48x48/${hex}/FFFFFF?text=${initial}`;

  if (loggedUserName) loggedUserName.textContent = user.username;
  if (avatarPreview) avatarPreview.src = avatarUrl;
  if (avatarPreview2) avatarPreview2.src = avatarUrl;

  // enviar post via socket
  postForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = contentInput.value.trim();
    if (!content) return alert('Escribe algo antes de publicar.');
    socket.emit('newPost', { content });
    contentInput.value = '';
  });

  // recibir posts iniciales
  socket.on('loadAllPosts', (posts) => {
    postsList.innerHTML = '';
    posts.forEach(p => postsList.append(createPostElement(p)));
  });

  // recibir nuevo post
  socket.on('postCreated', (post) => {
    postsList.prepend(createPostElement(post));
  });

  // errores de post
  socket.on('postError', (err) => {
    alert(err.message || 'Error al publicar');
  });

  // Actualizar contador de likes en tiempo real
  socket.on('postLiked', ({ postId, likes }) => {
  const postElement = Array.from(postsList.children)
    .find(el => el.innerHTML.includes(`"${postId}"`)); // búsqueda simple

  if (postElement) {
    const likeCount = postElement.querySelector('.likeCount');
    if (likeCount) likeCount.textContent = likes;
  }
  });

  // Nuevo repost
  socket.on('postReposted', (post) => {
  postsList.prepend(createPostElement(post));
  });

  function createPostElement(post) {
  const article = document.createElement('article');
  article.className = 'p-4 flex space-x-3 border-b border-gray-700 animate-post';

  const initial = post.author.charAt(0).toUpperCase();
  const color = generateColorFromName(post.author);
  const hex = hslToHex(color.h, color.s, color.l);

  const avatar = `https://placehold.co/48x48/${hex}/FFFFFF?text=${initial}`;

  article.innerHTML = `
    <img src="${avatar}" class="w-12 h-12 rounded-full" />
    <div class="flex-1">
      <div class="flex justify-between">
        <span class="font-bold">${escapeHTML(post.author)}</span>
        <span class="text-sm text-gray-400">${new Date(post.createdAt).toLocaleString()}</span>
      </div>

      <p class="mt-1 mb-3">${escapeHTML(post.content)}</p>

      <!-- BOTONES DE ACCIÓN -->
      <div class="flex space-x-8 text-gray-400 text-sm">

        <!-- LIKE -->
        <button class="likeBtn flex items-center space-x-1 hover:text-red-400 transition">
            <span>❤️</span>
            <span class="likeCount">${post.likes || 0}</span>
        </button>

        <!-- COMENTAR -->
        <button class="commentBtn flex items-center space-x-1 hover:text-blue-400 transition">
            <span>💬</span>
            <span>Comentar</span>
        </button>

        <!-- REPOST -->
        <button class="repostBtn flex items-center space-x-1 hover:text-green-400 transition">
            <span>🔁</span>
            <span>Repostear</span>
        </button>

      </div>
    </div>
  `;

  // --- EVENTOS (cliente) ---
  const likeBtn = article.querySelector('.likeBtn');
  likeBtn.addEventListener('click', () => {
    socket.emit('likePost', post._id);
  });

  const repostBtn = article.querySelector('.repostBtn');
  repostBtn.addEventListener('click', () => {
    socket.emit('repostPost', post._id);
  });

  const commentBtn = article.querySelector('.commentBtn');
  commentBtn.addEventListener('click', () => {
    alert("Sistema de comentarios pronto 😎");
  });

  return article;
}


  //Logout Boton
  if (logoutBtn){
    logoutBtn.addEventListener('click', () =>{
      window.location.href = '/logout';
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])
    );
  }
});
