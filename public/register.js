document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  const res = await fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  const messageEl = document.getElementById('message');

  if (data.ok) {
    window.location.href = '/index.html';
    return;
  }
  messageEl.textContent = data.error || 'Error al crear usuario';
});
