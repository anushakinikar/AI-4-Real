/* frontend/src/app/sourcequality/page.js */
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import IssueCard from '../../components/IssueCard.js';

function QualityCheckContent() {
    const searchParams = useSearchParams();
    const documentId = searchParams.get('documentId');

    const [segments, setSegments] = useState([]);
    const [stats, setStats] = useState({ spelling: 0, grammar: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchQualityReport = async ({ keepLoading = false } = {}) => {
        if (!documentId) {
            setLoading(false);
            return;
        }

        if (!keepLoading) {
            setLoading(true);
        }

        try {
            const response = await fetch(`http://localhost:8081/api/documents/${documentId}/quality-report`);

            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                setSegments(data.segments);
                setStats({
                    spelling: data.stats.spelling,
                    grammar: data.stats.grammar,
                    total: data.stats.totalSegments
                });
                setError(null);
            }
        } catch (err) {
            console.error('Failed to fetch quality report:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQualityReport();
    }, [documentId]);

    const handleResolveIssue = async ({ error: issue, replacementText }) => {
        const response = await fetch(`http://localhost:8081/api/validation-issues/${issue.issueId}/resolve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                documentId: Number(documentId),
                replacementText,
                sourceLang: 'en-US'
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to update the segment.');
        }

        await fetchQualityReport({ keepLoading: true });
        return data;
    };

    // ── Loading & Error States ──
    if (loading) {
        return (
            <div className="page-container flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <p className="text-lg font-medium text-slate-600">Analyzing source quality...</p>
                </div>
            </div>
        );
    }

    if (!documentId) {
        return (
            <div className="page-container p-10 text-center">
                <div className="bg-orange-50 border border-orange-200 p-6 rounded-xl">
                    <h2 className="text-orange-800 font-bold mb-2">No Document Context Found</h2>
                    <p className="text-orange-700">Please go back to the upload page and submit your document first.</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-container p-10 text-center">
                <div className="bg-red-50 border border-red-200 p-6 rounded-xl text-red-800">
                    <strong>Error:</strong> {error}
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">

            {/* ── Page Header ── */}
            <h1 className="page-title">Source quality check</h1>
            <p className="page-subtitle">
                Reviewing spelling and grammar before translation. Review and fix any issues found.
            </p>

            {/* ── Stat Cards ── */}
            <div className="stats-grid">
                {/* Spelling Errors Card */}
                <div className="stat-card-red">
                    <div className="stat-icon-box">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>
                    <div>
                        <p className="stat-label" style={{ color: '#f87171' }}>Spelling Errors</p>
                        <p className="stat-number" style={{ color: '#dc2626' }}>{stats.spelling}</p>
                    </div>
                </div>

                {/* Grammar Issues Card */}
                <div className="stat-card-orange">
                    <div className="stat-icon-box">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5">
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <div>
                        <p className="stat-label" style={{ color: '#fb923c' }}>Grammar Issues</p>
                        <p className="stat-number" style={{ color: '#ea580c' }}>{stats.grammar}</p>
                    </div>
                </div>

                {/* Segments Parsed Card */}
                <div className="stat-card-green">
                    <div className="stat-icon-box">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            <polyline points="14 2 14 8 20 8" />
                        </svg>
                    </div>
                    <div>
                        <p className="stat-label" style={{ color: '#4ade80' }}>Segments Parsed</p>
                        <p className="stat-number" style={{ color: '#16a34a' }}>{stats.total}</p>
                    </div>
                </div>
            </div>

            {/* ── Segments List ── */}
            <div className="segments-list">
                {segments.length > 0 ? (
                    segments.map(s => (
                        <IssueCard key={`${s.dbId}-${s.fullText}-${s.errors.length}`} {...s} onResolveIssue={handleResolveIssue} />
                    ))
                ) : (
                    <div className="p-10 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        No segments found for this document.
                    </div>
                )}
            </div>

            {/* ── Proceed Button ── */}
            <div className="proceed-btn-wrap">
                <button className="btn-proceed">
                    Proceed to Translation
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                    </svg>
                </button>
            </div>

        </div>
    );
}

// Default export uses Suspense for App Router searchParams usage
export default function SourceQualityCheck() {
    return (
        <Suspense fallback={<div className="p-10 text-center">Loading page assets...</div>}>
            <QualityCheckContent />
        </Suspense>
    );
}