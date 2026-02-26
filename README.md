 DogFinder - Rescate Canino con IA (v1.3)

DogFinder es una **Progressive Web App (PWA)** diseñada para facilitar la localización de mascotas perdidas. El proyecto utiliza Inteligencia Artificial integrada directamente en el navegador para identificar razas y agilizar el proceso de reporte.

Características Principales
**IA en el Borde (Edge AI):** Clasificación de razas en tiempo real usando TensorFlow.js, procesando la imagen localmente para mayor privacidad y velocidad.
**Arquitectura Serverless:** Gestión de datos y autenticación mediante Firebase (Firestore & Auth).
**Experiencia Móvil Nativa:** Compilada para Android utilizando Capacitor y Android Studio.
**Seguridad:** Moderación automática de contenido mediante el modelo NSFWJS antes de cualquier carga al servidor.

Stack Tecnológico
**Frontend:** React 19, Vite, TailwindCSS.
**Mobile:** Capacitor 8.1, Android Studio (Kotlin config).
**Backend:** Firebase (Hosting, Firestore, Auth).
**IA:** TensorFlow.js, MobileNet v2.

Instalación y Desarrollo
1. Clona el repositorio: `git clone https://github.com/tu-usuario/dogfinder.git`
2. Instala dependencias: `npm install`
3. Corre el entorno de desarrollo: `npm run dev`
4. Para Android: `npx cap open android` (Requiere Android Studio)

