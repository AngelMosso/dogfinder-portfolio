import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function CameraInterface({ onCapture, onClose }) {
    const [zoom, setZoom] = useState(1);
    const [isFlashOn, setIsFlashOn] = useState(false);
    const [isNative, setIsNative] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [platformError, setPlatformError] = useState(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    // Detección de plataforma segura con timeout y fallback
    useEffect(() => {
        let mounted = true;
        const checkPlatform = async () => {
            try {
                // Timeout para evitar colgarse si Capacitor no responde
                const timeout = new Promise((_, reject) => setTimeout(() => reject('timeout'), 2000));
                const importTask = import('@capacitor/core');

                const { Capacitor } = await Promise.race([importTask, timeout]).catch(() => ({ Capacitor: { isNativePlatform: () => false } }));

                if (mounted) {
                    setIsNative(Capacitor.isNativePlatform());
                }
            } catch (e) {
                console.warn("Plataforma no detectada, asumiendo Web", e);
                if (mounted) setIsNative(false);
            }
        };
        checkPlatform();
        return () => { mounted = false; };
    }, []);

    const stopWebCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    const startWebCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 }, // Bajamos un poco la ideal para máxima compatibilidad
                    height: { ideal: 720 }
                }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
            }
            setIsInitialized(true);
        } catch (e) {
            console.error("Web Camera Error:", e);
            setPlatformError("Error de permisos: Asegúrate de permitir el acceso a la cámara.");
        }
    }, []);

    useEffect(() => {
        let active = true;
        document.documentElement.classList.add('is-camera-active');

        const prepare = async () => {
            try {
                const { Capacitor } = await import('@capacitor/core');

                if (Capacitor.isNativePlatform()) {
                    const { CameraPreview } = await import('@capacitor-community/camera-preview');
                    await CameraPreview.start({
                        parent: 'cameraPreview',
                        position: 'rear',
                        toBack: true,
                        className: 'camera-preview-container',
                    });
                    if (active) setIsInitialized(true);
                } else {
                    startWebCamera();
                }
            } catch (e) {
                console.warn("Falla en inicio nativo, usando web fallback:", e);
                if (active) startWebCamera();
            }
        };

        prepare();

        return () => {
            active = false;
            document.documentElement.classList.remove('is-camera-active');
            const cleanup = async () => {
                try {
                    const { Capacitor } = await import('@capacitor/core');
                    if (Capacitor.isNativePlatform()) {
                        const { CameraPreview } = await import('@capacitor-community/camera-preview');
                        CameraPreview.stop().catch(() => { });
                    }
                } catch (e) { }
                stopWebCamera();
            };
            cleanup();
        };
    }, [isNative, startWebCamera, stopWebCamera]);

    const handleCapture = async () => {
        try {
            const { Capacitor } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform() && isInitialized) {
                const { CameraPreview } = await import('@capacitor-community/camera-preview');
                const result = await CameraPreview.capture({ quality: 85 });
                onCapture(`data:image/jpeg;base64,${result.value}`);
            } else if (videoRef.current) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0);
                onCapture(canvas.toDataURL('image/jpeg', 0.85));
            }
        } catch (e) {
            console.error("Capture error:", e);
        }
    };

    const applyZoom = async (level) => {
        setZoom(level);
        try {
            const { Capacitor } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
                const { CameraPreview } = await import('@capacitor-community/camera-preview');
                CameraPreview.setZoom({ value: level }).catch(() => { });
            }
        } catch (e) { }
    };

    const toggleFlash = async () => {
        try {
            const { Capacitor } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
                const { CameraPreview } = await import('@capacitor-community/camera-preview');
                const nextMode = isFlashOn ? 'off' : 'torch';
                await CameraPreview.setFlashMode({ flashMode: nextMode });
                setIsFlashOn(!isFlashOn);
            }
        } catch (e) {
            console.error("Flash error:", e);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-black pointer-events-none select-none overflow-hidden" style={{ height: '100dvh' }}>
            {/* CAPA 1: Viewport de Cámara (Base) */}
            <div className={`absolute inset-0 flex items-center justify-center ${isNative ? 'bg-transparent' : 'bg-black'}`}>
                {isNative ? (
                    <div id="cameraPreview" className="w-full h-full bg-transparent"></div>
                ) : (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transition-transform duration-500" style={{ transform: `scale(${zoom})` }} />
                )}
                <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* CAPA 2: HUD de Diagnóstico (Superior) */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start">
                <div className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                    <span className="text-[10px] text-white/60 font-mono tracking-tighter">
                        v1.2 | {isNative ? 'NATIVE' : 'WEB'} | ZOOM: {zoom}X
                    </span>
                </div>
                {platformError && (
                    <div className="bg-red-500/90 text-white text-[10px] p-2 rounded-lg max-w-[200px] animate-pulse">
                        {platformError}
                    </div>
                )}
            </div>

            {/* CAPA 3: Selector de Zoom (Flotante Derecha) */}
            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 pointer-events-auto">
                {[5, 2, 1].map((level) => (
                    <button
                        key={level}
                        onClick={() => applyZoom(level)}
                        className={`w-12 h-12 rounded-full border-2 font-black text-xs transition-all flex items-center justify-center shadow-2xl
                            ${zoom === level
                                ? 'bg-brand-500 border-white text-white scale-110'
                                : 'bg-black/40 border-white/20 text-white/50 hover:bg-black/60'}`}
                    >
                        {level}X
                    </button>
                ))}
            </div>

            {/* CAPA 4: Controles Principales (Inferior) */}
            <div className="absolute bottom-0 left-0 right-0 p-8 pb-12 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-auto">
                <div className="flex items-center justify-between max-w-sm mx-auto w-full">
                    <button onClick={onClose} className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center text-white border border-white/10 active:scale-90 transition backdrop-blur-md">
                        <span className="material-icons text-2xl">close</span>
                    </button>

                    <button onClick={handleCapture} className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition group relative">
                        <div className="absolute -inset-2 border border-brand-500/30 rounded-full animate-ping opacity-20"></div>
                        <div className="w-14 h-14 bg-brand-600 rounded-full shadow-lg"></div>
                    </button>

                    <button onClick={toggleFlash} className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all active:scale-90 backdrop-blur-md
                        ${isFlashOn
                            ? 'bg-brand-500 border-brand-600 text-white shadow-xl shadow-brand-500/30'
                            : 'bg-white/10 border-white/10 text-white/50'}`}>
                        <span className="material-icons text-2xl">{isFlashOn ? 'flashlight_on' : 'flashlight_off'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
