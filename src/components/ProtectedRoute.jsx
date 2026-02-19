import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-brand-50">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) {
        // Redirigir a login pero guardando la página a la que querían ir
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Bloquear si no está verificado (y no es Google)
    const isGoogle = user.providerData.some(p => p.providerId === 'google.com');
    if (!isGoogle && !user.emailVerified) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};

export default ProtectedRoute;
