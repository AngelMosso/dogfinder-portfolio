import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, initializeFirestore, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyCVdgan49NcWAUzYMvcQaiHyxCCgLuRFko",
    authDomain: "dogfinder-7cf2c.firebaseapp.com",
    projectId: "dogfinder-7cf2c",
    storageBucket: "dogfinder-7cf2c.firebasestorage.app",
    messagingSenderId: "767592902068",
    appId: "1:767592902068:web:39c33785cd4fc5d8e696e1",
    measurementId: "G-8MM4PRHP42"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Forzar persistencia local
setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.error("Error fijando persistencia:", err);
});

// Configuración de máxima compatibilidad para túneles (ngrok)
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false // Ayuda con la estabilidad en Safari
});


export const storage = getStorage(app);
export default app;
