import { build } from 'vite';
import path from 'path';

async function run() {
    try {
        console.log('--- Iniciando build programático ---');
        await build({
            configFile: path.resolve(process.cwd(), 'vite.config.js'),
        });
        console.log('--- Build Exitoso ---');
    } catch (err) {
        console.error('--- ERROR CAPTURADO ---');
        console.error(err);
        if (err.stack) {
            console.error(err.stack);
        }
        process.exit(1);
    }
}

run();
