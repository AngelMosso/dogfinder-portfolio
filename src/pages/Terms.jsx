import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Terms() {
    const navigate = useNavigate();

    return (
        <div className="bg-gray-50 min-h-full pb-12">
            {/* Header */}
            <div className="bg-white px-4 py-6 sticky top-0 z-10 shadow-sm border-b border-gray-100 flex items-center justify-between">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 active:scale-90 transition"
                >
                    <span className="material-icons">arrow_back</span>
                </button>
                <h1 className="text-lg font-black text-gray-900 uppercase tracking-widest">Legal</h1>
                <div className="w-10"></div> {/* Spacer */}
            </div>

            <div className="p-6 max-w-2xl mx-auto space-y-8">
                <section className="bg-white p-8 rounded-[32px] shadow-soft border border-gray-100">
                    <h2 className="text-2xl font-black text-brand-600 mb-4 flex items-center">
                        <span className="material-icons mr-2 text-brand-500">gavel</span>
                        Términos y Condiciones
                    </h2>
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-6">Última actualización: 18 de febrero de 2026</p>

                    <div className="space-y-6 text-gray-600 leading-relaxed text-sm">
                        <div>
                            <h3 className="font-black text-gray-900 mb-2 uppercase text-xs tracking-wider">1. Aceptación de los Términos</h3>
                            <p>Al acceder y utilizar DogFinder, usted acepta cumplir y estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguna parte, no podrá utilizar la plataforma.</p>
                        </div>

                        <div>
                            <h3 className="font-black text-gray-900 mb-2 uppercase text-xs tracking-wider">2. Propiedad Intelectual</h3>
                            <p>Todo el contenido, diseño, logotipos, código fuente, algoritmos de IA y motor de búsqueda son propiedad exclusiva de **Angel Yanif Mosso**. Queda estrictamente prohibida la reproducción, copia o distribución sin autorización expresa por escrito.</p>
                        </div>

                        <div>
                            <h3 className="font-black text-gray-900 mb-2 uppercase text-xs tracking-wider">3. Uso Aceptable</h3>
                            <p>Los usuarios se comprometen a proporcionar información verídica en los reportes. Cualquier uso malintencionado, acoso o falsificación de datos resultará en la baja inmediata de la cuenta.</p>
                        </div>

                        <div>
                            <h3 className="font-black text-gray-900 mb-2 uppercase text-xs tracking-wider">4. Responsabilidad</h3>
                            <p>DogFinder es una herramienta de coordinación comunitaria. No somos responsables por las acciones de terceros ni garantizamos el hallazgo del animal, aunque ponemos toda nuestra tecnología a su disposición para maximizar las probabilidades.</p>
                        </div>

                        <div>
                            <h3 className="font-black text-gray-900 mb-2 uppercase text-xs tracking-wider">5. Privacidad de Datos</h3>
                            <p>Su información nunca será vendida a terceros. Las fotos son analizadas localmente por nuestra IA para proteger su privacidad y la de su mascota.</p>
                        </div>
                    </div>
                </section>

                <div className="text-center">
                    <button
                        onClick={() => navigate(-1)}
                        className="bg-brand-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-brand-500/20 active:scale-95 transition-all text-xs"
                    >
                        Entendido y Acepto
                    </button>
                </div>
            </div>
        </div>
    );
}
