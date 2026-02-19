import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sightingsService } from '../sightingsService';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

import { userService } from '../userService';

export default function Profile() {
    const { user, logout, updateUserProfile, updateUserEmail, updateUserPassword, deleteAccount } = useAuth();
    const navigate = useNavigate();
    const [mySightings, setMySightings] = useState([]);
    const [loading, setLoading] = useState(true);
    // Gamification State
    const [stats, setStats] = useState({ reports: 0, found: 0 });
    const [badges, setBadges] = useState([]);
    const [showBadgeModal, setShowBadgeModal] = useState(false);

    useEffect(() => {
        if (user) {
            const fetchMyStuff = async () => {
                try {
                    // Sincronizar email para que otros puedan darme crédito
                    await userService.ensureUserEmail(user);

                    const [sightingsData, profileData] = await Promise.all([
                        sightingsService.getSightingsByUser(user.uid),
                        userService.getUserProfile(user.uid)
                    ]);

                    setMySightings(sightingsData);
                    if (profileData) {
                        setStats(profileData.stats || { reports: 0, found: 0 });
                        setBadges(profileData.badges || []);
                    }
                } catch (err) {
                    console.error("Error al cargar perfil:", err);
                } finally {
                    setLoading(false);
                }
            };
            fetchMyStuff();
        }
    }, [user]);

    // Edit states
    const [showEdit, setShowEdit] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [newPhoto, setNewPhoto] = useState(null);
    const [newEmail, setNewEmail] = useState('');
    const [newPass, setNewPass] = useState('');

    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    };

    const handlePhotoChange = async (e) => {
        try {
            // 1. Intentar Cámara Nativa
            const image = await Camera.getPhoto({
                quality: 60,
                allowEditing: true, // Permitir recorte en perfil
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Prompt
            });
            if (image.dataUrl) {
                setNewPhoto(image.dataUrl);
            }
        } catch (nativeErr) {
            console.warn("Cámara nativa no disponible, usando fallback web...", nativeErr);
            // 2. Fallback Web
            const file = e?.target?.files?.[0];
            if (!file) return;

            // Comprimir imagen antes de setearla
            try {
                const compressed = await compressImage(file);
                setNewPhoto(compressed);
            } catch (err) {
                console.error("Error comprimiendo:", err);
                alert("No se pudo procesar la imagen");
            }
        };
    };

    const handleUpdateProfile = async () => {
        setUpdating(true);
        try {
            // 1. Preparar actualizaciones de perfil
            const profileUpdates = {};

            if (newPhoto) {
                console.log("Subiendo nueva foto de perfil...");
                try {
                    // Usamos la nueva versión de uploadImage que es más compatible con Android
                    const photoUrl = await sightingsService.uploadImage(newPhoto, user.uid);
                    console.log("Foto subida con éxito:", photoUrl);
                    profileUpdates.photoURL = photoUrl;
                } catch (imgErr) {
                    throw new Error("No se pudo subir la imagen: " + imgErr.message);
                }
            }

            // Aplicar actualizaciones de Firebase Auth (Foto/Nombre)
            if (Object.keys(profileUpdates).length > 0) {
                await updateUserProfile(profileUpdates);
                console.log("Perfil de Auth actualizado.");
            }

            // 2. Actualizar Email si cambió
            if (newEmail && newEmail !== user.email) {
                await updateUserEmail(newEmail);
                console.log("Email actualizado.");
            }

            // 3. Actualizar Contraseña si se ingresó una nueva
            if (newPass) {
                await updateUserPassword(newPass);
                console.log("Contraseña actualizada.");
            }

            alert("¡Perfil actualizado con éxito! ✨");
            setShowEdit(false);
            setNewPass('');
            setNewPhoto(null);
            setNewEmail('');

            // Recargar para que AuthContext detecte los cambios profundos del token
            setTimeout(() => {
                window.location.reload();
            }, 800);

        } catch (err) {
            console.error("Error actualizando perfil:", err);
            if (err.code === 'auth/requires-recent-login' || err.message.includes('recent-login')) {
                alert("Por seguridad, necesitas volver a iniciar sesión para cambiar datos sensibles.");
                await logout();
                navigate('/login');
            } else {
                alert("Error: " + err.message);
            }
        } finally {
            if (mounted.current) setUpdating(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (confirm("⚠️ ¿Estás COMPLETAMENTE seguro? Esta acción no se puede deshacer y perderás el acceso a tu cuenta y medallas permanentemente.")) {
            setUpdating(true);
            try {
                // 1. Borrar datos del usuario en Firestore (Insignias, stats)
                await userService.deleteUserData(user.uid);
                // 2. Borrar cuenta en Firebase Auth
                await deleteAccount();
                alert("Cuenta eliminada exitosamente. Sentimos verte partir. 🐾");
                navigate('/login');
            } catch (err) {
                console.error("Error al eliminar cuenta:", err);
                if (err.code === 'auth/requires-recent-login') {
                    alert("Por seguridad, debes haber iniciado sesión recientemente para borrar tu cuenta. Por favor, sal e inicia sesión de nuevo.");
                } else {
                    alert("Error al eliminar cuenta: " + err.message);
                }
            } finally {
                setUpdating(false);
            }
        }
    };

    // Ref para montar
    const mounted = React.useRef(true);
    useEffect(() => () => { mounted.current = false; }, []);

    const BadgeModal = () => (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowBadgeModal(false)}>
            <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-gray-800">Insignias</h3>
                    <button onClick={() => setShowBadgeModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200">
                        <span className="material-icons text-sm">close</span>
                    </button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {Object.values(userService.BADGES).map(badge => {
                        const isUnlocked = badges.includes(badge.id);
                        return (
                            <div key={badge.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isUnlocked ? 'bg-white border-brand-100 shadow-sm' : 'bg-gray-50 border-transparent opacity-60'}`}>
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-sm shrink-0 ${isUnlocked ? badge.bg : 'bg-gray-200'}`}>
                                    <span className={`material-icons text-3xl ${isUnlocked ? badge.color : 'text-gray-400'}`}>{badge.icon}</span>
                                </div>
                                <div>
                                    <h4 className={`font-black text-sm ${isUnlocked ? 'text-gray-800' : 'text-gray-500'}`}>
                                        {badge.name}
                                        {isUnlocked && <span className="ml-2 text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Desbloqueado</span>}
                                    </h4>
                                    <p className="text-xs text-gray-500 leading-tight mt-1">{badge.description}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    const handleDelete = async (sightingId, createdAt) => {
        const createdDate = createdAt?.seconds ? new Date(createdAt.seconds * 1000) : new Date(createdAt);
        const diffMs = new Date() - createdDate;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 60) {
            alert(`Para evitar errores, debes esperar ${60 - diffMins} minutos más para borrar este reporte.`);
            return;
        }

        if (confirm("¿Estás seguro de que quieres borrar este reporte permanentemente?")) {
            try {
                await sightingsService.deleteSighting(sightingId);
                setMySightings(prev => prev.filter(s => s.id !== sightingId));
            } catch (err) {
                alert("No se pudo borrar el reporte. Inténtalo de nuevo.");
            }
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50 pb-24 text-gray-800">
            {/* Modal */}
            {showBadgeModal && <BadgeModal />}

            {/* Profile Header */}
            <div className="bg-brand-600 pt-12 pb-24 px-6 rounded-b-[40px] text-white relative overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <span className="material-icons text-9xl">pets</span>
                </div>

                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-24 h-24 bg-white rounded-full p-1 shadow-2xl mb-4">
                        <img
                            src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}&background=random`}
                            alt="Avatar"
                            className="w-full h-full rounded-full object-cover"
                        />
                    </div>
                    <h2 className="text-2xl font-black">{user.displayName || 'Usuario de DogFinder'}</h2>
                    <p className="text-brand-100 opacity-80 text-sm font-bold tracking-tight">{user.email}</p>

                    {/* Badges Row (Mini) - Clickable */}
                    <div className="flex gap-2 mt-4 cursor-pointer active:scale-95 transition" onClick={() => setShowBadgeModal(true)}>
                        {Object.values(userService.BADGES).map(badge => {
                            const isUnlocked = badges.includes(badge.id);
                            if (!isUnlocked) return null;
                            return (
                                <div key={badge.id} className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm" title={badge.name}>
                                    <span className="material-icons text-white text-sm">{badge.icon}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Content Container */}
            <div className="px-6 -mt-12 relative z-10 space-y-6">

                {/* My Stats Card */}
                <div className="bg-white rounded-3xl p-6 shadow-soft border border-gray-100 flex items-center justify-around text-center">
                    <div>
                        <p className="text-2xl font-black text-gray-800">{mySightings.length}</p>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Reportes</p>
                    </div>
                    <div className="w-px h-8 bg-gray-100"></div>
                    <div>
                        <p className="text-2xl font-black text-gray-800">{stats.found || 0}</p>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Encontrados</p>
                    </div>
                    <div className="w-px h-8 bg-gray-100"></div>
                    <div onClick={() => setShowBadgeModal(true)} className="cursor-pointer active:opacity-70 transition">
                        <p className="text-2xl font-black text-gray-800">{badges.length}</p>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Insignias</p>
                    </div>
                </div>

                {/* Badges Section - Clickable */}
                <div onClick={() => setShowBadgeModal(true)} className="cursor-pointer group">
                    <div className="flex items-center justify-between mb-3 mx-1">
                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Mis Logros</h3>
                        <span className="text-[10px] text-brand-500 font-bold bg-brand-50 px-2 py-0.5 rounded-full group-hover:bg-brand-100 transition">Ver todos</span>
                    </div>
                    <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-5 grid grid-cols-3 gap-4 group-active:scale-[0.98] transition">
                        {Object.values(userService.BADGES).slice(0, 3).map(badge => { // Show only first 3 or generic
                            const isUnlocked = badges.includes(badge.id);
                            return (
                                <div key={badge.id} className={`flex flex-col items-center text-center p-2 rounded-xl transition ${isUnlocked ? 'bg-gray-50' : 'opacity-40 grayscale'}`}>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 shadow-sm ${isUnlocked ? badge.bg : 'bg-gray-100'}`}>
                                        <span className={`material-icons text-2xl ${isUnlocked ? badge.color : 'text-gray-400'}`}>{badge.icon}</span>
                                    </div>
                                    <p className="text-xs font-bold text-gray-800 leading-tight">{badge.name}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* My Reports Section */}
                <div>
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest ml-1 mb-3">Mis Reportes Recientes</h3>
                    <div className="bg-white rounded-3xl shadow-soft border border-gray-100 overflow-hidden">
                        {loading ? (
                            <div className="p-8 flex justify-center">
                                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : mySightings.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                                {mySightings.slice(0, 5).map(sighting => {
                                    const createdDate = sighting.createdAt?.seconds ? new Date(sighting.createdAt.seconds * 1000) : new Date(sighting.createdAt);
                                    const diffMs = new Date() - createdDate;
                                    const diffHours = diffMs / 3600000;
                                    const canDelete = diffHours >= 1;

                                    return (
                                        <div key={sighting.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition relative group">
                                            <Link to={`/detail/${sighting.id}`} className="flex-1 flex items-center gap-4">
                                                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 border border-gray-100">
                                                    <img
                                                        src={(sighting.images && sighting.images.length > 0) ? sighting.images[0] : (sighting.image || "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=150&q=80")}
                                                        alt={sighting.breed}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-bold text-gray-800 text-sm leading-tight">{sighting.breed || 'Raza desconocida'}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                                                        {sighting.status === 'found' ? '🟢 Encontrado' :
                                                            sighting.status === 'sheltered' ? '🏠 En resguardo' :
                                                                '🔴 Perdido'}
                                                        <span className="mx-1 opacity-20">•</span>
                                                        {createdDate.toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </Link>

                                            <button
                                                onClick={() => handleDelete(sighting.id, sighting.createdAt)}
                                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${canDelete ? 'bg-red-50 text-red-400 hover:bg-red-100' : 'bg-gray-50 text-gray-200 cursor-not-allowed'}`}
                                                title={canDelete ? "Borrar reporte" : "Podrás borrarlo 1h después de publicarlo"}
                                            >
                                                <span className="material-icons text-lg">{canDelete ? 'delete_outline' : 'lock_clock'}</span>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-10 text-center">
                                <span className="material-icons text-4xl text-gray-200 mb-2">history</span>
                                <p className="text-xs text-gray-400 italic">Aún no has reportado nada.</p>
                            </div>
                        )}
                        {mySightings.length > 3 && (
                            <button className="w-full py-4 text-xs font-black text-brand-600 uppercase tracking-widest border-t border-gray-50 bg-brand-50/20 active:bg-brand-50 transition">
                                Ver todos mis reportes ({mySightings.length})
                            </button>
                        )}
                    </div>
                </div>

                {/* Settings & Logout */}
                <div className="bg-white rounded-3xl shadow-soft overflow-hidden border border-gray-100 transition-all duration-500">
                    <div
                        onClick={() => setShowEdit(!showEdit)}
                        className={`p-4 border-b border-gray-50 flex items-center gap-4 hover:bg-gray-50 transition cursor-pointer ${showEdit ? 'bg-brand-50/50' : ''}`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${showEdit ? 'bg-brand-500 text-white' : 'bg-purple-50 text-purple-600'}`}>
                            <span className="material-icons">{showEdit ? 'close' : 'settings'}</span>
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-gray-800 text-sm">{showEdit ? 'Cancelar Edición' : 'Configuración'}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">{showEdit ? 'Toca para volver' : 'Cuenta y Privacidad'}</p>
                        </div>
                        <span className={`material-icons text-gray-300 transition-transform duration-300 ${showEdit ? 'rotate-90' : ''}`}>chevron_right</span>
                    </div>

                    {/* Edit Form Section */}
                    {showEdit && (
                        <div className="p-6 bg-white space-y-5 animate-in slide-in-from-top-4 duration-300">
                            {/* Photo Edit */}
                            <div className="flex flex-col items-center">
                                <div className="relative group">
                                    <div className="w-20 h-20 bg-gray-100 rounded-full overflow-hidden border-4 border-white shadow-md">
                                        <img src={newPhoto || user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} className="w-full h-full object-cover" alt="Profile" />
                                    </div>
                                    <div
                                        onClick={handlePhotoChange}
                                        className="absolute bottom-0 right-0 w-8 h-8 bg-brand-600 text-white rounded-full flex items-center justify-center shadow-lg cursor-pointer active:scale-90 transition"
                                    >
                                        <span className="material-icons text-sm">photo_camera</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mt-3 tracking-widest">Toca para cambiar foto</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1.5 ml-1">Nuevo Correo</label>
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        placeholder={user.email}
                                        className="w-full bg-gray-50 p-4 rounded-2xl border border-gray-100 text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1.5 ml-1">Nueva Contraseña</label>
                                    <input
                                        type="password"
                                        value={newPass}
                                        onChange={(e) => setNewPass(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-gray-50 p-4 rounded-2xl border border-gray-100 text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none transition"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleUpdateProfile}
                                disabled={updating}
                                className="w-full bg-brand-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-brand-200 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {updating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-icons text-sm">save</span>
                                        Guardar Cambios
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    <div
                        onClick={handleLogout}
                        className="p-4 flex items-center gap-4 hover:bg-red-50 transition active:bg-red-100 cursor-pointer"
                    >
                        <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                            <span className="material-icons">logout</span>
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-red-600 text-sm focus:outline-none">Cerrar Sesión</p>
                            <p className="text-[10px] text-red-400 uppercase font-bold">Salir de tu cuenta</p>
                        </div>
                        <span className="material-icons text-red-200">chevron_right</span>
                    </div>

                    <div
                        onClick={handleDeleteAccount}
                        className="p-4 flex items-center gap-4 hover:bg-red-50 transition active:bg-red-100 cursor-pointer border-t border-gray-50"
                    >
                        <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                            <span className="material-icons">no_accounts</span>
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-red-600 text-sm">Eliminar mi Cuenta</p>
                            <p className="text-[10px] text-red-400 uppercase font-bold text-left">Acción irreversible</p>
                        </div>
                        <span className="material-icons text-red-200">chevron_right</span>
                    </div>

                    <div
                        onClick={() => navigate('/terms')}
                        className="p-4 flex items-center gap-4 hover:bg-brand-50 transition active:bg-brand-100 cursor-pointer border-t border-gray-50"
                    >
                        <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center">
                            <span className="material-icons">policy</span>
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-gray-800 text-sm">Términos y Condiciones</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold text-left">Privacidad y Protección Legal</p>
                        </div>
                        <span className="material-icons text-gray-300">chevron_right</span>
                    </div>
                </div>

                {/* Info Card - Clickable Donation */}
                <div
                    onClick={() => window.open('https://paypal.me/AngelYanifMosso', '_blank')}
                    className="bg-brand-50 p-6 rounded-[32px] border border-brand-100 flex items-center gap-6 shadow-inner cursor-pointer active:scale-[0.98] transition-all hover:bg-brand-100/50"
                >
                    <div className="flex-1">
                        <h4 className="font-black text-brand-800 mb-1 leading-tight">¡Gracias por ayudar! 🐾</h4>
                        <p className="text-[11px] text-brand-600/80 leading-relaxed font-medium">Cada reporte cuenta para que un perrito vuelva a casa. Tu actividad es vital para la comunidad.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
