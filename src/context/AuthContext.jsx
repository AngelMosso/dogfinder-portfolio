import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    onAuthStateChanged,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider,
    signOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    updateEmail,
    updatePassword,
    signInWithCredential,
    sendPasswordResetEmail,
    deleteUser,
    sendEmailVerification
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { auth } from '../firebase';
// GoogleAuth se importará dinámicamente solo en nativo

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });

        // Manejar el resultado de la redirección de Google (Vital para WebViews/Messenger)
        getRedirectResult(auth)
            .then((result) => {
                if (result) {
                    console.log("Auth: Regreso exitoso de redirect Google:", result.user.email);
                    setUser(result.user);
                }
            })
            .catch((error) => {
                console.error("Auth: Error en retorno de redirect:", error);
            });

        return unsubscribe;
    }, []);

    const loginWithGoogle = async () => {
        try {
            console.log("Auth: Iniciando flujo de Google...");

            if (Capacitor.isNativePlatform()) {
                // 1. NATIVO (iOS/Android): Usar Plugin Capacitor con importación dinámica
                console.log("Auth: Detectado NATIVO, cargando plugin...");
                const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
                const googleUser = await GoogleAuth.signIn();
                const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
                return await signInWithCredential(auth, credential);
            } else {
                // 2. WEB: Usar Firebase SDK Directamente (Popup preferido)
                console.log("Auth: Detectado WEB, usando Firebase SDK (Popup)...");
                const provider = new GoogleAuthProvider();
                try {
                    return await signInWithPopup(auth, provider);
                } catch (popupErr) {
                    console.warn("Auth: Popup bloqueado o falló, intentando Redirect...", popupErr);
                    return await signInWithRedirect(auth, provider);
                }
            }
        } catch (err) {
            console.error("Auth: Error crítico en Google Login:", err);
            throw err;
        }
    };

    const registerWithEmail = (email, password) => {
        return createUserWithEmailAndPassword(auth, email, password);
    };

    const loginWithEmail = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    const logout = () => signOut(auth);

    const updateUserProfile = (data) => {
        if (!auth.currentUser) return Promise.reject("No user logged in");
        return updateProfile(auth.currentUser, data);
    };

    const updateUserEmail = (newEmail) => {
        if (!auth.currentUser) return Promise.reject("No user logged in");
        return updateEmail(auth.currentUser, newEmail);
    };

    const updateUserPassword = (newPassword) => {
        if (!auth.currentUser) return Promise.reject("No user logged in");
        return updatePassword(auth.currentUser, newPassword);
    };

    const recoverPassword = (email) => {
        return sendPasswordResetEmail(auth, email);
    };

    const deleteAccount = () => {
        if (!auth.currentUser) return Promise.reject("No user logged in");
        return deleteUser(auth.currentUser);
    };

    const sendVerification = (customUser) => {
        const targetUser = customUser || auth.currentUser;
        if (!targetUser) return Promise.reject("No user logged in");
        return sendEmailVerification(targetUser);
    };

    const reloadUser = async () => {
        if (auth.currentUser) {
            console.log("Auth: Iniciando recarga de usuario...");
            try {
                await auth.currentUser.reload();

                // Forzar el refresco del ID Token para sincronizar el flag emailVerified en el cliente
                // Esto es crucial para que el SDK detecte el cambio realizado en el servidor
                if (auth.currentUser.emailVerified) {
                    await auth.currentUser.getIdToken(true);
                    console.log("Auth: Token refrescado tras detectar verificación.");
                }

                // Creamos un nuevo objeto con los datos frescos para forzar la reactividad en React
                // Firebase User es un objeto complejo, creamos uno plano con lo necesario
                const refreshedUser = {
                    ...auth.currentUser,
                    emailVerified: auth.currentUser.emailVerified,
                    uid: auth.currentUser.uid,
                    email: auth.currentUser.email,
                    displayName: auth.currentUser.displayName,
                    photoURL: auth.currentUser.photoURL,
                    providerData: auth.currentUser.providerData
                };

                setUser(refreshedUser);
                console.log("Auth: Usuario recargado. Verificado:", auth.currentUser.emailVerified);
                return auth.currentUser.emailVerified;
            } catch (err) {
                console.error("Auth: Error en reloadUser:", err);
                throw err;
            }
        }
    };

    const value = {
        user,
        loginWithGoogle,
        registerWithEmail,
        loginWithEmail,
        logout,
        updateUserProfile,
        updateUserEmail,
        updateUserPassword,
        recoverPassword,
        deleteAccount,
        sendVerification,
        reloadUser,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div className="min-h-screen flex flex-col items-center justify-center bg-brand-50 p-4">
                    <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-brand-800 font-bold animate-pulse">Cargando DogFinder...</p>
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};
