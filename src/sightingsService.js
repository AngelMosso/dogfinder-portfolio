import { db, storage } from './firebase';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    doc,
    getDoc,
    getFirestore,
    deleteDoc,
    updateDoc,
    getCountFromServer
} from 'firebase/firestore';
import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';
import { auth } from './firebase'; // Importamos auth para obtener el token

const SIGHTINGS_COLLECTION = 'sightings';

// Helper para convertir base64 a Blob
const dataURLtoBlob = (dataurl) => {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};

export const sightingsService = {
    // Función para subir imagen (AHORA USANDO IMGBB - GRATIS Y SIN TARJETA)
    async uploadImage(base64Image, userId) {
        try {
            // Normalización de Base64 para ImgBB
            const base64Clean = base64Image.replace(/^data:image\/[a-z]+;base64,/, "");

            const formData = new FormData();
            formData.append("image", base64Clean);

            // API Key de ImgBB desde variables de entorno
            const API_KEY = import.meta.env.VITE_IMGBB_API_KEY;

            if (!API_KEY) {
                console.error("DEBUG: VITE_IMGBB_API_KEY no encontrada en variables de entorno.");
                throw new Error("Configuración incompleta: Falta API Key de imágenes.");
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos máximo

            const response = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, {
                method: "POST",
                body: formData,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const data = await response.json();

            if (data.success) {
                console.log("Subida a ImgBB exitosa:", data.data.url);
                return data.data.url; // Retornamos la URL pública
            } else {
                throw new Error("ImgBB Error: " + (data.error ? data.error.message : "Desconocido"));
            }
        } catch (error) {
            console.error("Error subida imagen:", error);
            throw new Error(`Fallo subida imagen: ${error.message}`);
        }
    },

    // Craer un nuevo reporte (versión cruda para depuración)
    async createSightingRaw(sightingData) {
        try {
            console.log("sightingsService: Iniciando addDoc...", sightingData);
            // Aseguramos que los datos sean planos y sencillos
            const cleanData = {
                ...sightingData,
                timestamp: new Date().toISOString(),
                status: sightingData.status || 'active',
                createdAt: Date.now()
            };

            const docRef = await addDoc(collection(db, SIGHTINGS_COLLECTION), cleanData);
            return docRef.id;
        } catch (error) {
            console.error("Error creating sighting:", error);
            // Capturamos el código de error específico de Firebase
            const errorMsg = error.code ? `[${error.code}] ${error.message}` : error.message;
            throw new Error(errorMsg);
        }
    },


    // Versión REST (ÚLTIMO RECURSO): Escribe directo a Google sin usar el SDK
    async createSightingREST(sightingData) {
        try {
            console.log("sightingsService: Intentando vía REST API...");
            const user = auth.currentUser;
            if (!user) throw new Error("No hay usuario autenticado para REST");

            const token = await user.getIdToken();
            const projectId = "dogfinder-7cf2c";
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${SIGHTINGS_COLLECTION}`;

            // Convertimos el objeto plano a formato Firestore REST (campos tipados)
            const fields = {};
            Object.keys(sightingData).forEach(key => {
                let val = sightingData[key];

                // CRITICAL FIX: Si es el campo de etiquetas IA o un objeto complejo, 
                // lo convertimos a string para que no se guarde como "[object Object]"
                if (key === 'aiTags' && val !== null) {
                    val = JSON.stringify(val);
                }

                if (val === null || val === undefined) {
                    fields[key] = { nullValue: null };
                } else if (Array.isArray(val)) {
                    // Soporte para arrays (como las 3 imágenes)
                    fields[key] = {
                        arrayValue: {
                            values: val.map(item => ({ stringValue: String(item) }))
                        }
                    };
                } else if (typeof val === 'number') {
                    fields[key] = { doubleValue: val };
                } else if (typeof val === 'boolean') {
                    fields[key] = { booleanValue: val };
                } else {
                    const logVal = (String(val).length > 100) ? String(val).substring(0, 30) + '...' : val;
                    console.log(`REST field [${key}]:`, logVal);
                    fields[key] = { stringValue: String(val) };
                }
            });


            // Timestamp en formato ISO
            fields['createdAt'] = { stringValue: new Date().toISOString() };
            fields['status'] = { stringValue: sightingData.status || 'active' };
            fields['isActive'] = { booleanValue: true }; // Campo secundario para filtros si es necesario

            console.log(`REST: Enviando a ${projectId}...`);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fields })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("REST Error response:", errorData);
                throw new Error(`REST Error: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            return data.name.split('/').pop();
        } catch (error) {
            console.error("REST API Failure:", error);
            throw error;
        }
    },

    // Mantener compatibilidad anterior
    async createSighting(sightingData, userId) {
        try {
            let finalImage = sightingData.image;
            if (sightingData.image && sightingData.image.startsWith('data:')) {
                finalImage = await this.uploadImage(sightingData.image, userId);
            }
            return await this.createSightingRaw({ ...sightingData, image: finalImage, userId });
        } catch (error) {
            throw error;
        }
    },

    // Obtener todos los reportes activos
    async getAllSightings() {
        try {
            const q = query(
                collection(db, SIGHTINGS_COLLECTION)
            );
            const querySnapshot = await getDocs(q);
            const results = querySnapshot.docs.map(doc => {
                const data = doc.data();
                // Si aiTags vino como string (por el fix de REST), lo parseamos de vuelta
                if (typeof data.aiTags === 'string') {
                    try {
                        data.aiTags = JSON.parse(data.aiTags);
                    } catch (e) {
                        console.warn("Error parseando aiTags guardados como string", e);
                    }
                }
                return { id: doc.id, ...data };
            });

            // Ordenamos en memoria y filtramos encontrados
            const now = Date.now();
            const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

            return results
                .filter(item => {
                    // 1. No mostrar si ya fue marcado como 'found' (Caso cerrado)
                    if (item.status === 'found') return false;

                    // 2. Si es un avistamiento ('sighted'), verificar la expiración de 24h
                    if (item.status === 'sighted') {
                        const createdAtTime = item.createdAt?.seconds
                            ? item.createdAt.seconds * 1000
                            : new Date(item.createdAt).getTime();

                        // Si han pasado más de 24 horas, no lo mostramos
                        if (now - createdAtTime > TWENTY_FOUR_HOURS) {
                            return false;
                        }
                    }

                    return true;
                })
                .sort((a, b) => {
                    const dateA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime();
                    const dateB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime();
                    return dateB - dateA;
                });
        } catch (error) {
            console.error("Error al obtener reportes:", error);
            return [];
        }
    },



    // Obtener un reporte específico por ID
    async getSightingById(id) {
        try {
            const docRef = doc(db, SIGHTINGS_COLLECTION, id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }
            return null;
        } catch (error) {
            console.error("Error al obtener reporte único:", error);
            throw error;
        }
    },

    // Obtener reportes de un usuario específico
    async getSightingsByUser(userId) {
        try {
            const q = query(
                collection(db, SIGHTINGS_COLLECTION),
                where("userId", "==", userId)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).sort((a, b) => {
                const dateA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime();
                const dateB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime();
                return dateB - dateA;
            });
        } catch (error) {
            console.error("Error al obtener reportes del usuario:", error);
            return [];
        }
    },

    // Borrar un reporte (usando el SDK)
    async deleteSighting(id) {
        try {
            const docRef = doc(db, SIGHTINGS_COLLECTION, id);
            // Podríamos hacer un borrado lógico, pero el usuario pidió borrar.
            // Para máxima seguridad, verificamos que el usuario sea el dueño en las reglas de Firestore.
            await deleteDoc(docRef);
            return true;
        } catch (error) {
            console.error("Error al borrar reporte:", error);
            throw error;
        }
    },

    // Prueba de conexión simple
    async pingFirestore(userId) {
        try {
            const docRef = await addDoc(collection(db, 'pings'), {
                userId,
                time: String(new Date()),
                test: true
            });
            return docRef.id;
        } catch (error) {
            console.error("Fallo de Ping:", error);
            throw error;
        }
    },

    // Marcar como encontrado (Faltaba esta función)
    async markAsFound(id) {
        try {
            const docRef = doc(db, SIGHTINGS_COLLECTION, id);
            await updateDoc(docRef, {
                status: 'found',
                foundAt: serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error("Error marcando como encontrado:", error);
            throw error;
        }
    },

    // Guardar feedback del usuario
    async addFeedback(feedbackData) {
        try {
            await addDoc(collection(db, 'app_feedback'), {
                ...feedbackData,
                createdAt: serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error("Error guardando feedback:", error);
            throw error;
        }
    },

    // Obtener estadísticas globales para los contadores de la Home
    async getGlobalStats() {
        try {
            const coll = collection(db, SIGHTINGS_COLLECTION);

            // 1. Contar "Buscando" (active + sheltered)
            const qBuscando = query(coll, where("status", "!=", "found"));
            const snapshotBuscando = await getCountFromServer(qBuscando);

            // 2. Contar "Encontrados" (found)
            const qEncontrados = query(coll, where("status", "==", "found"));
            const snapshotEncontrados = await getCountFromServer(qEncontrados);

            return {
                buscando: snapshotBuscando.data().count || 0,
                encontrados: snapshotEncontrados.data().count || 0
            };
        } catch (error) {
            console.error("Error al obtener estadísticas globales:", error);
            // Fallback para no romper la UI
            return { buscando: 0, encontrados: 0 };
        }
    }
};
