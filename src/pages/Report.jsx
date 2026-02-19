import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sightingsService } from '../sightingsService';
import { userService } from '../userService';
import { aiModel } from '../utils/aiModel';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import CameraInterface from '../components/CameraInterface';
import { safeStorage } from '../utils/safeStorage';

export default function Report() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [images, setImages] = useState([]); // Array para hasta 3 fotos

    const [location, setLocation] = useState(null);
    const [manualLocation, setManualLocation] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [uploadStep, setUploadStep] = useState(''); // 'image' o 'data'
    const [details, setDetails] = useState('');
    const [breed, setBreed] = useState('');
    const [contactInfo, setContactInfo] = useState(''); // Nuevo: Teléfono o RRSS
    const [status, setStatus] = useState('lost'); // 'lost', 'found' o 'sheltered'
    const [skipImage, setSkipImage] = useState(false); // Para depurar
    const [useREST, setUseREST] = useState(false); // DESACTIVADO POR DEFECTO: El SDK es más estable para subir fotos

    const [lastError, setLastError] = useState(null); // Para mostrar en pantalla
    const [debugLogs, setDebugLogs] = useState([]);
    const [showCamera, setShowCamera] = useState(false);
    const [safetyLabels, setSafetyLabels] = useState({}); // Nuevo: Almacena el diagnóstico por imagen

    // Logger para desarrollo (se silencia en producción si se desea)
    const logDebug = (msg) => {
        if (process.env.NODE_ENV === 'development') {
            console.debug(`[Report] ${msg}`);
        }
    };

    /**
     * Persistencia local de borradores para recuperación ante cierres inesperados.
     */
    React.useEffect(() => {
        const draft = safeStorage.getItem('dog_report_draft');
        if (draft) {
            try {
                const parsed = JSON.parse(draft);
                setDetails(parsed.details || '');
                setBreed(parsed.breed || '');
                setContactInfo(parsed.contactInfo || '');
                setManualLocation(parsed.manualLocation || '');
                setStatus(parsed.status || 'lost');
                logDebug("Borrador recuperado");
            } catch (e) {
                console.error("Error recuperando borrador:", e);
            }
        }
    }, []);

    React.useEffect(() => {
        const draft = { details, breed, contactInfo, manualLocation, status };
        safeStorage.setItem('dog_report_draft', JSON.stringify(draft));
    }, [details, breed, contactInfo, manualLocation, status]);

    // Helper para meter un timeout a las promesas
    const withTimeout = (promise, ms = 15000) => {
        // ...

        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado (Timeout)')), ms))
        ]);
    };

    const compressImage = (base64Str, maxWidth = 600, maxHeight = 600) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Comprimimos agresivamente a 0.5 de calidad
                resolve(canvas.toDataURL('image/jpeg', 0.5));
            };
        });
    };


    /**
     * Inicialización automática de geolocalización.
     */
    React.useEffect(() => {
        if (!location && !manualLocation) {
            getLocation();
        }
    }, []);

    const [aiTags, setAiTags] = useState([]); // Etiquetas detectadas por IA para la DB

    const handleCapture = () => {
        if (images.length >= 3) {
            alert("Máximo 3 fotos por reporte.");
            return;
        }
        setShowCamera(true);
    };

    const onPhotoCaptured = async (base64Data) => {
        setUploadStep('Validando seguridad...');
        try {
            const index = images.length;
            const safety = await runSafetyCheck(base64Data, index);

            if (!safety.isSafe) {
                alert("🐶 ¡Ups! Esa foto no parece ser de un perrito. Por favor, intenta con otra foto que sea apropiada para la comunidad.");
                setUploadStep('');
                setShowCamera(false);
                return;
            }

            setImages(prev => {
                const newImages = [...prev, base64Data];
                if (prev.length === 0) {
                    triggerAIAnalysis(base64Data).catch(console.error);
                }
                return newImages;
            });
            setShowCamera(false);
        } catch (err) {
            console.error("Error en validación:", err);
            setUploadStep('');
            setShowCamera(false);
        }
    };

    const triggerAIAnalysis = async (compressedData) => {
        setUploadStep('IA Analizando rasgos...');
        try {
            const predictions = await aiModel.classifyImage(compressedData);
            if (predictions && predictions.length > 0) {
                setAiTags(predictions);
                const suggestedBreed = predictions[0].className.split(',')[0];
                if (!breed || breed === 'Desconocido' || breed === '') {
                    setBreed(suggestedBreed);
                    logDebug(`Raza sugerida: ${suggestedBreed}`);
                }
            }
        } catch (err) {
            console.error(`Fallo análisis IA: ${err.message}`);
        } finally {
            setUploadStep('');
        }
    };

    const runSafetyCheck = async (base64, index) => {
        try {
            const safety = await aiModel.checkSafety(base64);
            setSafetyLabels(prev => ({ ...prev, [index]: safety }));
            return safety;
        } catch (e) {
            console.error("Safety check error:", e);
            return { isSafe: true };
        }
    };

    const handleGalleryUpload = async () => {
        if (images.length >= 3) return;
        try {
            const photo = await Camera.getPhoto({
                quality: 80,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source: CameraSource.Photos
            });
            const base64Data = `data:image/${photo.format};base64,${photo.base64String}`;

            setUploadStep('Validando seguridad...');
            const safety = await aiModel.checkSafety(base64Data);
            setUploadStep('');

            if (!safety.isSafe) {
                alert("⚠️ CONTENIDO RECHAZADO: La imagen seleccionada no es apta para la comunidad.");
                return;
            }

            onPhotoCaptured(base64Data);
        } catch (e) {
            console.log("Galería cancelada o error:", e);
            setUploadStep('');
        }
    };

    const removeImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };


    const getLocation = () => {
        setLoading(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
                setLoading(false);
            }, (error) => {
                console.error("Error obtaining location", error);
                setLoading(false);
                // Explicación técnica: HTTPS es obligatorio para Geolocation en IPs externas
                if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
                    alert("El GPS requiere HTTPS. Usa la ubicación manual para esta prueba.");
                } else {
                    alert("No se pudo obtener la ubicación GPS.");
                }
            });
        } else {
            alert("Tu navegador no soporta GPS.");
            setLoading(false);
        }
    };


    const resetForm = () => {
        setImages([]);
        setLocation(null);
        setManualLocation('');
        setDetails('');
        setBreed('');
        setContactInfo('');
        setStatus('lost');
        setAiTags([]);
        setUploadStep('');
        setSubmitting(false);
        setLastError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) {
            alert("Debes estar logueado para reportar.");
            return;
        }

        if (!location && !manualLocation) {
            alert("Por favor, activa el GPS o escribe la ubicación.");
            return;
        }

        // Anti-Spam: Rate limiting de 30 segundos
        const lastSubmission = safeStorage.getItem('last_report_time');
        const now = Date.now();
        if (lastSubmission && (now - parseInt(lastSubmission)) < 30000) {
            alert("⚠️ Por favor espera unos segundos antes de publicar otro reporte.");
            return;
        }

        setSubmitting(true);
        setUploadStep('Iniciando envío...');
        setLastError(null);

        try {
            let finalImages = [];

            if (images.length > 0 && !skipImage) {
                setUploadStep(`Procesando imágenes...`);

                // Optimización y subida en paralelo para mejor rendimiento
                const uploadPromises = images.map(async (img) => {
                    const compressedBase64 = await compressImage(img);
                    return await withTimeout(sightingsService.uploadImage(compressedBase64, user.uid), 90000);
                });

                finalImages = await Promise.all(uploadPromises);
            }

            setUploadStep('Guardando reporte...');

            const sightingData = {
                images: finalImages,
                image: finalImages[0] || null,
                location: location ? JSON.stringify(location) : null,
                manualLocation,
                details,
                breed: breed || 'Desconocido',
                status,
                contactInfo,
                userId: user.uid,
                aiTags: aiTags
            };

            await withTimeout(sightingsService.createSightingRaw(sightingData), 60000);

            setUploadStep('¡Finalizado!');
            safeStorage.removeItem('dog_report_draft');
            safeStorage.setItem('last_report_time', Date.now().toString());

            // Gamificación: Registro asíncrono (no bloqueante)
            if (user) {
                userService.ensureUserEmail(user).catch(console.error);
                userService.recordAction(user.uid, 'create_report').catch(console.error);
            }

            alert("¡Reporte enviado exitosamente! 🎉");
            resetForm();
        } catch (error) {
            console.error("Error en flujo de reporte:", error);
            const stepName = uploadStep;
            setLastError(`Error: ${error.message}`);
            setSubmitting(false);

            if (error.message.includes('permission-denied')) {
                alert(`🚫 Acceso denegado. Verifica tu sesión.`);
            } else if (error.message.includes('Timeout')) {
                alert(`⌛ La conexión es inestable. Intenta de nuevo.`);
            } else {
                alert(`❌ Ocurrió un error al enviar.`);
            }
        }
    };

    return (
        <div className={`min-h-screen pb-32 transition-colors duration-500 ${showCamera ? 'bg-transparent' : 'bg-gray-50'}`}>
            {showCamera && (
                <CameraInterface
                    onCapture={onPhotoCaptured}
                    onClose={() => setShowCamera(false)}
                />
            )}

            <div className={`p-6 pt-8 max-w-2xl mx-auto space-y-8 ${showCamera ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <header className="flex items-center">
                    <button onClick={() => navigate(-1)} className="mr-4 text-gray-500">
                        <span className="material-icons">arrow_back</span>
                    </button>
                    <h1 className="text-2xl font-bold text-gray-800">¡Aviso Urgente! 🐶</h1>
                </header>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Status Toggle - More Space */}
                    <div className="flex bg-gray-100 p-2.5 rounded-2xl gap-4">
                        <button
                            type="button"
                            onClick={() => setStatus('lost')}
                            className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-tighter transition shadow-sm ${status === 'lost' ? 'bg-red-500 text-white shadow-red-200' : 'text-gray-400'}`}
                        >
                            Lo perdí 💔
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatus('sighted')}
                            className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-tighter transition shadow-sm ${status === 'sighted' ? 'bg-amber-500 text-white shadow-amber-200' : 'text-gray-400'}`}
                        >
                            Lo vi ✨
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatus('sheltered')}
                            className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-tighter transition shadow-sm ${status === 'sheltered' ? 'bg-indigo-600 text-white shadow-indigo-200' : 'text-gray-400'}`}
                        >
                            Lo tengo 🏠
                        </button>
                    </div>

                    {/* Photo Section - Multi-photo support */}
                    <div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            {images.map((img, idx) => (
                                <div key={idx} className="aspect-square rounded-xl overflow-hidden relative shadow-md border border-gray-200">
                                    <img src={img} alt={`Preview ${idx + 1} `} className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            removeImage(idx);
                                            const newSafety = { ...safetyLabels };
                                            delete newSafety[idx];
                                            setSafetyLabels(newSafety);
                                        }}
                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg active:scale-90 z-20"
                                    >
                                        <span className="material-icons text-sm">close</span>
                                    </button>
                                </div>
                            ))}
                            {images.length < 3 && (
                                <div className="flex flex-col gap-3 h-full">
                                    <button
                                        type="button"
                                        onClick={handleCapture}
                                        className={`flex-1 rounded-2xl relative overflow-hidden group shadow-md transition-all active:scale-95 hover:shadow-lg ${status === 'lost' ? 'h-[48%]' : 'h-full aspect-square'}`}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-brand-400 to-brand-600 opacity-90 group-hover:opacity-100 transition"></div>
                                        <div className="relative z-10 flex flex-col items-center justify-center text-white h-full">
                                            <span className="material-icons text-3xl mb-1 drop-shadow-md">photo_camera</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest drop-shadow-sm">Cámara</span>
                                        </div>
                                    </button>

                                    {status === 'lost' && (
                                        <button
                                            type="button"
                                            onClick={handleGalleryUpload}
                                            className="flex-1 rounded-2xl relative overflow-hidden group shadow-md transition-all active:scale-95 hover:shadow-lg h-[48%]"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-600 opacity-90 group-hover:opacity-100 transition"></div>
                                            <div className="relative z-10 flex flex-col items-center justify-center text-white h-full">
                                                <span className="material-icons text-3xl mb-1 drop-shadow-md">photo_library</span>
                                                <span className="text-[10px] font-black uppercase tracking-widest drop-shadow-sm">Galería</span>
                                            </div>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] text-gray-400 text-center uppercase font-bold tracking-wider">
                            {images.length === 0 ? 'Sin fotos' : `${images.length} de 3 fotos añadidas`}
                        </p>
                    </div>

                    {/* Location Section */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-700">¿Dónde lo viste?</h3>
                        </div>

                        {!location ? (
                            <div className="space-y-4">
                                <button
                                    type="button"
                                    onClick={getLocation}
                                    disabled={loading}
                                    className="w-full py-3 px-4 border-2 border-brand text-brand font-bold rounded-xl hover:bg-brand-light/10 transition flex items-center justify-center gap-2"
                                >
                                    <span className="material-icons">{loading ? 'sync' : 'my_location'}</span>
                                    {loading ? 'Buscando GPS...' : 'Usar mi GPS'}
                                </button>

                                <div className="flex items-center gap-2">
                                    <div className="h-px bg-gray-100 flex-1"></div>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">o escribe la zona</span>
                                    <div className="h-px bg-gray-100 flex-1"></div>
                                </div>

                                <input
                                    type="text"
                                    placeholder="Ej: Parque Central, Calle 5..."
                                    value={manualLocation}
                                    onChange={(e) => setManualLocation(e.target.value)}
                                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand outline-none transition"
                                />
                            </div>
                        ) : (
                            <div className="flex items-center justify-between text-green-600 bg-green-50 p-4 rounded-xl border border-green-100">
                                <div className="flex items-center">
                                    <span className="material-icons mr-2">check_circle</span>
                                    <span className="text-sm font-bold">GPS Activado</span>
                                </div>
                                <button type="button" onClick={() => setLocation(null)} className="text-xs underline font-bold">Cambiar</button>
                            </div>
                        )}
                    </div>

                    {/* Breed Section */}
                    <div className="space-y-2">
                        <label className="block font-semibold text-gray-700">Raza / Apariencia</label>
                        <input
                            type="text"
                            required
                            className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand outline-none transition"
                            placeholder="Ej. Golden hijo, café con blanco..."
                            value={breed}
                            onChange={(e) => setBreed(e.target.value)}
                        />
                    </div>

                    {/* Sighted Specific Fields (Health, Collar, Behavior) */}
                    {status === 'sighted' && (
                        <div className="bg-amber-50/50 p-5 rounded-3xl border border-amber-100/50 space-y-4 animate-in slide-in-from-top-4 duration-500">
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-900/60">
                                <span className="material-icons text-sm">label</span>
                                Detalles rápidos del avistamiento
                            </label>

                            <div className="flex flex-wrap gap-2">
                                {/* Collar */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const tag = 'Tiene collar';
                                        const current = details.includes(tag) ? details.replace(tag + '. ', '') : tag + '. ' + details;
                                        setDetails(current);
                                    }}
                                    className={`px-4 py-2.5 rounded-2xl text-[11px] font-bold border transition-all flex items-center gap-2 ${details.includes('Tiene collar') ? 'bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-200 scale-105' : 'bg-white text-gray-500 border-gray-100 hover:border-amber-200'}`}
                                >
                                    <span className="material-icons text-sm">{details.includes('Tiene collar') ? 'check_circle' : 'toll'}</span>
                                    Con collar
                                </button>

                                {/* Herido */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const tag = 'Se ve herido/enfermo';
                                        const current = details.includes(tag) ? details.replace(tag + '. ', '') : tag + '. ' + details;
                                        setDetails(current);
                                    }}
                                    className={`px-4 py-2.5 rounded-2xl text-[11px] font-bold border transition-all flex items-center gap-2 ${details.includes('Se ve herido/enfermo') ? 'bg-red-500 text-white border-red-600 shadow-lg shadow-red-200 scale-105' : 'bg-white text-gray-500 border-gray-100 hover:border-red-200'}`}
                                >
                                    <span className="material-icons text-sm">error_outline</span>
                                    Herido/Enfermo
                                </button>

                                {/* Hambriento */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const tag = 'Se ve hambriento';
                                        const current = details.includes(tag) ? details.replace(tag + '. ', '') : tag + '. ' + details;
                                        setDetails(current);
                                    }}
                                    className={`px-4 py-2.5 rounded-2xl text-[11px] font-bold border transition-all flex items-center gap-2 ${details.includes('Se ve hambriento') ? 'bg-orange-500 text-white border-orange-600 shadow-lg shadow-orange-200 scale-105' : 'bg-white text-gray-500 border-gray-100 hover:border-orange-200'}`}
                                >
                                    <span className="material-icons text-sm">restaurant</span>
                                    Hambriento
                                </button>

                                {/* Amigable */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const tag = 'Es amigable';
                                        const current = details.includes(tag) ? details.replace(tag + '. ', '') : tag + '. ' + details;
                                        setDetails(current);
                                    }}
                                    className={`px-4 py-2.5 rounded-2xl text-[11px] font-bold border transition-all flex items-center gap-2 ${details.includes('Es amigable') ? 'bg-green-500 text-white border-green-600 shadow-lg shadow-green-200 scale-105' : 'bg-white text-gray-500 border-gray-100 hover:border-green-200'}`}
                                >
                                    <span className="material-icons text-sm">sentiment_very_satisfied</span>
                                    Amigable
                                </button>

                                {/* Asustadizo */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const tag = 'Es asustadizo/corre';
                                        const current = details.includes(tag) ? details.replace(tag + '. ', '') : tag + '. ' + details;
                                        setDetails(current);
                                    }}
                                    className={`px-4 py-2.5 rounded-2xl text-[11px] font-bold border transition-all flex items-center gap-2 ${details.includes('Es asustadizo/corre') ? 'bg-indigo-500 text-white border-indigo-600 shadow-lg shadow-indigo-200 scale-105' : 'bg-white text-gray-500 border-gray-100 hover:border-indigo-200'}`}
                                >
                                    <span className="material-icons text-sm">directions_run</span>
                                    Asustadizo
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Details Section */}
                    <div className="space-y-2">
                        <label className="block font-semibold text-gray-700">Más detalles</label>
                        <textarea
                            className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand outline-none transition resize-none"
                            rows="2"
                            placeholder={status === 'sighted' ? "Ej. Tenía collar rojo, corría hacia el norte..." : "Ej. Tenía collar, corría hacia el norte..."}
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                        ></textarea>
                    </div>

                    {/* Contact Info (Private) - UX Speed position */}
                    {(status === 'lost' || status === 'sheltered') && (
                        <div className="bg-indigo-50/50 p-5 rounded-3xl border border-indigo-100 animate-in slide-in-from-bottom-4 duration-500">
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-900 mb-3">
                                <span className="material-icons text-sm">vignette</span>
                                Datos de contacto (Privados)
                            </label>
                            <input
                                type="text"
                                required={status === 'lost' || status === 'sheltered'}
                                placeholder="WhatsApp, Instagram o Teléfono..."
                                className="w-full p-4 rounded-xl bg-white border border-indigo-100 focus:ring-4 focus:ring-indigo-500/10 outline-none transition text-sm font-medium"
                                value={contactInfo}
                                onChange={(e) => setContactInfo(e.target.value)}
                            />
                            <p className="text-[9px] text-indigo-400 mt-2 italic font-medium leading-tight text-center">
                                * Solo se revelará a quien quiera ayudar al perro.
                            </p>
                        </div>
                    )}

                    {uploadStep === 'Optimizando foto...' && (
                        <p className="text-center text-xs text-brand-600 font-bold mb-4 animate-pulse">
                            Reduciendo tamaño de la foto...
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={(images.length === 0 && !skipImage) || (!location && !manualLocation) || submitting || uploadStep.includes('IA')}
                        className={`w-full py-5 rounded-2xl font-black text-lg uppercase tracking-widest text-white shadow-2xl transition transform active:scale-95 ${((images.length === 0 && !skipImage) || (!location && !manualLocation) || submitting || uploadStep.includes('IA')) ? 'bg-gray-300 shadow-none' : 'bg-brand-600 hover:bg-brand-700 active:bg-brand-800'}`}
                    >
                        {submitting ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                {uploadStep}
                            </div>
                        ) : '¡Publicar Reporte!'}
                    </button>

                    {lastError && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-center">
                            <p className="text-[10px] font-mono text-red-600 italic">
                                Algo salió mal. Por favor intenta de nuevo. 🐾
                            </p>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
