import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { sightingsService } from '../sightingsService';
import { useAuth } from '../context/AuthContext';
import { userService } from '../userService';

export default function DogDetail() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [dog, setDog] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeImg, setActiveImg] = useState(0);
    const [showContact, setShowContact] = useState(false); // Nuevo: Revelar contacto

    useEffect(() => {
        const fetchDog = async () => {
            try {
                const data = await sightingsService.getSightingById(id);
                setDog(data);
                // Inicializamos el mapa después de que el DOM esté listo
                setTimeout(() => {
                    if (data && data.location && user) {
                        initDetailMap(data.location);
                    }
                }, 100);
            } catch (err) {
                console.error("Error fetching dog details:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchDog();
    }, [id]);

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `DogFinder: ${dog.breed || 'Perro'} visto en ${dog.manualLocation || 'una zona cercana'}`,
                    text: `Ayúdanos a encontrar/identificar a este perrito. #${dog.status === 'found' ? 'Encontrado' : 'Perdido'}`,
                    url: window.location.href,
                });
            } catch (err) {
                console.log("Error al compartir:", err);
            }
        } else {
            // Fallback: Copiar al portapapeles
            navigator.clipboard.writeText(window.location.href);
            alert("Enlace copiado al portapapeles 🐾");
        }
    };

    const { user } = useAuth(); // Import useAuth to check ownership

    // Estado para Found Modal y Helper
    const [showFoundModal, setShowFoundModal] = useState(false);
    const [helperEmail, setHelperEmail] = useState('');

    const handleMarkFoundClick = () => {
        setShowFoundModal(true);
    };

    // Estado para Feedback
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submittingFeedback, setSubmittingFeedback] = useState(false);

    const handleFeedbackSubmit = async () => {
        setSubmittingFeedback(true);
        try {
            await sightingsService.addFeedback({
                userId: user?.uid || 'anonymous',
                sightingId: id,
                rating,
                comment,
                timestamp: new Date().toISOString()
            });
            alert("¡Gracias por tus comentarios! Nos ayudan a mejorar cada día. 🐾✨🙏");
            navigate('/'); // Volver al inicio
        } catch (error) {
            console.error("Error enviando feedback:", error);
            navigate('/'); // Volver al inicio de todos modos
        } finally {
            setSubmittingFeedback(false);
        }
    };

    const confirmFound = async (creditEmail = null) => {
        setLoading(true);
        setShowFoundModal(false);
        try {
            // 1. Actualizar estado en firebase
            await sightingsService.markAsFound(id);

            let alertMessage = "¡Qué alegría! Gracias por confirmar que está a salvo. 🎉🐶🏠";

            // 2. GAMIFICACIÓN
            // A) Siempre dar crédito al dueño por cerrar el caso exitosamente
            await userService.ensureUserEmail(user);
            await userService.recordAction(user.uid, 'mark_found');

            // B) Lógica de Créditos a Terceros (Héroe)
            if (creditEmail) {
                // Intentamos dar la insignia al ayudante
                const result = await userService.awardBadgeByEmail(creditEmail, 'hero');

                if (result.success) {
                    alertMessage += `\n\n¡Has dado crédito a ${creditEmail}! Se le ha otorgado la insignia de HÉROE 🦸.\n(Tú también sumas un 'encontrado' a tu historial)`;
                } else {
                    console.warn("Fallo al dar badge:", result.error);
                    alertMessage += `\n\n⚠️ No pudimos encontrar al usuario "${creditEmail}" para darle la insignia. Dile que inicie sesión en la app para activar su perfil.`;
                }
            }
            // C) Si no hubo ayudante externo, verificamos si el dueño gana "Héroe" (por defecto al marcar found)
            else {
                // Ya llamamos a recordAction arriba, que chequea badges automáticos.
                // Podríamos chequear si ganó algo nuevo re-leyendo el perfil, pero por simplicidad
                // asumimos que el mensaje genérico basta o confiamos en las notificaciones del sistema si las hubiera.
                // Simplemente añadimos texto de felicitación.
                alertMessage = "¡Qué alegría! Gracias por confirmar que está a salvo.\nSe ha registrado en tu historial de éxitos.";
            }

            // D) Ángel (Si estaba en resguardo y se solucionó)
            if (dog.status === 'sheltered' && user.uid === dog.userId) {
                const angelAwarded = await userService.awardBadge(user.uid, 'angel');
                if (angelAwarded) {
                    alertMessage += "\n\n😇 ¡Nueva Insignia Desbloqueada: ÁNGEL! Gracias por darle un hogar temporal.";
                }
            }

            // Ya no recargamos, mostramos el modal de feedback
            setLoading(false);
            setShowFeedbackModal(true);

        } catch (error) {
            console.error("Error marcando como encontrado:", error);
            alert(`❌ ERROR CRÍTICO:\n${error.message}\n\nDetalles: ${error.code || 'n/a'}`);
            setLoading(false);
        }
    };

    // Renderizado del Modal definido directamente en el return o como variable, no como componente anidado
    const foundModalContent = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-icons text-3xl">celebration</span>
                    </div>
                    <h3 className="text-xl font-black text-gray-800">¡Final Feliz!</h3>
                    <p className="text-sm text-gray-500 mt-2">Nos alegra que este perrito vuelva a casa. ¿Quién fue el héroe esta vez?</p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => confirmFound(null)}
                        className="w-full py-4 bg-gray-50 hover:bg-green-50 text-gray-800 font-bold rounded-2xl border border-gray-100 hover:border-green-200 transition flex items-center justify-center gap-2 group"
                    >
                        <span className="material-icons text-gray-400 group-hover:text-green-500">person</span>
                        Lo encontré yo mismo
                    </button>

                    <div className="relative border-t border-gray-100 my-4 pt-4">
                        <p className="text-xs text-center text-gray-400 font-bold uppercase tracking-widest mb-3">O da crédito a un ayudante</p>
                        <input
                            type="email"
                            placeholder="Email del Héroe (ej. juan@gmail.com)"
                            className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-200 focus:border-brand-500 focus:ring-0 outline-none text-sm mb-3 transition"
                            value={helperEmail}
                            onChange={(e) => setHelperEmail(e.target.value)}
                        />
                        <button
                            onClick={() => {
                                if (!helperEmail) return alert("Por favor escribe el email del ayudante");
                                confirmFound(helperEmail.toLowerCase().trim());
                            }}
                            disabled={!helperEmail}
                            className="w-full py-4 bg-brand-600 text-white font-bold rounded-2xl shadow-lg shadow-brand-200 disabled:opacity-50 disabled:shadow-none transition active:scale-95"
                        >
                            Dar crédito y Cerrar
                        </button>
                    </div>
                </div>

                <button
                    onClick={() => setShowFoundModal(false)}
                    className="w-full mt-4 py-2 text-gray-400 text-xs font-bold uppercase tracking-widest hover:text-gray-600"
                >
                    Cancelar
                </button>
            </div>
        </div>
    );

    const feedbackModalContent = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
                <h3 className="text-xl font-black text-gray-800 mb-2">¡Caso Cerrado! 🐾</h3>
                <p className="text-sm text-gray-500 mb-6">Gracias por usar DogFinder. ¿Qué te pareció la experiencia?</p>

                <div className="flex justify-center gap-2 mb-6">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            onClick={() => setRating(star)}
                            className="transition transform active:scale-110"
                        >
                            <span className={`material-icons text-4xl ${rating >= star ? 'text-yellow-400' : 'text-gray-200'}`}>
                                star
                            </span>
                        </button>
                    ))}
                </div>

                <textarea
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-200 focus:border-brand-500 focus:ring-0 outline-none text-sm mb-4 resize-none h-24"
                    placeholder="¿Algún comentario o sugerencia?"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                />

                <div className="space-y-3">
                    <button
                        onClick={handleFeedbackSubmit}
                        disabled={submittingFeedback || rating === 0}
                        className="w-full py-4 bg-brand-600 text-white font-bold rounded-2xl shadow-lg shadow-brand-200 disabled:opacity-50 disabled:shadow-none transition active:scale-95 flex items-center justify-center gap-2"
                    >
                        {submittingFeedback ? 'Enviando...' : 'Enviar Calificación'}
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full py-2 text-gray-400 text-xs font-bold uppercase tracking-widest hover:text-gray-600"
                    >
                        Omitir
                    </button>
                </div>
            </div>
        </div>
    );

    const handleHelp = () => {
        const contactSection = document.getElementById('contact-section');
        if (contactSection) {
            setShowContact(true);
            contactSection.scrollIntoView({ behavior: 'smooth' });
        } else {
            setShowContact(true);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-400 font-bold animate-pulse">Buscando rastros...</p>
            </div>
        );
    }

    if (!dog) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
                <span className="material-icons text-6xl text-gray-200 mb-4">search_off</span>
                <h2 className="text-xl font-bold text-gray-800 mb-2">No encontramos este reporte</h2>
                <p className="text-gray-500 mb-6">Parece que el rastro se ha enfriado.</p>
                <button onClick={() => navigate('/')} className="px-6 py-3 bg-brand-500 text-white rounded-xl font-bold">Volver al inicio</button>
            </div>
        );
    }

    const images = dog.images || (dog.image ? [dog.image] : ["https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=600&q=80"]);

    return (
        <div className="min-h-screen bg-white pb-32">
            {showFoundModal && foundModalContent}
            {showFeedbackModal && feedbackModalContent}
            {/* Gallery / Header */}
            <div className="relative h-[450px] bg-gray-900 group">
                {/* Horizontal Scroll Container */}
                <div
                    className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar h-full"
                    onScroll={(e) => {
                        const width = e.target.offsetWidth;
                        const scrollX = e.target.scrollLeft;
                        const idx = Math.round(scrollX / width);
                        if (idx !== activeImg) setActiveImg(idx);
                    }}
                >
                    {images.map((img, idx) => (
                        <div key={idx} className="w-full h-full shrink-0 snap-center">
                            <img
                                src={img}
                                alt={`${dog.breed} - ${idx + 1}`}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ))}
                </div>

                {/* Back Button */}
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-6 left-4 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-lg text-gray-700 z-20 active:scale-90 transition"
                >
                    <span className="material-icons">arrow_back</span>
                </button>

                {/* Gradient Overlay for better readability */}
                <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-white via-white/20 to-transparent z-10 pointer-events-none"></div>

                {/* Image Indicators */}
                {images.length > 1 && (
                    <div className="absolute bottom-16 w-full flex justify-center gap-2 z-20">
                        {images.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1.5 rounded-full transition-all duration-300 ${idx === activeImg ? 'bg-brand-500 w-8' : 'bg-gray-300 w-2'}`}
                            />
                        ))}
                    </div>
                )}

                {/* Floating status tag */}
                <div className={`absolute bottom-16 right-6 text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg z-20 ${dog.status === 'found' ? 'bg-green-500 shadow-green-200' :
                    dog.status === 'sheltered' ? 'bg-indigo-600 shadow-indigo-200' :
                        dog.status === 'sighted' ? 'bg-amber-500 shadow-amber-200' :
                            'bg-red-500 shadow-red-200'
                    }`}>
                    {dog.status === 'found' ? 'Encontrado' :
                        dog.status === 'sheltered' ? 'En resguardo' :
                            dog.status === 'sighted' ? 'Avistamiento' :
                                'Sigue perdido'}
                </div>
            </div>

            {/* Content Container */}
            <div className="-mt-10 relative z-10 bg-white rounded-t-[40px] px-6 pt-10 pb-6">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex-1 pr-4">
                        <h1 className="text-3xl font-black text-gray-900 leading-tight mb-2 capitalize">{dog.breed || 'Raza desconocida'}</h1>
                        <div className="flex items-center text-brand-600 font-bold bg-brand-50 px-3 py-1.5 rounded-xl w-fit">
                            <span className="material-icons text-sm mr-1.5">place</span>
                            <span className="text-sm">{dog.manualLocation || 'Ubicación remota'}</span>
                        </div>
                    </div>
                </div>

                {/* Details Pills */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center gap-3">
                        <div className={`w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center ${dog.status === 'found' ? 'text-green-500' :
                            dog.status === 'sheltered' ? 'text-indigo-600' :
                                dog.status === 'sighted' ? 'text-amber-500' :
                                    'text-red-500'
                            }`}>
                            <span className="material-icons">
                                {dog.status === 'found' ? 'check_circle' :
                                    dog.status === 'sheltered' ? 'home_work' :
                                        dog.status === 'sighted' ? 'visibility' :
                                            'error_outline'}
                            </span>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Reporte</p>
                            <p className={`text-sm font-bold ${dog.status === 'found' ? 'text-green-600' :
                                dog.status === 'sheltered' ? 'text-indigo-600' :
                                    dog.status === 'sighted' ? 'text-amber-600' :
                                        'text-red-600'
                                }`}>
                                {dog.status === 'found' ? 'ENCONTRADO' :
                                    dog.status === 'sheltered' ? 'EN RESGUARDO' :
                                        dog.status === 'sighted' ? 'AVISTAMIENTO' :
                                            'SIGUE PERDIDO'}
                            </p>
                        </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-brand-500">
                            <span className="material-icons">schedule</span>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Publicado</p>
                            <p className="text-sm font-bold text-gray-800">
                                {(() => {
                                    if (dog.createdAt?.seconds) return new Date(dog.createdAt.seconds * 1000).toLocaleDateString();
                                    if (typeof dog.createdAt === 'string') return new Date(dog.createdAt).toLocaleDateString();
                                    return 'Recientemente';
                                })()}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mb-10">
                    <h3 className="font-black text-gray-900 text-lg mb-3 uppercase tracking-tight">Descripción y Notas</h3>
                    <div className="bg-gray-50/50 p-5 rounded-3xl border border-gray-100 italic">
                        <p className="text-gray-600 leading-relaxed text-sm">
                            "{dog.details || 'El usuario no proporcionó detalles adicionales, pero la foto puede dar pistas importantes sobre su estado y ubicación.'}"
                        </p>
                    </div>
                </div>

                {/* Map Section */}
                <div className="mb-8">
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                        <span className="material-icons text-brand-500 mr-2 text-sm">map</span>
                        Punto de avistamiento
                    </h3>
                    <div
                        id="map"
                        className="w-full h-64 rounded-[32px] bg-gray-100 border-4 border-white shadow-soft relative overflow-hidden z-0"
                    >
                        {!user ? (
                            <div className="absolute inset-0 z-10 bg-gray-50/10 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
                                <div className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center mb-4 border border-gray-100">
                                    <span className="material-icons text-brand-500">lock</span>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-4">Inicia sesión para ver la ubicación exacta</p>
                                <button
                                    onClick={() => navigate('/login', { state: { from: window.location.pathname } })}
                                    className="px-6 py-2.5 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-200 active:scale-95 transition-all"
                                >
                                    Entrar Ahora
                                </button>
                            </div>
                        ) : !dog.location && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 backdrop-blur-sm p-6 text-center">
                                <span className="material-icons text-4xl mb-2">location_off</span>
                                <p className="text-xs font-bold uppercase tracking-wider">Sin coordenadas GPS precisas</p>
                                <p className="text-[10px] mt-1 italic">Ubicación reportada: {dog.manualLocation || 'No especificada'}</p>
                            </div>
                        )}
                    </div>
                    {dog.location && (
                        <p className="mt-3 text-[10px] text-gray-400 font-bold uppercase tracking-tighter flex items-center gap-1.5 ml-2">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                            Coordenadas verificadas mediante GPS
                        </p>
                    )}
                </div>

                {/* Contact Section - Protected */}
                <div id="contact-section">
                    {!user ? (
                        <div className="bg-brand-50 p-6 rounded-[32px] text-brand-800 mb-10 text-center border border-brand-100">
                            <span className="material-icons text-4xl mb-2 text-brand-300">lock</span>
                            <p className="text-sm font-bold leading-tight">
                                Por seguridad, inicia sesión para ver los datos de contacto del protector.
                            </p>
                            <button
                                onClick={() => navigate('/login', { state: { from: location } })}
                                className="mt-4 px-6 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest"
                            >
                                Entrar Ahora
                            </button>
                        </div>
                    ) : !showContact ? (
                        <button
                            onClick={handleHelp}
                            className={`w-full py-5 rounded-[24px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 mb-10 ${dog.status === 'found' && !dog.contactInfo
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                                : 'bg-gray-900 text-white'
                                }`}
                            disabled={dog.status === 'found' && !dog.contactInfo}
                        >
                            <span className="material-icons">contact_support</span>
                            {dog.status === 'found' && !dog.contactInfo ? 'Sin datos de contacto' : 'Contactar Protector'}
                        </button>
                    ) : (
                        dog.contactInfo ? (
                            <div className="bg-indigo-600 p-6 rounded-[32px] text-white shadow-xl shadow-indigo-200 mb-10 animate-in zoom-in duration-300">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                        <span className="material-icons">verified_user</span>
                                    </div>
                                    <h4 className="font-black text-xs uppercase tracking-widest">Información de Contacto</h4>
                                </div>
                                <p className="text-xl font-black mb-1 shrink-0">{dog.contactInfo}</p>
                                <p className="text-[10px] opacity-60 font-medium leading-tight">
                                    Por favor, mantén el respeto y la cordialidad al contactar. Di que vienes de DogFinder.
                                </p>
                                <div className="mt-6 flex gap-2">
                                    <a
                                        href={`tel:${dog.contactInfo}`}
                                        className="flex-1 bg-white text-indigo-600 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-center shadow-lg active:scale-95 transition"
                                    >
                                        Llamar Ahora
                                    </a>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(dog.contactInfo);
                                            alert("¡Copiado al portapapeles!");
                                        }}
                                        className="w-12 h-12 bg-indigo-500 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition"
                                    >
                                        <span className="material-icons text-lg">content_copy</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gray-100 p-6 rounded-[32px] text-gray-500 mb-10 text-center border-2 border-dashed border-gray-200">
                                <span className="material-icons text-4xl mb-2 text-gray-300">info</span>
                                <p className="text-xs font-bold leading-tight">
                                    Este reporte es un avistamiento simple y no tiene información de contacto directa.
                                    Por favor, recorre el área indicada en el mapa.
                                </p>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Action Bar */}
            <div className="fixed bottom-0 w-full bg-white/80 backdrop-blur-xl border-t border-gray-100 p-5 pb-safe shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] flex gap-4 z-30">
                {/* Botón de Ayuda / Contacto */}
                <button
                    onClick={handleHelp}
                    disabled={dog.status === 'found' && !dog.contactInfo}
                    className={`flex-1 h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center transition active:scale-95 ${dog.status === 'found' && !dog.contactInfo
                        ? 'bg-gray-200 text-gray-400'
                        : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-200'
                        }`}
                >
                    <span className="material-icons mr-2">chat</span>
                    Ayudar / Info
                </button>

                {/* Info de Expiración (Solo para Avistamientos) */}
                {dog.status === 'sighted' && (
                    <div className="flex flex-col items-center justify-center px-4 bg-amber-50 rounded-2xl border border-amber-100 min-w-[100px]">
                        <span className="text-[8px] font-black uppercase text-amber-600 tracking-tighter">Expira en</span>
                        <span className="text-xs font-bold text-amber-700">
                            {(() => {
                                const now = Date.now();
                                const createdAt = dog.createdAt?.seconds ? dog.createdAt.seconds * 1000 : new Date(dog.createdAt).getTime();
                                const diff = (24 * 60 * 60 * 1000) - (now - createdAt);
                                if (diff <= 0) return "Expirado";
                                const hours = Math.floor(diff / (1000 * 60 * 60));
                                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                return `${hours}h ${mins}m`;
                            })()}
                        </span>
                    </div>
                )}

                {/* Botón "Lo Encontré" (Solo si soy el dueño, NO es avistamiento y no está ya encontrado) */}
                {user && user.uid === dog.userId && dog.status === 'lost' && (
                    <button
                        onClick={handleMarkFoundClick}
                        className="w-14 h-14 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-200 active:scale-95 transition"
                        title="¡Lo encontré!"
                    >
                        <span className="material-icons">check_circle</span>
                    </button>
                )}

                <button
                    onClick={handleShare}
                    className="w-14 h-14 bg-gray-50 border border-gray-100 text-gray-400 rounded-2xl flex items-center justify-center transition hover:bg-gray-100 active:scale-95"
                >
                    <span className="material-icons">share</span>
                </button>
            </div>
        </div>
    );
}


// Helper para inicializar el mapa (se llama desde un useEffect en DogDetail)
function initDetailMap(locationData) {
    if (!locationData || !window.L) return;

    try {
        const coords = typeof locationData === 'string' ? JSON.parse(locationData) : locationData;
        if (!coords.latitude || !coords.longitude) return;

        // Limpieza de instancia previa si existe (Leaflet no permite reinicializar sobre el mismo container fácilmente)
        const container = window.L.DomUtil.get('map');
        if (container && container._leaflet_id) {
            container._leaflet_id = null;
        }

        const map = window.L.map('map', {
            zoomControl: false,
            attributionControl: false
        }).setView([coords.latitude, coords.longitude], 16);

        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 20
        }).addTo(map);

        // Marcador personalizado (Emoji de huella 🐾)
        const heartIcon = window.L.divIcon({
            html: `<div style="background-color: #FFB300; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; items-center; justify-content: center; font-size: 16px; color: white;">🐾</div>`,
            className: 'custom-div-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        window.L.marker([coords.latitude, coords.longitude], { icon: heartIcon }).addTo(map);

        // Círculo de precisión
        window.L.circle([coords.latitude, coords.longitude], {
            color: '#FFB300',
            fillColor: '#FFB300',
            fillOpacity: 0.1,
            radius: 100,
            weight: 1
        }).addTo(map);

    } catch (e) {
        console.error("Error al inicializar mapa:", e);
    }
}
