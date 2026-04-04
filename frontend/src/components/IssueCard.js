"use client";
import { useState } from 'react';

export default function IssueCard({ id, title, fullText, status, errors = [] }) {
    const [isOpen, setIsOpen] = useState(status !== 'clean');
    const [resolutions, setResolutions] = useState(
        () => Object.fromEntries(errors.map((_, i) => [i, 'open']))
    );
    const [editValues, setEditValues] = useState(
        () => Object.fromEntries(errors.map((e, i) => [i, e.suggestion]))
    );

    const spellCount = errors.filter(e => e.type === 'Spelling').length;
    const grammarCount = errors.filter(e => e.type === 'Grammar').length;

    const applyFix = (i) => setResolutions(p => ({ ...p, [i]: 'fixed' }));
    const ignoreIt = (i) => setResolutions(p => ({ ...p, [i]: 'ignored' }));
    const startEdit = (i) => setResolutions(p => ({ ...p, [i]: 'editing' }));
    const confirmEdit = (i) => setResolutions(p => ({ ...p, [i]: 'fixed' }));

    return (
        <div className="issue-card-wrap">

            {/* ── Header ── */}
            <div
                className="issue-card-header"
                onClick={() => setIsOpen(o => !o)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden', flex: 1 }}>
                    {/* Chevron */}
                    <svg
                        className={`chevron ${isOpen ? 'open' : 'closed'}`}
                        width="18" height="18" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor"
                        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    >
                        <path d="m6 9 6 6 6-6" />
                    </svg>

                    <span className="seg-id">#{id}</span>
                    <span className="seg-title">{title}</span>
                </div>

                {/* Status badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {status === 'clean' ? (
                        <span className="badge-clean">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Clean
                        </span>
                    ) : (
                        <>
                            {spellCount > 0 && (
                                <span className="badge-spelling">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    {spellCount} spelling
                                </span>
                            )}
                            {grammarCount > 0 && (
                                <span className="badge-grammar">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                    {grammarCount} grammar
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ── Expanded body ── */}
            {isOpen && status === 'error' && (
                <div className="issue-card-body animate-in">

                    {/* Full text with highlights */}
                    <p className="issue-fulltext">
                        {highlightErrors(fullText, errors, resolutions, editValues)}
                    </p>

                    {/* Issues list */}
                    <div className="issues-header">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="3">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span className="issues-header-label">
                            {errors.length} issue{errors.length > 1 ? 's' : ''} found — review each below
                        </span>
                    </div>

                    {errors.map((error, idx) => {
                        const state = resolutions[idx];
                        const isGrammar = error.type === 'Grammar';
                        const typeClass = isGrammar ? 'grammar' : 'spelling';

                        return (
                            <div
                                key={idx}
                                className={`error-row ${typeClass} ${state === 'ignored' ? 'ignored' : ''}`}
                            >
                                {/* Left side */}
                                <div style={{ flex: 1 }}>
                                    {/* Badge + note */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <span className={`err-badge ${typeClass}`}>
                                            {error.type}
                                        </span>
                                        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
                                            {error.note || (isGrammar ? 'Grammar suggestion' : 'Spelling mistake')}
                                        </span>
                                    </div>

                                    {/* State: editing */}
                                    {state === 'editing' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <input
                                                className="edit-input"
                                                value={editValues[idx]}
                                                onChange={e => setEditValues(p => ({ ...p, [idx]: e.target.value }))}
                                                autoFocus
                                            />
                                            <button
                                                className="btn-confirm"
                                                onClick={() => confirmEdit(idx)}
                                            >
                                                Confirm
                                            </button>
                                        </div>
                                    )}

                                    {/* State: fixed */}
                                    {state === 'fixed' && (
                                        <span className="fixed-label">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            Fixed — "{editValues[idx]}"
                                        </span>
                                    )}

                                    {/* State: open or ignored */}
                                    {(state === 'open' || state === 'ignored') && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}>
                                            <span style={{
                                                textDecoration: 'line-through',
                                                fontWeight: 700,
                                                background: isGrammar ? '#fff7ed' : '#fff1f2',
                                                color: isGrammar ? '#9a3412' : '#991b1b',
                                                padding: '1px 5px',
                                                borderRadius: 4,
                                            }}>
                                                {error.original}
                                            </span>
                                            <span style={{ color: '#cbd5e1', fontWeight: 300 }}>→</span>
                                            <span style={{
                                                fontWeight: 700,
                                                color: '#00B67A',
                                                background: '#f0fdf4',
                                                padding: '1px 5px',
                                                borderRadius: 4,
                                            }}>
                                                {error.suggestion}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Right: action buttons — only when open */}
                                {state === 'open' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <button
                                            className="btn-apply"
                                            onClick={e => { e.stopPropagation(); applyFix(idx); }}
                                        >
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            Apply Fix
                                        </button>
                                        <button
                                            className="btn-edit"
                                            onClick={e => { e.stopPropagation(); startEdit(idx); }}
                                        >
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                            Edit
                                        </button>
                                        <button
                                            className="btn-ignore"
                                            onClick={e => { e.stopPropagation(); ignoreIt(idx); }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                            Ignore
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function highlightErrors(text, errors, resolutions, editValues) {
    if (!errors || !errors.length) return text;

    // Map each error to its position in the string
    const ranges = [];
    errors.forEach((err, i) => {
        const pos = text.indexOf(err.original);
        if (pos !== -1) {
            ranges.push({ start: pos, end: pos + err.original.length, idx: i });
        }
    });

    if (!ranges.length) return text;

    // Sort left to right so we walk the string once
    ranges.sort((a, b) => a.start - b.start);

    const parts = [];
    let cursor = 0;

    ranges.forEach(({ start, end, idx }) => {
        if (cursor < start) parts.push(text.slice(cursor, start));

        const err = errors[idx];
        const state = resolutions[idx];
        const isGrammar = err.type === 'Grammar';

        if (state === 'fixed') {
            parts.push(
                <span key={idx} className="hl-fixed">{editValues[idx]}</span>
            );
        } else if (state === 'ignored') {
            parts.push(<span key={idx}>{err.original}</span>);
        } else {
            parts.push(
                <span key={idx} className={isGrammar ? 'hl-grammar' : 'hl-spelling'}>
                    {err.original}
                </span>
            );
        }

        cursor = end;
    });

    if (cursor < text.length) parts.push(text.slice(cursor));
    return parts;
}