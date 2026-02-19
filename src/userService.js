import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, increment, arrayUnion, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';

export const userService = {
    // Definición de insignias
    BADGES: {
        SCOUT: {
            id: 'scout',
            icon: 'visibility',
            name: 'Vigía',
            description: 'Tu primer reporte para la comunidad.',
            color: 'text-blue-500',
            bg: 'bg-blue-100'
        },
        GUARDIAN: {
            id: 'guardian',
            icon: 'shield',
            name: 'Guardián',
            description: 'Has publicado 3 reportes. ¡Gracias por cuidar!',
            color: 'text-purple-600',
            bg: 'bg-purple-100'
        },
        HERO: {
            id: 'hero',
            icon: 'stars',
            name: 'Héroe',
            description: '¡Reuniste a una familia! Gracias por tu ayuda.',
            color: 'text-yellow-500',
            bg: 'bg-yellow-100'
        },
        ANGEL: {
            id: 'angel',
            icon: 'volunteer_activism',
            name: 'Ángel',
            description: 'Cuidaste de un perrito en resguardo hasta encontrar a su dueño.',
            color: 'text-pink-500',
            bg: 'bg-pink-100'
        }
    },

    // Obtener perfil extendido (stats + badges)
    async getUserProfile(userId) {
        try {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const data = userSnap.data();
                return {
                    ...data,
                    stats: data.stats || { reports: 0, found: 0 },
                    badges: data.badges || []
                };
            } else {
                return {
                    stats: { reports: 0, found: 0 },
                    badges: []
                };
            }
        } catch (error) {
            console.error("Error obteniendo perfil extendido:", error);
            return null;
        }
    },

    // Registrar acción y checar logros automáticos
    async recordAction(userId, actionType) { // actionType: 'create_report' | 'mark_found'
        try {
            console.log(`recordAction: userId=${userId}, type=${actionType}`);
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);

            let userData = userSnap.exists() ? userSnap.data() : {
                stats: { reports: 0, found: 0 },
                badges: []
            };

            // Asegurar estructura
            if (!userData.stats) userData.stats = { reports: 0, found: 0 };
            if (!userData.badges) userData.badges = [];

            // 1. Actualizar contadores localmente para chequeo de insignias
            if (actionType === 'create_report') {
                userData.stats.reports = (userData.stats.reports || 0) + 1;
            } else if (actionType === 'mark_found') {
                userData.stats.found = (userData.stats.found || 0) + 1;
            }

            // 2. Verificar insignias nuevas
            const newBadges = [];
            if (userData.stats.reports >= 1 && !userData.badges.includes('scout')) newBadges.push('scout');
            if (userData.stats.reports >= 3 && !userData.badges.includes('guardian')) newBadges.push('guardian');
            if (actionType === 'mark_found' && userData.stats.found >= 1 && !userData.badges.includes('hero')) newBadges.push('hero');

            // 3. Persistir cambios usando un objeto plano para evitar problemas de anidamiento
            const finalData = {
                ...userData,
                badges: [...userData.badges, ...newBadges]
            };

            console.log("Saving userData to Firestore:", finalData);
            await setDoc(userRef, finalData, { merge: true });
            return newBadges;

        } catch (error) {
            console.error("CRITICAL ERROR in recordAction:", error);
            throw error; // No silenciar
        }
    },

    // Otorgar insignia directa (por id de usuario)
    async awardBadge(userId, badgeId) {
        try {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);

            let userData = userSnap.exists() ? userSnap.data() : {};

            if (!userData.stats) userData.stats = { reports: 0, found: 0 };
            if (!userData.badges) userData.badges = [];

            if (userData.badges.includes(badgeId)) return false;

            if (badgeId === 'hero' || badgeId === 'angel') {
                userData.stats.found = (userData.stats.found || 0) + 1;
            }

            userData.badges.push(badgeId);
            await setDoc(userRef, userData, { merge: true });
            return true;
        } catch (error) {
            console.error("Error otorgando insignia manual:", error);
            throw error;
        }
    },

    // Otorgar insignia por Email (para "Credit Helper")
    async awardBadgeByEmail(email, badgeId) {
        try {
            // 1. Buscar UID por email en usuarios (Asumiendo que 'users' collection tiene el email guardado o usamos Auth... 
            // FIREBASE AUTH no permite buscar por email desde cliente sin cloud functions admin SDK.
            // Solución: Necesitamos que cuando el usuario se loguee/registre, guardemos su email en el doc 'users/{uid}'.
            // Vamos a asumir que 'users/{uid}' tiene el campo 'email'. Si no, esto fallará para usuarios antiguos.
            // *Corrección*: Profile.jsx ya muestra user.email, pero userService.getUserProfile solo lee stats/badges.
            // Necesitamos asegurar que el email esté en el documento 'users'.

            const normalizedEmail = email.toLowerCase().trim();
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("email", "==", normalizedEmail));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                console.warn("Usuario no encontrado por email para dar badge:", email);
                return { success: false, error: 'User not found' };
            }

            // Debería ser solo uno
            const userDoc = querySnapshot.docs[0];
            const userId = userDoc.id;

            const awarded = await this.awardBadge(userId, badgeId);
            return { success: true, awarded };

        } catch (error) {
            console.error("Error buscando usuario por email:", error);
            return { success: false, error: error.message };
        }
    },

    // Método auxiliar para asegurar que el email esté en el perfil extendido
    async ensureUserEmail(user) {
        try {
            if (!user || !user.email) return;
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, { email: user.email.toLowerCase().trim() }, { merge: true });
        } catch (err) {
            console.error("Error en ensureUserEmail:", err);
            // No bloqueamos el flujo principal por esto, pero lo logueamos
        }
    },

    async deleteUserData(userId) {
        try {
            const userRef = doc(db, 'users', userId);
            await deleteDoc(userRef);
            console.log(`Datos de usuario ${userId} eliminados de Firestore.`);
        } catch (error) {
            console.error("Error eliminando datos de usuario:", error);
            throw error;
        }
    }
};
