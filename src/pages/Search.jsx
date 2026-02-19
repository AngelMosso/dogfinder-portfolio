import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
// import * as tf from '@tensorflow/tfjs';
// import * as mobilenet from '@tensorflow-models/mobilenet';
import { sightingsService } from '../sightingsService';
import { calculateRelevanceScore } from '../utils/matchingEngine';
import { aiModel } from '../utils/aiModel';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import CameraInterface from '../components/CameraInterface';

export default function Search() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { scanForMatches } = useNotifications();
    const [searchTerm, setSearchTerm] = useState('');
    const [userLocation, setUserLocation] = useState(null); // Ubicación del buscador
    const [sightings, setSightings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isScanning, setIsScanning] = useState(false);
    const [scanResults, setScanResults] = useState(null);
    const [visualTags, setVisualTags] = useState([]); // Etiquetas detectadas por IA
    const [showCamera, setShowCamera] = useState(false);

    useEffect(() => {
        // Auto-cierre del escáner cuando detecta éxito
        if (scanResults && scanResults.includes('¡Encontrado!')) {
            const timer = setTimeout(() => {
                setScanResults(null);
                setIsScanning(false);
            }, 2500); // 2.5s para leer
            return () => clearTimeout(timer);
        }
    }, [scanResults]);

    useEffect(() => {
        const loadSightings = async () => {
            try {
                const data = await sightingsService.getAllSightings();
                setSightings(data);
                // Activar escaneo de alertas guardadas
                scanForMatches(data);
            } catch (error) {
                console.error("Error loading sightings:", error);
            } finally {
                setLoading(false);
            }
        };
        loadSightings();

        // Intentamos obtener la ubicación del usuario para mejorar la búsqueda
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                () => console.log("Ubicación rechazada, buscando sin GPS.")
            );
        }
    }, []);

    const compressForIA = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 800; // Suficiente detalle para MobileNet pero ahorra RAM
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
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
            };
        });
    };

    const handleScan = () => {
        setIsScanning(true);
        setVisualTags([]);
        setScanResults("Iniciando cámara...");
        setShowCamera(true);
    };

    const onPhotoCaptured = async (base64Data) => {
        setShowCamera(false);
        setIsScanning(true);
        setScanResults("Conectando con red neuronal...");

        try {
            // Fase 1: Carga de modelos
            const net = await aiModel.loadModel();
            setScanResults("Analizando rasgos biométricos...");

            // Fase 2: Clasificación
            const predictions = await aiModel.classifyImage(base64Data);

            if (!predictions || predictions.length === 0) {
                setScanResults("Rasgos no concluyentes. Prueba con otra luz.");
                setTimeout(() => setIsScanning(false), 3000);
                return;
            }

            setVisualTags(predictions);
            const mainTag = predictions[0].className.split(',')[0];
            const confidence = Math.round(predictions[0].probability * 100);

            setScanResults(`¡Encontrado! ${mainTag} (${confidence}%)`);

            // El useEffect se encargará de cerrar el overlay
        } catch (error) {
            console.error("Error en escaneo IA:", error);
            setScanResults(`Error de hardware: ${error.message}`);
            setTimeout(() => setIsScanning(false), 4000);
        }
    };

    // Motor de búsqueda inteligente
    const getSortedDogs = () => {
        const hasVisual = visualTags && visualTags.length > 0;
        const searchData = {
            searchTerm: searchTerm,
            breed: searchTerm, // Usamos el término de búsqueda para ambos por ahora
            location: userLocation,
            visualTags: visualTags // Etiquetas de la IA
        };

        const scoredDogs = sightings.map(dog => ({
            ...dog,
            relevance: calculateRelevanceScore(searchData, dog)
        }));

        // Si no hay NADA de búsqueda (ni texto, ni ubicación, ni foto), ordenamos por fecha
        if (!searchTerm && !userLocation && !hasVisual) {
            return scoredDogs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        }

        // DEPURACIÓN: Ver tabla de scores en la consola para diagnosticar por qué no aparecen
        if (hasVisual) {
            console.log("IA: Diagnóstico de Relevancia (Top 5):");
            console.table(scoredDogs
                .sort((a, b) => b.relevance - a.relevance)
                .slice(0, 5)
                .map(d => ({ raza: d.breed, score: d.relevance.toFixed(4), id: d.id }))
            );
        }

        // Ordenamos por relevancia y mostramos resultados que tengan coincidencia mínima
        return scoredDogs
            .filter(dog => !searchTerm && !hasVisual ? true : dog.relevance > 0.1) // Subimos umbral a 0.1 para evitar ruido
            .sort((a, b) => b.relevance - a.relevance);
    };

    const filteredDogs = getSortedDogs();

    return (
        <div className={`pb-24 min-h-screen text-gray-800 transition-colors duration-500 ${showCamera ? 'bg-transparent' : 'bg-gray-50'}`}>
            {showCamera && (
                <CameraInterface
                    onCapture={onPhotoCaptured}
                    onClose={() => { setShowCamera(false); setIsScanning(false); }}
                />
            )}
            {/* IA Scanner Overlay */}
            {isScanning && (
                <div className={`fixed inset-0 z-50 bg-brand-900/98 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-white overflow-hidden animate-in fade-in zoom-in duration-500 ${showCamera ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <button
                        onClick={() => { setIsScanning(false); setScanResults(null); }}
                        className="absolute top-8 right-8 bg-white/10 p-3 rounded-full hover:bg-white/20 transition active:scale-90"
                    >
                        <span className="material-icons">close</span>
                    </button>

                    <div className="relative w-72 h-72 mb-10">
                        {/* Scanning HUD Bits - Premium */}
                        <div className="absolute -inset-4 border border-brand-500/20 rounded-[48px] animate-[pulse_3s_infinite]"></div>
                        <div className="absolute -inset-8 border border-brand-500/10 rounded-[60px] animate-[pulse_4s_infinite]"></div>

                        <div className="relative w-full h-full border-2 border-brand-400/50 rounded-[40px] overflow-hidden shadow-[0_0_80px_rgba(255,193,7,0.2)] bg-brand-800 flex items-center justify-center">
                            {/* Animated Scan Line */}
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand-400 to-transparent h-12 w-full animate-scan-line opacity-50"></div>

                            <span className="material-icons text-8xl animate-pulse text-brand-300 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">pets</span>

                            {/* Corners */}
                            <div className="absolute top-6 left-6 border-t-4 border-l-4 border-brand-300 w-10 h-10 rounded-tl-lg"></div>
                            <div className="absolute top-6 right-6 border-t-4 border-r-4 border-brand-300 w-10 h-10 rounded-tr-lg"></div>
                            <div className="absolute bottom-6 left-6 border-b-4 border-l-4 border-brand-300 w-10 h-10 rounded-bl-lg"></div>
                            <div className="absolute bottom-6 right-6 border-b-4 border-r-4 border-brand-300 w-10 h-10 rounded-br-lg"></div>
                        </div>
                    </div>

                    <div className="text-center space-y-4 max-w-xs">
                        <h2 className="text-2xl font-black uppercase tracking-[0.3em] text-brand-50 drop-shadow-lg">
                            {scanResults?.includes('Exitoso') ? 'Match Encontrado' : 'Analizando rasgos'}
                        </h2>
                        <div className="h-1 bg-white/10 w-48 mx-auto rounded-full overflow-hidden">
                            <div className={`h-full bg-brand-400 transition-all duration-1000 ${scanResults?.includes('Exitoso') ? 'w-full' : 'w-2/3 animate-pulse'}`}></div>
                        </div>
                        <p className="text-brand-200 font-mono text-[10px] uppercase tracking-widest leading-relaxed">
                            {scanResults || 'Comparando base de datos mundial...'}
                        </p>
                    </div>

                    {!scanResults?.includes('Exitoso') && (
                        <div className="mt-12 flex gap-4">
                            <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:0s]"></div>
                            <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                            <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                        </div>
                    )}
                </div>
            )}

            {/* Search Header */}
            <div className="bg-white px-4 pt-6 pb-4 sticky top-0 z-10 shadow-sm border-b border-gray-100">
                <h1 className="text-2xl font-black text-gray-900 mb-4">Explorar Reportes</h1>

                <div className="relative">
                    <span className="absolute left-4 top-3.5 material-icons text-brand-500">search</span>
                    <input
                        type="text"
                        placeholder="Busca por raza, color o zona..."
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-4 focus:ring-brand-500/10 focus:bg-white outline-none transition-all text-gray-700 font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Visual Search Hook */}
            <div className="px-4 py-6">
                {scanResults ? (
                    <div className="flex flex-col gap-3">
                        <div className="bg-brand-600 rounded-3xl p-5 text-white shadow-xl animate-in zoom-in duration-300 flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                                <span className="material-icons">auto_awesome</span>
                            </div>
                            <p className="text-xs font-black uppercase tracking-wide leading-tight">{scanResults}</p>
                        </div>

                        {/* Panel de Depuración de IA (Visible para diagnóstico del usuario) */}
                        {visualTags.length > 0 && (
                            <div className="bg-white border border-brand-100 rounded-2xl p-4 animate-in slide-in-from-top-2">
                                <p className="text-[10px] font-black text-brand-500 uppercase tracking-widest mb-2 flex items-center">
                                    <span className="material-icons text-xs mr-1">visibility</span>
                                    La IA está viendo:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {visualTags.map((tag, idx) => (
                                        <span key={idx} className="bg-brand-50 text-brand-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-brand-100">
                                            {tag.className.split(',')[0]} ({Math.round(tag.probability * 100)}%)
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-gray-900 rounded-[32px] p-6 text-white shadow-xl relative overflow-hidden group">
                        {!user && (
                            <div className="absolute inset-0 z-20 bg-gray-900/60 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center animate-in fade-in duration-500">
                                <span className="material-icons text-brand-400 text-3xl mb-2 drop-shadow-[0_0_10px_rgba(255,193,7,0.5)]">lock</span>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white mb-4">Inicia sesión para usar la IA</p>
                                <button
                                    onClick={() => navigate('/login')}
                                    className="px-6 py-2 bg-white text-gray-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all hover:bg-brand-50"
                                >
                                    Entrar Ahora
                                </button>
                            </div>
                        )}
                        <div className={`relative z-10 ${!user ? 'opacity-20 blur-[1px]' : ''}`}>
                            <h2 className="text-lg font-black mb-1 leading-tight">¿Tienes una foto?</h2>
                            <p className="text-gray-400 text-xs mb-5 font-medium">Usa nuestra IA local para identificar rasgos visuales rápidamente.</p>
                            <button
                                onClick={handleScan}
                                className="bg-brand-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-500/20 active:scale-95 transition-all inline-block cursor-pointer hover:bg-brand-700"
                            >
                                Iniciar Escáner IA
                            </button>
                        </div>
                        <span className="material-icons text-[140px] absolute -right-6 -bottom-10 opacity-10 group-hover:scale-110 transition duration-700">visibility</span>
                    </div>
                )}
            </div>

            {/* Results List */}
            <div className="px-4">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest ml-1 mb-4 flex items-center justify-between">
                    <span className="flex items-center">
                        <span className="material-icons text-brand-500 mr-2 text-sm">explore</span>
                        {visualTags.length > 0 ? 'Resultados Visuales (Más parecidos)' : 'Reportes en la zona'}
                    </span>
                    {visualTags.length > 0 && (
                        <button
                            onClick={() => { setVisualTags([]); setSearchTerm(''); }}
                            className="text-[10px] text-red-400 hover:text-red-500 font-bold underline"
                        >
                            Borrar Filtros
                        </button>
                    )}
                </h3>

                {loading ? (
                    <div className="flex flex-col items-center py-12">
                        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest italic animate-pulse">Sincronizando...</p>
                    </div>
                ) : (
                    <div className="space-y-4 pb-12">
                        {filteredDogs.map(dog => (
                            <div key={dog.id} className="bg-white p-3 rounded-[28px] shadow-soft border border-gray-100 flex gap-4 hover:shadow-md transition group active:scale-[0.98]">
                                <div className={`relative shrink-0 w-24 h-24`}>
                                    <img
                                        src={(dog.images && dog.images.length > 0) ? dog.images[0] : (dog.image || "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=150&q=80")}
                                        alt={dog.breed}
                                        width="96"
                                        height="96"
                                        loading="lazy"
                                        className="w-full h-full rounded-2xl object-cover bg-gray-100 border border-gray-50"
                                    />
                                    <div className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${dog.status === 'found' ? 'bg-green-500' :
                                        dog.status === 'sheltered' ? 'bg-indigo-600' :
                                            dog.status === 'sighted' ? 'bg-amber-500' :
                                                'bg-red-500'
                                        }`}>
                                        <span className="material-icons text-[10px] text-white">
                                            {dog.status === 'found' ? 'check_circle' :
                                                dog.status === 'sheltered' ? 'home' :
                                                    dog.status === 'sighted' ? 'visibility' :
                                                        'priority_high'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex-1 py-1 min-w-0"> {/* min-w-0 permite que truncate funcione en flex children */}
                                    <div className="flex justify-between items-start gap-2">
                                        <h4 className="font-black text-gray-900 leading-tight mb-1 capitalize truncate">{dog.breed || 'Raza desconocida'}</h4>
                                        <span className="text-[9px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 uppercase tracking-tighter shrink-0 ring-4 ring-white whitespace-nowrap">
                                            {(() => {
                                                if (dog.createdAt?.seconds) return new Date(dog.createdAt.seconds * 1000).toLocaleDateString();
                                                if (typeof dog.createdAt === 'string') return new Date(dog.createdAt).toLocaleDateString();
                                                if (typeof dog.createdAt === 'number') return new Date(dog.createdAt).toLocaleDateString();
                                                return 'Reciente';
                                            })()}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed italic pr-4">
                                        "{dog.details || 'Sin detalles'}"
                                    </p>

                                    <div className="mt-3 flex items-center justify-between">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center text-[10px] text-brand-600 font-black uppercase tracking-wider">
                                                <span className="material-icons text-brand-500 mr-1 text-xs">place</span>
                                                {dog.manualLocation || 'Cerca de ti'}
                                            </div>
                                            {dog.relevance > 0 && (
                                                <div className={`flex items-center text-[9px] font-black uppercase tracking-widest ${dog.relevance > 0.6 ? 'text-green-600' : 'text-gray-400'}`}>
                                                    <span className="material-icons text-[10px] mr-1">{dog.relevance > 0.6 ? 'verified' : 'info'}</span>
                                                    {Math.round(dog.relevance * 100)}% Coincidencia
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => navigate(`/detail/${dog.id}`)}
                                            className="text-[10px] font-black uppercase tracking-widest text-brand-600 bg-brand-50 px-3 py-1.5 rounded-xl hover:bg-brand-100 transition shadow-sm ring-1 ring-brand-100/50"
                                        >
                                            Ver más
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {filteredDogs.length === 0 && (
                            <div className="text-center py-12 text-gray-400">
                                <span className="material-icons text-4xl mb-2">search_off</span>
                                <p>No hay avistamientos registrados aún.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
