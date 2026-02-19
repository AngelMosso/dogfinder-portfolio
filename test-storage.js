import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadString } from "firebase/storage";

// Probamos con el dominio CLÁSICO de App Engine
const firebaseConfig = {
    apiKey: "AIzaSyCVdgan49NcWAUzYMvcQaiHyxCCgLuRFko",
    authDomain: "dogfinder-7cf2c.firebaseapp.com",
    projectId: "dogfinder-7cf2c",
    storageBucket: "dogfinder-7cf2c.appspot.com", // <--- CAMBIO AQUÍ
    messagingSenderId: "767592902068",
    appId: "1:767592902068:web:39c33785cd4fc5d8e696e1",
    measurementId: "G-8MM4PRHP42"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

async function testStorage() {
    console.log(`📦 (Reintento) Probando subida a bucket: ${firebaseConfig.storageBucket}...`);
    try {
        const testRef = ref(storage, "test_ping_v2.txt");
        await uploadString(testRef, "Ping de prueba desde Antigravity (AppSpot)");
        console.log("✅ ÉXITO: Archivo subido a Storage correctamente con .appspot.com");
    } catch (e) {
        console.error("❌ ERROR CRÍTICO en Storage:", e.message);
    }
    process.exit(0);
}

testStorage();
