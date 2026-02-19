import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';

export default function Login() {
    const navigate = useNavigate();
    const { loginWithGoogle, registerWithEmail, loginWithEmail, recoverPassword, sendVerification, reloadUser, logout, user, loading } = useAuth();
    const [loggingIn, setLoggingIn] = React.useState(false);
    const [showEmailForm, setShowEmailForm] = React.useState(false);
    const [isRegistering, setIsRegistering] = React.useState(false);
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [verificationSent, setVerificationSent] = React.useState(false);
    const [error, setError] = React.useState(null);
    const location = useLocation();

    // Redirigir si ya está logueado y verificado
    React.useEffect(() => {
        if (user) {
            const isGoogle = user.providerData.some(p => p.providerId === 'google.com');
            if (isGoogle || user.emailVerified) {
                const origin = location.state?.from?.pathname || '/';
                navigate(origin, { replace: true });
            } else {
                setVerificationSent(true);
            }
        }
    }, [user?.emailVerified, user?.uid, navigate, location.state]);

    // Polling automático para detectar la verificación sin refrescar la página
    React.useEffect(() => {
        let interval;
        if (verificationSent && user && !user.emailVerified) {
            console.log("Iniciando sondeo automático de verificación...");
            interval = setInterval(async () => {
                try {
                    await reloadUser();
                } catch (e) {
                    console.error("Error en polling:", e);
                }
            }, 3000); // Revisar cada 3 segundos
        }
        return () => {
            if (interval) {
                console.log("Deteniendo sondeo automático.");
                clearInterval(interval);
            }
        };
    }, [verificationSent, user?.emailVerified, user?.uid]);

    const handleGoogleLogin = async () => {
        if (loggingIn) return;
        setLoggingIn(true);
        setError(null);
        try {
            console.log("Iniciando flujo Google Auth (Popup/Redirect)...");
            await loginWithGoogle();
        } catch (error) {
            console.error("Error en Google login:", error);
            setLoggingIn(false);
            // Mostrar el código de error específico para ayudar al diagnóstico
            const detail = error.code ? `[${error.code}]` : "";
            alert(`Error Google ${detail}: ${error.message}`);
            setError("No se pudo iniciar sesión con Google: " + error.message);
        }
    };

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        setLoggingIn(true);
        setError(null);
        try {
            if (isRegistering) {
                const userCred = await registerWithEmail(email, password);
                // Pequeña espera para asegurar que Firebase reconozca al nuevo usuario
                await new Promise(r => setTimeout(r, 1000));
                await sendVerification(userCred.user);
                setVerificationSent(true);
                alert("📩 ¡Correo de verificación enviado! Por favor confirma tu cuenta.");
            } else {
                await loginWithEmail(email, password);
            }
            setLoggingIn(false); // Resetear estado de carga en éxito
        } catch (error) {
            console.error("Error en Email auth:", error);
            setLoggingIn(false);
            if (error.code === 'auth/email-already-in-use') {
                setError("Este correo ya está registrado.");
            } else if (error.code === 'auth/invalid-credential') {
                setError("Correo o contraseña incorrectos.");
            } else if (error.code === 'auth/weak-password') {
                setError("La contraseña debe tener al menos 6 caracteres.");
            } else {
                setError("Error: " + error.message);
            }
        }
    };

    const handlePasswordReset = async () => {
        if (!email) {
            setError("Por favor escribe tu correo electrónico primero.");
            return;
        }
        setLoggingIn(true);
        try {
            await recoverPassword(email);
            alert("✨ ¡Correo de recuperación enviado! Revisa tu bandeja de entrada.");
            setLoggingIn(false);
        } catch (error) {
            console.error("Error en password reset:", error);
            setError("Error al enviar el correo: " + error.message);
            setLoggingIn(false);
        }
    };

    const handleResendVerification = async () => {
        try {
            await sendVerification();
            alert("✨ ¡Correo de verificación reenviado! Revisa tu bandeja de entrada.");
        } catch (error) {
            setError("Error al reenviar: " + error.message);
        }
    };

    const handleCheckVerification = async () => {
        console.log("Login: Comprobando verificación manualmente...");
        setLoggingIn(true);
        setError(null);
        try {
            // reloadUser ahora devuelve el booleano emailVerified y fuerza refresco de token
            const isVerified = await reloadUser();
            console.log("Login: Resultado del reload:", isVerified);

            if (isVerified) {
                console.log("Login: ¡Éxito! Redirigiendo...");
                const origin = location.state?.from?.pathname || '/';
                navigate(origin, { replace: true });
            } else {
                console.log("Login: Sigue sin estar verificado.");
                setError("Aún no detectamos la verificación. Por favor haz clic en el enlace de tu correo y espera un par de segundos.");
                setLoggingIn(false);
            }
        } catch (error) {
            console.error("Login: Error al comprobar verificación:", error);
            setError("Error al verificar: " + error.message);
            setLoggingIn(false);
        }
    };

    if (verificationSent && user && !user.emailVerified) {
        return (
            <div className="min-h-screen bg-brand-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-full max-w-sm bg-white p-8 rounded-[40px] shadow-soft space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 bg-brand-100 rounded-full mx-auto flex items-center justify-center mb-2">
                        <span className="material-icons text-4xl text-brand-600">mark_email_read</span>
                    </div>
                    <h2 className="text-2xl font-black text-gray-800">¡Verifica tu Email! 📧</h2>
                    <p className="text-gray-500 text-sm leading-relaxed">
                        Hemos enviado un enlace de confirmación a <br />
                        <span className="font-bold text-gray-800">{user.email}</span>.
                    </p>

                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                        <p className="text-[11px] text-amber-700 font-medium leading-tight">
                            ⚠️ ¿No lo encuentras? Revisa tu carpeta de <strong>SPAM o Correo no deseado</strong>. A veces los correos automáticos llegan ahí.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={handleCheckVerification}
                            disabled={loggingIn}
                            className="w-full py-4 bg-brand-500 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
                        >
                            {loggingIn ? 'Comprobando...' : 'Ya lo verifiqué (Entrar)'}
                        </button>

                        <button
                            onClick={handleResendVerification}
                            className="w-full py-4 bg-gray-50 text-gray-600 font-bold rounded-2xl active:scale-95 transition-all text-sm"
                        >
                            Reenviar correo
                        </button>
                    </div>

                    <button
                        onClick={async () => { await logout(); setVerificationSent(false); }}
                        className="text-xs text-brand-600 font-bold uppercase tracking-widest hover:underline"
                    >
                        Usar otro correo
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-brand-50 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-full max-w-sm">
                {/* Logo / Header */}
                <div className="mb-8">
                    <div className="w-20 h-20 bg-brand-200 rounded-full mx-auto flex items-center justify-center mb-4 shadow-soft">
                        <span className="material-icons text-5xl text-brand-600">pets</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-1">DogFinder</h1>
                    <p className="text-gray-500 text-sm">Regresa a casa sanos y salvos</p>
                </div>

                {!showEmailForm ? (
                    <div className="space-y-4">
                        <button
                            onClick={handleGoogleLogin}
                            disabled={loggingIn || loading}
                            className={`w-full bg-white border border-gray-300 text-gray-700 font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 shadow-sm active:scale-95 transition-all ${(loggingIn || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                            {loggingIn ? 'Conectando...' : 'Entrar con Google'}
                        </button>

                        <button
                            onClick={() => { setShowEmailForm(true); setError(null); }}
                            className="w-full py-4 text-gray-400 font-semibold text-sm hover:text-gray-600 transition"
                        >
                            ¿No tienes Google? Usa tu correo
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleEmailAuth} className="bg-white p-6 rounded-3xl shadow-soft space-y-4 text-left animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="font-bold text-gray-800">{isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}</h2>
                            <button type="button" onClick={() => setShowEmailForm(false)} className="text-gray-400 text-xs">Atrás</button>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Correo Electrónico</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full mt-1 p-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                                placeholder="ejemplo@correo.com"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Contraseña</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full mt-1 p-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                                placeholder="******"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loggingIn}
                            className="w-full py-4 bg-brand-500 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
                        >
                            {loggingIn ? 'Procesando...' : (isRegistering ? 'Registrarme' : 'Entrar')}
                        </button>

                        <p className="text-center text-xs text-gray-400">
                            {isRegistering ? '¿Ya tienes cuenta?' : '¿Nuevo en DogFinder?'} {' '}
                            <span
                                onClick={() => setIsRegistering(!isRegistering)}
                                className="text-brand-600 font-bold cursor-pointer underline"
                            >
                                {isRegistering ? 'Inicia Sesión' : 'Crea una cuenta'}
                            </span>
                        </p>

                        {!isRegistering && (
                            <button
                                type="button"
                                onClick={handlePasswordReset}
                                disabled={loggingIn}
                                className="w-full mt-2 text-center text-xs text-brand-600 font-bold hover:underline"
                            >
                                ¿Olvidaste tu contraseña?
                            </button>
                        )}
                    </form>
                )}

                {/* Debug / Error Panel */}
                {(error || loggingIn) && (
                    <div className="mt-8 p-3 bg-gray-100 rounded-lg text-[10px] font-mono text-gray-500 overflow-hidden text-left">
                        <p>Estado: {user ? 'LOGUEADO' : 'ANÓNIMO'}</p>
                        <p>Loading: {loading ? 'SI' : 'NO'}</p>
                        {error && <p className="text-red-500 mt-1 font-bold">⚠️ {error}</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
