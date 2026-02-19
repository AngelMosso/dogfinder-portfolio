import React, { createContext, useContext, useState, useEffect } from 'react';
import { calculateRelevanceScore } from '../utils/matchingEngine';
import { safeStorage } from '../utils/safeStorage';

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
    const [alertConfig, setAlertConfig] = useState(() => {
        const saved = safeStorage.getItem('dogfinder_alert_config');
        return saved ? JSON.parse(saved) : null;
    });

    const [notifications, setNotifications] = useState([]);
    const [hasNewAlert, setHasNewAlert] = useState(false);

    // Guardar configuración de alertas
    const saveAlertConfig = (config) => {
        setAlertConfig(config);
        safeStorage.setItem('dogfinder_alert_config', JSON.stringify(config));
        setHasNewAlert(false); // Reset al configurar nueva
    };

    const clearAlertConfig = () => {
        setAlertConfig(null);
        safeStorage.removeItem('dogfinder_alert_config');
        setHasNewAlert(false);
    };

    // Añadir una notificación visual (Toast)
    const addNotification = (notif) => {
        const id = Date.now();
        setNotifications(prev => [...prev, { ...notif, id }]);

        // Auto-remover después de 6 segundos
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 6000);
    };

    // Motor de escaneo de notificaciones
    const scanForMatches = (sightings) => {
        if (!alertConfig || sightings.length === 0) return;

        const latestSighting = sightings[0]; // Asumimos que el primero es el más reciente

        // Verificamos si ya notificamos sobre este ID para no spamear
        const notifiedIds = JSON.parse(safeStorage.getItem('dogfinder_notified_ids') || '[]');
        if (notifiedIds.includes(latestSighting.id)) return;

        const score = calculateRelevanceScore(
            { breed: alertConfig.breed, location: alertConfig.location, searchTerm: alertConfig.breed },
            latestSighting
        );

        if (score >= 0.7) {
            addNotification({
                type: 'match',
                title: '¡Coincidencia Detectada! 🐕✨',
                message: `Un ${latestSighting.breed || 'perrito'} similar ha sido reportado cerca.`,
                dogId: latestSighting.id,
                image: (latestSighting.images && latestSighting.images[0]) || latestSighting.image
            });
            setHasNewAlert(true);

            // Guardar ID notificado
            notifiedIds.push(latestSighting.id);
            safeStorage.setItem('dogfinder_notified_ids', JSON.stringify(notifiedIds.slice(-20)));
        }
    };

    return (
        <NotificationContext.Provider value={{
            alertConfig,
            saveAlertConfig,
            clearAlertConfig,
            notifications,
            addNotification,
            scanForMatches,
            hasNewAlert,
            setHasNewAlert
        }}>
            {children}

            {/* Contenedor de Toasts Premium */}
            <div className="fixed top-6 left-4 right-4 z-[100] pointer-events-none space-y-3">
                {notifications.map(n => (
                    <div
                        key={n.id}
                        className="pointer-events-auto bg-white/90 backdrop-blur-xl border border-white p-4 rounded-[24px] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.15)] flex items-center gap-4 animate-in slide-in-from-top-10 fade-in duration-500"
                    >
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-brand-100 shrink-0 border border-brand-50 shadow-inner">
                            <img src={n.image || "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=150&q=80"} className="w-full h-full object-cover" alt="Dog" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-black text-gray-900 text-sm leading-tight mb-0.5">{n.title}</h4>
                            <p className="text-[11px] text-gray-500 font-medium leading-tight">{n.message}</p>
                        </div>
                        <button
                            onClick={() => window.location.href = `/detail/${n.dogId}`}
                            className="w-10 h-10 bg-brand-600 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition"
                        >
                            <span className="material-icons text-xl">chevron_right</span>
                        </button>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
};
