import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Report from './pages/Report';
import Home from './pages/Home';
import Search from './pages/Search';
import Login from './pages/Login';
import Profile from './pages/Profile';
import DogDetail from './pages/DogDetail';
import Terms from './pages/Terms';
import ProtectedRoute from './components/ProtectedRoute';
import { sightingsService } from './sightingsService';

import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';

function AppContent() {
  const { user } = useAuth();
  const location = useLocation();

  const isCameraPage = location.pathname === '/report' || location.pathname === '/search';
  const hideNav = ['/login', '/detail'].some(path => location.pathname.startsWith(path));

  return (
    <div className={`app-root ${isCameraPage ? 'is-camera-active' : 'bg-white'}`}>
      <div className="app-container">
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
            <Route path="/search" element={<Search />} />
            <Route path="/detail/:id" element={<DogDetail />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="*" element={<div>Página en mantenimiento</div>} />
          </Routes>
        </main>

        {!hideNav && (
          <nav className="bg-white/90 backdrop-blur-md border-t border-gray-200 flex justify-around p-3 pb-safe z-30 shadow-lg">
            <Link to="/" className={`flex flex-col items-center p-2 rounded-xl ${location.pathname === '/' ? 'text-brand-600 bg-brand-50' : 'text-gray-400'}`}>
              <span className="material-icons">home</span>
              <span className="text-[10px] font-bold mt-1">Inicio</span>
            </Link>

            <Link to="/search" className={`flex flex-col items-center p-2 rounded-xl ${location.pathname === '/search' ? 'text-brand-600 bg-brand-50' : 'text-gray-400'}`}>
              <span className="material-icons">search</span>
              <span className="text-[10px] font-bold mt-1">Buscar</span>
            </Link>

            <Link to="/report" className={`flex flex-col items-center p-2 rounded-xl ${location.pathname === '/report' ? 'text-brand-600 bg-brand-50' : 'text-gray-400'}`}>
              <span className="material-icons">add_a_photo</span>
              <span className="text-[10px] font-bold mt-1">Reportar</span>
            </Link>

            <Link to={user ? "/profile" : "/login"} className={`flex flex-col items-center p-2 rounded-xl ${['/profile', '/login'].includes(location.pathname) ? 'text-brand-600 bg-brand-50' : 'text-gray-400'}`}>
              <span className="material-icons">{user ? 'person' : 'login'}</span>
              <span className="text-[10px] font-bold mt-1">{user ? 'Perfil' : 'Ingresar'}</span>
            </Link>
          </nav>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}



export default App;
