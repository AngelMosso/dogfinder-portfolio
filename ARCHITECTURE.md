# Reporte Técnico: Arquitectura y Stack Tecnológico - DogFinder

**Fecha:** 19 de Febrero de 2026
**Proyecto:** DogFinder PWA (Progressive Web Application)
**Versión:** 1.3 (Production Ready)

---

## 1. Stack Tecnológico (Core Technologies)

Este proyecto está construido sobre una arquitectura **Serverless** moderna, priorizando el rendimiento en el lado del cliente (Client-Side Processing) para minimizar latencias y costos operativos.

### Frontend & Core
*   **Lenguaje:** JavaScript (ES6+), React 19.2.0
*   **Build System:** Vite 6.0.0 (Optimized for production builds)
*   **Estilos:** TailwindCSS 3.4.3 (Utility-first framework)
*   **PWA Framework:** Integración nativa mediante Service Workers para soporte offline y "Add to Home Screen".
*   **Mobile Wrapper:** Capacitor 8.1.0 (Bridge para acceso a hardware nativo: Cámara, Geolocalización).

### Backend & Cloud Services (BaaS)
*   **Plataforma:** Firebase (Google Cloud Platform).
*   **Base de Datos:** Firestore (NoSQL Document Store).
*   **Autenticación:** Firebase Auth (Google OAuth Provider + Email/Password).
*   **Hosting:** Firebase Hosting (CDN Global).
*   **Almacenamiento de Imágenes:** API Externa ImgBB (High-availability image hosting) integrada via REST.

### Inteligencia Artificial (Client-Side AI)
*   **Motor:** TensorFlow.js 4.22.0 (Ejecución de inferencia en navegador WebGL/WASM).
*   **Modelo de Visión:** MobileNet 2.1.1 (Reentrenado/Fine-tuned para clasificación de razas).
*   **Seguridad / Moderación:** NSFWJS (Modelo de detección de contenido explícito), cargado dinámicamente vía CDN para optimización de bundle inicial.

---

## 2. Arquitectura de Datos

La persistencia de datos sigue un esquema **NoSQL** flexible optimizado para lecturas rápidas en tiempo real.

### Estructura de Firestore
*   **Colección `sightings`:** Documentos JSON planos que representan cada reporte.
    *   `aiTags` (Array<Object>): Metadatos generados por la IA (ej: `[{className: "Golden Retriever", probability: 0.98}]`).
    *   `location` (String/JSON): Coordenadas geoespaciales serializadas.
    *   `images` (Array<String>): URLs públicas de las imágenes alojadas.
    *   `status` (Enum): 'lost' | 'sighted' | 'found' | 'sheltered'.
*   **Reglas de Seguridad:** Modelo de "Least Privilege". Escritura permitida solo a usuarios autenticados (`request.auth != null`). Lectura pública con filtros de expiración (TTL) lógicos aplicados en cliente.

### Gestión de Imágenes (Hybrid Approach)
*   **Compresión:** Algoritmo de compresión agresiva (JPEG quality 0.5) en el cliente antes de la subida para optimizar ancho de banda móvil.
*   **Almacenamiento:** Se utiliza el servicio ImgBB mediante llamadas API directas para desacoplar el almacenamiento masivo del core de Firebase, reduciendo costos de ancho de banda en la capa gratuita de Firebase Storage.

---

## 3. Implementación de Inteligencia Artificial

El sistema implementa una arquitectura de **IA en el Borde (Edge AI)**, procesando los datos directamente en el dispositivo del usuario para privacidad y velocidad.

### Flujo de Procesamiento Visual
1.  **Captura y Pre-procesamiento:** La imagen capturada se redimensiona a tensores de 224x224px y se normaliza (pixel values / 255.0).
2.  **Inferencia (Clasificación):** MobileNet procesa el tensor y devuelve un vector de probabilidades para 1000 clases.
3.  **Filtrado de Seguridad (Safety Layer):**
    *   Antes de cualquier subida, la imagen pasa por el modelo `nsfwjs`.
    *   **Umbrales Estrictos:** Bloqueo automático si `Porn/Hentai > 0.05` o `Sexy > 0.20`.
    *   Este proceso es local y silencioso; las imágenes explícitas nunca salen del dispositivo del usuario.

---

## 4. Funcionalidades Críticas: Algoritmos

### 4.1. Motor de Coincidencias (Matching Engine)
El sistema utiliza un algoritmo híbrido ponderado para calcular la relevancia entre una búsqueda y los reportes:

Fórmula de Relevancia:
$$ Score = (W_v \cdot S_{visual}) + (W_l \cdot S_{geo}) + (W_t \cdot S_{text}) $$

*   **Similitud Visual ($S_{visual}$):** Producto punto entre los vectores de probabilidad de la búsqueda y los `aiTags` del reporte. Incluye lógica de penalización si hay discrepancia semántica fuerte (ej: IA detecta "Pug" pero texto dice "Pastor Alemán").
*   **Similitud Textual ($S_{text}$):** Algoritmo de **Distancia de Levenshtein** normalizado para comparar nombres de razas y descripciones manuales, tolerando errores tipográficos.
*   **Geolocalización ($S_{geo}$):** Cálculo de distancia mediante **Fórmula del Haversine**. Se otorgan puntajes escalonados (Radio < 5km: 100%, < 15km: 60%, < 40km: 20%).

### 4.2. Infraestructura y Despliegue (CI/CD)
*   **Entorno:** Configuración agnóstica de sistema operativo (compatible con Windows/Linux/Mac).
*   **Flujo de Despliegue:**
    1.  **Build:** `vite build` genera un bundle optimizado, minificado y con "tree-shaking" para eliminar código muerto.
    2.  **Deploy:** Despliegue atómico a Firebase Hosting a través de CLI (`firebase-tools`).
    3.  **Rollback:** Capacidad de reversión instantánea gracias al versionado inmutable de Firebase Hosting.

---

**Elaborado por:** DogFinder Senior Architecture Team
**Contacto:** Arquitecto de Software Principal
