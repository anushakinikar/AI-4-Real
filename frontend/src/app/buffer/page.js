"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function BufferContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const documentId = searchParams.get('documentId');
    
    const [status, setStatus] = useState("Initializing translation engine...");
    const [progress, setProgress] = useState(10);
    const [error, setError] = useState(null);

    useEffect(() => {
        const performTranslation = async () => {
            if (!documentId) {
                setError("No document ID provided.");
                return;
            }

            try {
                // Step 1: Start Translation Process
                setStatus("Searching Translation Memory (TM) for matches...");
                setProgress(30);
                
                const response = await fetch(`http://localhost:8081/api/documents/${documentId}/translate`, {
                    method: 'POST'
                });
                
                const data = await response.json();
                
                if (!response.ok || !data.success) {
                    throw new Error(data.error || "Translation process failed.");
                }

                // Step 2: Finalize
                setStatus("Finalizing translation matches...");
                setProgress(80);
                
                // Small artificial delay for premium feel
                await new Promise(r => setTimeout(r, 1500));
                
                setProgress(100);
                setStatus("Translation complete! Redirecting...");
                
                // Step 3: Redirect to review (assuming a review page exists or back to project)
                setTimeout(() => {
                    router.push(`/projects/${documentId}/review`); // Adjust target URL as needed
                }, 1000);

            } catch (err) {
                console.error(err);
                setError(err.message);
            }
        };

        performTranslation();
    }, [documentId, router]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
                <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Translation Failed</h2>
                    <p className="text-slate-600 mb-8">{error}</p>
                    <button 
                        onClick={() => router.back()}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-semibold hover:bg-slate-800 transition-all"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
            <div className="max-w-xl w-full">
                {/* Visual Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl shadow-lg mb-8 animate-pulse text-blue-600">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                            <path d="m9 12 2 2 4-4" />
                        </svg>
                    </div>
                    <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Processing Translation</h1>
                    <p className="text-lg text-slate-600 font-medium">{status}</p>
                </div>

                {/* Progress Bar Container */}
                <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-white/50 backdrop-blur-sm">
                    <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden mb-6">
                        <div 
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-1000 ease-out rounded-full"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold text-slate-400">
                        <span>{progress}% COMPLETE</span>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                            <span className="text-blue-600">ACTIVE</span>
                        </div>
                    </div>
                </div>

                {/* Footer Insight */}
                <div className="mt-12 text-center text-slate-400 text-sm font-medium">
                    <p>Leveraging state-of-the-art vector matching for maximum accuracy</p>
                </div>
            </div>
        </div>
    );
}

export default function BufferPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <BufferContent />
        </Suspense>
    );
}
