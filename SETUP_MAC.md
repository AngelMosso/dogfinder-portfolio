# Configuración de Entorno iOS (macOS)

Guía para preparar el entorno de desarrollo y compilación en macOS.

## Prerrequisitos
*   **Node.js 18+**
*   **Xcode** (Última versión estable desde App Store)
*   **CocoaPods** (`sudo gem install cocoapods`)

## Instrucciones de Instalación

1.  **Instalar dependencias del proyecto:**
    ```bash
    npm install
    ```

2.  **Generar build de producción:**
    ```bash
    npm run build
    ```

3.  **Configurar entorno nativo iOS:**
    ```bash
    # Sincronizar assets y plugins con el proyecto nativo
    npx cap sync ios
    ```

4.  **Abrir proyecto en Xcode:**
    ```bash
    npx cap open ios
    ```

## Notas de Desarrollo
*   El proyecto utiliza **Capacitor** como puente nativo.
*   Para probar en dispositivo físico, asegúrate de seleccionar tu Team de desarrollo en la pestaña "Signing & Capabilities" dentro de Xcode.
*   Si encuentras errores de pods, intenta ejecutar `cd ios/App && pod install && cd ../..`.

---
*Documentación interna de despliegue móvil.*
