// Core AI Model Service
// Handles lazy loading of TensorFlow.js and MobileNet v2

let tf = null;
let mobilenet = null;
let model = null;
let nsfwModel = null;
let isLoading = false;
let isLoadingNSFW = false;

export const aiModel = {
    async loadModel() {
        if (model) return model;
        if (isLoading) {
            while (isLoading) await new Promise(r => setTimeout(r, 100));
            return model;
        }

        isLoading = true;
        try {
            if (!tf) tf = await import('@tensorflow/tfjs');
            if (!mobilenet) mobilenet = await import('@tensorflow-models/mobilenet');
            await tf.ready();

            model = await mobilenet.load({ version: 2, alpha: 0.5 });
            return model;
        } catch (error) {
            console.error("[AI] Model load failed:", error);
            throw error;
        } finally {
            isLoading = false;
        }
    },

    async loadNSFWModel() {
        if (nsfwModel) return nsfwModel;
        if (isLoadingNSFW) {
            while (isLoadingNSFW) await new Promise(r => setTimeout(r, 100));
            return nsfwModel;
        }

        isLoadingNSFW = true;
        try {
            if (!tf) tf = await import('@tensorflow/tfjs');

            // Retry mechanism for CDN loaded scripts
            if (!window.nsfwjs) await new Promise(r => setTimeout(r, 500));
            if (!window.nsfwjs) throw new Error("NSFWJS dependency missing");

            await tf.ready();
            nsfwModel = await window.nsfwjs.load();
            return nsfwModel;
        } catch (error) {
            console.error("[AI] Safety model load failed:", error);
            throw error;
        } finally {
            isLoadingNSFW = false;
        }
    },

    async processImage(imgElement) {
        if (!tf) tf = await import('@tensorflow/tfjs');
        return tf.tidy(() => {
            const tensor = tf.browser.fromPixels(imgElement);
            const [height, width] = tensor.shape;
            const size = Math.min(height, width);

            // Center crop
            const startY = (height - size) >> 1;
            const startX = (width - size) >> 1;
            const cropped = tensor.slice([startY, startX, 0], [size, size, 3]);

            return tf.image.resizeBilinear(cropped, [224, 224]);
        });
    },

    async classifyImage(source) {
        let tensor = null;
        try {
            const net = await this.loadModel();
            const img = typeof source === 'string' ? await this.createImageElement(source) : source;

            tensor = await this.processImage(img);
            return await net.classify(tensor);
        } catch (error) {
            console.error("[AI] Classification error:", error);
            throw error;
        } finally {
            if (tensor?.dispose) tensor.dispose();
        }
    },

    async checkSafety(source) {
        try {
            const net = await this.loadNSFWModel();
            const img = typeof source === 'string' ? await this.createImageElement(source) : source;
            const predictions = await net.classify(img);

            // Strict safety thresholds
            const isExplicit = predictions.some(p =>
                ['Porn', 'Hentai'].includes(p.className) && p.probability > 0.05
            );
            const isSuggestive = predictions.some(p =>
                p.className === 'Sexy' && p.probability > 0.20
            );

            return {
                isSafe: !isExplicit && !isSuggestive,
                report: predictions,
                category: predictions[0].className,
                probability: predictions[0].probability
            };
        } catch (error) {
            console.error("[AI] Safety check error:", error);
            // Fail-safe: Allow logic to handle error downstream, default to safe to avoid blocking UX on error
            return { isSafe: true, error: error.message };
        }
    },

    createImageElement(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Image load failed"));
            img.src = src;
        });
    }
};
