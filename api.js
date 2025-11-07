const BASE_URL = 'https://your-backend.example.com'; 

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  signup: (payload) => post('/auth/signup', payload),    // { fullName, email, password, dateOfBirth }
  login:  (payload) => post('/auth/login', payload),     // { email, password }
  logout: () => Promise.resolve(),                       // replace with real call if needed
};
