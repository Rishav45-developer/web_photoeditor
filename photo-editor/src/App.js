import React, { useState, useRef, useEffect } from 'react';
import { Upload, LogOut, Download, RotateCw, Sun, Droplets, Wind, Image, Loader, Shield } from 'lucide-react';

// ─── API CONFIG ───────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:8000';  // change to your deployed URL in production

// ─── AUTH HELPERS ─────────────────────────────────────────────────────────────
const getToken = () => sessionStorage.getItem('jwt_token');
const setToken = (t) => sessionStorage.setItem('jwt_token', t);
const clearToken = () => sessionStorage.removeItem('jwt_token');

// Decode JWT payload (no verification — server already verified it on login)
const decodeToken = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
};

const isTokenExpired = (token) => {
  const payload = decodeToken(token);
  if (!payload?.exp) return true;
  // exp is in seconds (Python jose standard)
  return payload.exp * 1000 < Date.now();
};

// ─── API CALLS ────────────────────────────────────────────────────────────────
async function apiRegister(email, password) {
  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Registration failed');
  return data;
}

async function apiLogin(email, password) {
  // OAuth2PasswordRequestForm requires application/x-www-form-urlencoded
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Login failed');
  return data; // { access_token, token_type }
}

async function apiGetMe(token) {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Session invalid');
  return data; // { email }
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function PhotoEditor() {
  const [user, setUser] = useState(null);          // { email }
  const [tokenInfo, setTokenInfo] = useState(null); // { issuedAt, expiresAt }
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const [image, setImage] = useState(null);
  const [editedImage, setEditedImage] = useState(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [blur, setBlur] = useState(0);
  const [grayscale, setGrayscale] = useState(0);
  const [sepia, setSepia] = useState(0);
  const [hueRotate, setHueRotate] = useState(0);
  const [invert, setInvert] = useState(0);
  const [opacity, setOpacity] = useState(100);
  const [savedPhotos, setSavedPhotos] = useState([]);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Restore session on mount ──────────────────────────────────────────────
  useEffect(() => {
    const restore = async () => {
      const token = getToken();
      if (token && !isTokenExpired(token)) {
        try {
          const userData = await apiGetMe(token);
          applySession(token, userData.email);
        } catch {
          clearToken();
        }
      }
      setAuthChecking(false);
    };
    restore();
  }, []);

  const applySession = (token, email) => {
    const payload = decodeToken(token);
    setUser({ email });
    setTokenInfo({
      issuedAt: payload?.iat
        ? new Date(payload.iat * 1000).toLocaleString()
        : '—',
      expiresAt: payload?.exp
        ? new Date(payload.exp * 1000).toLocaleString()
        : '—',
    });
    loadPhotos(email);
  };

  // ── Local photo storage (keyed by email) ─────────────────────────────────
  const loadPhotos = (email) => {
    const raw = sessionStorage.getItem(`photos_${email}`);
    if (raw) setSavedPhotos(JSON.parse(raw));
  };

  const savePhotosToStorage = (email, photos) => {
    sessionStorage.setItem(`photos_${email}`, JSON.stringify(photos));
  };

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleAuth = async () => {
    if (!email || !password) { setError('Please enter email and password'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        await apiRegister(email, password);
      }
      // After register (or direct login), get the token
      const { access_token } = await apiLogin(email, password);
      setToken(access_token);
      applySession(access_token, email);
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setUser(null);
    setTokenInfo(null);
    setImage(null);
    setEditedImage(null);
    setSavedPhotos([]);
  };

  // ── Image editing ─────────────────────────────────────────────────────────
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImage(ev.target.result);
      setEditedImage(ev.target.result);
      resetFilters();
    };
    reader.readAsDataURL(file);
  };

  const resetFilters = () => {
    setBrightness(100); setContrast(100); setSaturation(100);
    setRotation(0); setBlur(0); setGrayscale(0); setSepia(0);
    setHueRotate(0); setInvert(0); setOpacity(100);
  };

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new window.Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px) grayscale(${grayscale}%) sepia(${sepia}%) hue-rotate(${hueRotate}deg) invert(${invert}%) opacity(${opacity}%)`;
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
      setEditedImage(canvas.toDataURL());
    };
    img.src = image;
  }, [image, brightness, contrast, saturation, rotation, blur, grayscale, sepia, hueRotate, invert, opacity]);

  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleFlipHorizontal = () => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new window.Image();
    img.onload = () => {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px) grayscale(${grayscale}%) sepia(${sepia}%) hue-rotate(${hueRotate}deg) invert(${invert}%) opacity(${opacity}%)`;
      ctx.drawImage(img, -canvas.width, 0);
      ctx.restore();
      setImage(canvas.toDataURL());
    };
    img.src = image;
  };

  const handleSave = () => {
    if (!editedImage || !user) return;
    const token = getToken();
    if (!token || isTokenExpired(token)) {
      alert('⚠️ Session expired. Please login again.');
      handleLogout();
      return;
    }
    const photo = {
      id: Date.now(),
      image_data: editedImage,
      filters: { brightness, contrast, saturation, rotation, blur, grayscale, sepia, hueRotate, invert, opacity },
      created_at: new Date().toISOString(),
    };
    const updated = [...savedPhotos, photo];
    setSavedPhotos(updated);
    savePhotosToStorage(user.email, updated);
    alert(' Photo saved!');
  };

  const handleDownload = () => {
    if (!editedImage) return;
    const link = document.createElement('a');
    link.download = `photomagic-${Date.now()}.png`;
    link.href = editedImage;
    link.click();
  };

  const deletePhoto = (id) => {
    const token = getToken();
    if (!token || isTokenExpired(token)) { handleLogout(); return; }
    const updated = savedPhotos.filter((p) => p.id !== id);
    setSavedPhotos(updated);
    savePhotosToStorage(user.email, updated);
  };

  const loadSavedPhoto = (photo) => {
    setImage(photo.image_data);
    setEditedImage(photo.image_data);
    if (photo.filters) {
      setBrightness(photo.filters.brightness ?? 100);
      setContrast(photo.filters.contrast ?? 100);
      setSaturation(photo.filters.saturation ?? 100);
      setRotation(photo.filters.rotation ?? 0);
      setBlur(photo.filters.blur ?? 0);
      setGrayscale(photo.filters.grayscale ?? 0);
      setSepia(photo.filters.sepia ?? 0);
      setHueRotate(photo.filters.hueRotate ?? 0);
      setInvert(photo.filters.invert ?? 0);
      setOpacity(photo.filters.opacity ?? 100);
    }
  };

  // ── Loading screen while checking token ──────────────────────────────────
  if (authChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <Loader className="animate-spin text-white" size={40} />
      </div>
    );
  }

  // ── Login / Register screen ───────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-6xl mb-2"></div>
            <h1 className="text-3xl font-bold text-gray-800">PhotoMagic Studio</h1>
            <p className="text-gray-600 mt-2">Transform your photos with magic </p>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
              <Shield size={14} />
              JWT + OAuth2 Authentication
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Min 6 characters"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleAuth}
              disabled={loading}
              className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader className="animate-spin" size={16} /> Authenticating...</>
              ) : (
                <><Shield size={16} /> {isSignUp ? 'Create Account' : 'Login'}</>
              )}
            </button>
          </div>

          <p className="text-center mt-4 text-sm text-gray-600">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-purple-600 ml-1 font-semibold hover:underline"
            >
              {isSignUp ? 'Login' : 'Sign Up'}
            </button>
          </p>

          <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg text-xs text-gray-700 text-center">
            <strong>🔐 Real JWT + OAuth2 Backend</strong><br />
            • FastAPI /register &amp; /login endpoints<br />
            • bcrypt password hashing<br />
            • Bearer token on every request
          </div>
        </div>
      </div>
    );
  }

  // ── Main editor ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md shadow-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow-lg"> PhotoMagic Studio</h1>
              <div className="flex items-center gap-2 mt-1">
                <Shield size={12} className="text-green-300" />
                <span className="text-xs text-white/70">JWT Authenticated via FastAPI</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-sm text-white/90 font-semibold block"> {user.email}</span>
                {tokenInfo && (
                  <span className="text-xs text-white/60">Expires: {tokenInfo.expiresAt}</span>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur text-white rounded-lg hover:bg-white/30 transition border border-white/30"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 py-8 grid md:grid-cols-3 gap-6">
        {/* Left panel */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white/95 backdrop-blur rounded-xl shadow-2xl p-6 border border-white/30">
            <h2 className="text-lg font-semibold mb-4 text-gray-800"> Upload Photo</h2>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <button
              onClick={() => fileInputRef.current.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:from-violet-700 hover:to-purple-700 transition shadow-lg"
            >
              <Upload size={20} /> Choose Image
            </button>
          </div>

          {image && (
            <div className="bg-white/95 backdrop-blur rounded-xl shadow-2xl p-6 space-y-4 border border-white/30 max-h-[600px] overflow-y-auto">
              <h2 className="text-lg font-semibold mb-2 text-gray-800"> Edit Controls</h2>

              {/* Basic */}
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Sun size={16} className="text-yellow-600" /> Basic Adjustments
              </h3>
              {[
                ['Brightness', brightness, setBrightness, 0, 200],
                ['Contrast', contrast, setContrast, 0, 200],
                ['Saturation', saturation, setSaturation, 0, 200],
                ['Opacity', opacity, setOpacity, 0, 100],
              ].map(([label, val, setter, min, max]) => (
                <div key={label}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{label}: {val}{label === 'Opacity' ? '%' : '%'}</label>
                  <input type="range" min={min} max={max} value={val} onChange={(e) => setter(Number(e.target.value))} className="w-full" />
                </div>
              ))}

              {/* Effects */}
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 pt-3 border-t border-gray-200">
                <Droplets size={16} className="text-blue-600" /> Creative Effects
              </h3>
              {[
                ['Blur', blur, setBlur, 0, 20, 'px'],
                ['Grayscale', grayscale, setGrayscale, 0, 100, '%'],
                ['Sepia', sepia, setSepia, 0, 100, '%'],
                ['Hue Rotate', hueRotate, setHueRotate, 0, 360, '°'],
                ['Invert', invert, setInvert, 0, 100, '%'],
              ].map(([label, val, setter, min, max, unit]) => (
                <div key={label}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{label}: {val}{unit}</label>
                  <input type="range" min={min} max={max} value={val} onChange={(e) => setter(Number(e.target.value))} className="w-full" />
                </div>
              ))}

              {/* Transform */}
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 pt-3 border-t border-gray-200">
                <Wind size={16} className="text-indigo-600" /> Transform
              </h3>
              <button onClick={handleRotate} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg hover:from-indigo-700 hover:to-violet-700 transition text-sm">
                <RotateCw size={16} /> Rotate 90°
              </button>
              <button onClick={handleFlipHorizontal} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition text-sm">
                <Image size={16} /> Flip Horizontal
              </button>
              <button onClick={resetFilters} className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm">
                Reset All Filters
              </button>

              {/* Save / Download */}
              <div className="flex gap-2 pt-3 border-t border-gray-200">
                <button onClick={handleSave} className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition text-sm font-semibold">
                   Save
                </button>
                <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition text-sm font-semibold">
                  <Download size={16} /> Download
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="md:col-span-2">
          <div className="bg-white/95 backdrop-blur rounded-xl shadow-2xl p-6 border border-white/30">
            <h2 className="text-lg font-semibold mb-4 text-gray-800"> Preview</h2>
            {editedImage ? (
              <div className="flex justify-center bg-gradient-to-br from-violet-100 to-purple-100 rounded-lg p-4">
                <img src={editedImage} alt="Edited" className="max-w-full h-auto rounded-lg shadow-2xl" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 bg-gradient-to-br from-violet-50 to-purple-50 rounded-lg border-2 border-dashed border-violet-300">
                <div className="text-6xl mb-4">🖼️</div>
                <p className="text-violet-600 font-semibold text-lg">Upload an image to start editing</p>
                <p className="text-violet-400 text-sm mt-2">Click the upload button to get started</p>
              </div>
            )}
          </div>

          {savedPhotos.length > 0 && (
            <div className="bg-white/95 backdrop-blur rounded-xl shadow-2xl p-6 mt-6 border border-white/30">
              <h2 className="text-lg font-semibold mb-4 text-gray-800"> Your Saved Photos ({savedPhotos.length})</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {savedPhotos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.image_data}
                      alt="Saved"
                      onClick={() => loadSavedPhoto(photo)}
                      className="w-full h-32 object-cover rounded-lg shadow-lg border-2 border-violet-200 cursor-pointer hover:border-violet-400 transition"
                    />
                    <button
                      onClick={() => deletePhoto(photo.id)}
                      className="absolute top-2 right-2 bg-gradient-to-r from-red-500 to-pink-600 text-white px-3 py-1 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition"
                    >
                      Delete
                    </button>
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition">
                      Click to edit
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}