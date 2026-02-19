import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';

export default function Home() {
    const { alertConfig, saveAlertConfig } = useNotifications();
    const [showAbout, setShowAbout] = useState(false);
    const [showAlerts, setShowAlerts] = useState(false);

    // Estados locales para el formulario de alertas
    const [alertBreed, setAlertBreed] = useState(alertConfig?.breed || '');
    const [alertLocation, setAlertLocation] = useState(alertConfig?.location || null);
    const [isLocating, setIsLocating] = useState(false);

    const handleSaveAlert = () => {
        saveAlertConfig({ breed: alertBreed, location: alertLocation });
        setShowAlerts(false);
    };

    const handleGetLocation = () => {
        setIsLocating(true);
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                setAlertLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
                setIsLocating(false);
            }, (error) => {
                console.error("Error GPS:", error);
                alert("No pudimos obtener tu ubicación. Asegúrate de dar permisos.");
                setIsLocating(false);
            });
        } else {
            alert("Tu navegador no soporta geolocalización.");
            setIsLocating(false);
        }
    };

    return (
        <div className="min-h-screen bg-white pb-20">
            {/* Header Flotante */}
            <div className="absolute top-0 left-0 right-0 p-4 pt-safe z-30 flex justify-between items-start pointer-events-none">
                {/* Logo / Brand (Opcional, por ahora vacío para no saturar) */}
                <div></div>

                {/* Botones de Acción (Pointer events auto para que funcionen) */}
                <div className="flex gap-3 pointer-events-auto">
                    <button
                        onClick={() => {
                            setAlertBreed(alertConfig?.breed || '');
                            setAlertLocation(alertConfig?.location || null);
                            setShowAlerts(true);
                        }}
                        className="bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/30 transition shadow-sm"
                    >
                        <span className="material-icons">{alertConfig ? 'notifications_active' : 'notifications_none'}</span>
                    </button>
                    <button
                        onClick={() => setShowAbout(true)}
                        className="bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/30 transition shadow-sm"
                    >
                        <span className="material-icons">pets</span>
                    </button>
                </div>
            </div>

            {/* Hero Section */}
            <div className="bg-brand-500 pt-safe pb-16 px-6 rounded-b-[40px] shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <span className="material-icons text-[200px] absolute -top-10 -right-10 rotate-12">pets</span>
                    <span className="material-icons text-[150px] absolute bottom-0 -left-10 -rotate-12">volunteer_activism</span>
                </div>

                <div className="relative z-10 pt-12">
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight drop-shadow-sm">
                        ¡Juntos los<br />encontraremos! 🐾
                    </h1>
                    <p className="text-brand-100 text-lg font-medium max-w-xs leading-relaxed">
                        La comunidad #1 para reunir mascotas con sus familias usando IA.
                    </p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="px-6 -mt-10 relative z-20 space-y-4">
                <Link to="/report?type=lost" className="block group">
                    <div className="bg-white p-6 rounded-[32px] shadow-xl border border-gray-100 flex items-center justify-between hover:shadow-2xl transition active:scale-98">
                        <div>
                            <h2 className="text-xl font-black text-gray-900 mb-1">Perdí mi mascota</h2>
                            <p className="text-gray-500 text-xs font-medium">Publica una alerta rápida</p>
                        </div>
                        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center group-hover:bg-red-200 transition">
                            <span className="material-icons text-red-500 text-3xl">campaign</span>
                        </div>
                    </div>
                </Link>

                <Link to="/search" className="block group">
                    <div className="bg-gray-900 p-6 rounded-[32px] shadow-xl flex items-center justify-between hover:bg-gray-800 transition active:scale-98">
                        <div>
                            <h2 className="text-xl font-black text-white mb-1">Encontré uno</h2>
                            <p className="text-gray-400 text-xs font-medium">Identifícalo con la cámara</p>
                        </div>
                        <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition">
                            <span className="material-icons text-brand-400 text-3xl">photo_camera</span>
                        </div>
                    </div>
                </Link>
            </div>

            {/* Stats / Info */}
            <div className="px-6 py-10">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-black text-gray-900 text-lg">Actividad Reciente</h3>
                    <Link to="/search" className="text-brand-600 text-sm font-bold hover:underline">Ver todo</Link>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">
                        <span className="material-icons text-brand-500 text-3xl mb-2">visibility</span>
                        <div className="text-2xl font-black text-gray-900">124</div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Avistamientos</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-2xl border border-green-100 text-center">
                        <span className="material-icons text-green-500 text-3xl mb-2">check_circle</span>
                        <div className="text-2xl font-black text-gray-900">42</div>
                        <div className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Reunidos</div>
                    </div>
                </div>
            </div>

            {/* Modal Acerca de / Donaciones */}
            {showAbout && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl relative overflow-hidden">
                        <button onClick={() => setShowAbout(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                            <span className="material-icons">close</span>
                        </button>

                        <div className="text-center">
                            <div className="w-16 h-16 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm">
                                <span className="material-icons">pets</span>
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 mb-4">DogFinder</h2>

                            <blockquote className="text-gray-600 text-sm mb-4 italic leading-relaxed relative px-4">
                                <span className="text-4xl text-brand-200 absolute -top-2 left-0">"</span>
                                Un perro perdido no es solo un cartel de 'Se Busca' en un poste. Es un silencio en la casa, un plato lleno que nadie toca, un miembro de la familia que falta.
                                <br /><br />
                                Creamos esto porque entendemos ese dolor y creemos que la tecnología puede hacer milagros cuando el amor es el motor.
                                <span className="text-4xl text-brand-200 absolute -bottom-4 right-0 leading-none">"</span>
                            </blockquote>

                            <div className="text-center mb-6">
                                <div className="font-serif text-xl font-bold text-gray-900 tracking-wide border-b border-gray-200 inline-block pb-1 mb-1">Angel Yanif Mosso</div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-medium">Creador de DogFinder</div>
                            </div>

                            <div className="bg-brand-50 rounded-2xl p-5 mb-6 border border-brand-100 shadow-inner">
                                <h3 className="font-black text-brand-800 mb-2 text-sm">¿Nos ayudas a seguir? ☕</h3>
                                <p className="text-xs text-brand-600/80 mb-4 font-medium leading-snug">
                                    DogFinder vive gracias a personas como tú. Tu donación mantiene los servidores activos y nos permite crear nuevas herramientas de búsqueda.
                                </p>
                                <a
                                    href="https://paypal.me/AngelYanifMosso"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block bg-[#0070BA] text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-blue-500/30 hover:bg-[#003087] transition active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <span className="material-icons text-sm">savings</span>
                                    Donar con PayPal
                                </a>
                            </div>

                            <p className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">Made with ❤️ for lost tails</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Alertas */}
            {showAlerts && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl">
                        <h2 className="text-xl font-black text-gray-900 mb-1">Configurar Alertas 🔔</h2>
                        <p className="text-gray-500 text-xs mb-4">Te avisaremos si alguien reporta una mascota similar.</p>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Raza o Tipo</label>
                                <input
                                    type="text"
                                    value={alertBreed}
                                    onChange={(e) => setAlertBreed(e.target.value)}
                                    placeholder="Ej. Labrador, Gato negro..."
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                />
                            </div>

                            {/* Selector de Ubicación GPS */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Ubicación de Búsqueda</label>

                                {alertLocation && alertLocation.latitude ? (
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between animate-in fade-in">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                                <span className="material-icons text-sm">my_location</span>
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-green-800">GPS Activado</p>
                                                <p className="text-[10px] text-green-600 font-medium">
                                                    {alertLocation.latitude.toFixed(4)}, {alertLocation.longitude.toFixed(4)}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setAlertLocation(null)}
                                            className="w-8 h-8 rounded-full hover:bg-green-100 text-green-600 flex items-center justify-center transition"
                                        >
                                            <span className="material-icons text-sm">close</span>
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleGetLocation}
                                        disabled={isLocating}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-center gap-2 hover:bg-gray-100 active:scale-98 transition group"
                                    >
                                        {isLocating ? (
                                            <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <span className="material-icons text-gray-400 group-hover:text-brand-500 transition-colors">near_me</span>
                                        )}
                                        <span className={`text-sm font-bold ${isLocating ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {isLocating ? 'Obteniendo GPS...' : 'Usar mi ubicación actual'}
                                        </span>
                                    </button>
                                )}
                                <p className="text-[10px] text-gray-400 mt-2 ml-1">
                                    * Usaremos el GPS para buscar coincidencias cercanas (5km)
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowAlerts(false)}
                                className="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-brand-50 hover:text-brand-600 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveAlert}
                                disabled={!alertBreed}
                                className="flex-1 py-3 rounded-xl font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-600/30 transition disabled:opacity-50 disabled:shadow-none"
                            >
                                Guardar Alerta
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
