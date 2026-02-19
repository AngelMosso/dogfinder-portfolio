import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

// Configuración de tu proyecto
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
const db = getFirestore(app);

async function testConnection() {
    console.log("🟡 Iniciando prueba de conexión a Firestore...");
    try {
        const docRef = await addDoc(collection(db, "test_pings"), {
            message: "Hola desde Antigravity Terminal",
            timestamp: new Date(),
            agent: "Antigravity"
        });
        console.log("✅ ÉXITO: Documento escrito con ID: ", docRef.id);
        console.log("La base de datos responde correctamente.");
    } catch (e) {
        console.error("❌ ERROR CRÍTICO al escribir en DB:", e.message);
        if (e.message.includes("permission-denied")) {
            console.log("💡 PISTA: Revisa las Reglas de Seguridad en la consola de Firebase.");
        }
    }
    process.exit(0);
}

testConnection();
