// app/admin/abandoned/page.tsx

'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, AlertTriangle, Battery, Mail, Phone } from 'lucide-react';

interface AbandonedRecord {
    id: string;
    memorialName: string;
    ownerName: string;
    ownerEmail: string;
    daysInactive: number;
    progress: number;
    riskLevel: 'medium' | 'high' | 'critical';
    lastActive: string;
}

export default function AbandonedArchivesPage() {
    const [records, setRecords] = useState<AbandonedRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchReport();
    }, []);

    const fetchReport = async () => {
        try {
            const res = await fetch('/api/admin/reports/abandoned');
            const data = await res.json();
            if (data.success) {
                setRecords(data.report);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getRiskColor = (level: string) => {
        switch (level) {
            case 'critical': return 'bg-red-100 text-red-700 border-red-200';
            case 'high': return 'bg-surface-high text-warm-brown border-warm-brown/30';
            default: return 'bg-yellow-50 text-yellow-700 border-yellow-200';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/admin" className="border border-slate-200 bg-white p-2 hover:bg-slate-100 rounded-none">
                        <ArrowLeft size={20} className="text-slate-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">At-Risk Archives</h1>
                        <p className="text-slate-500">Paid projects inactive for more than 90 days</p>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-20">Loading report...</div>
                ) : records.length === 0 ? (
                    <div className="border border-slate-200 bg-white p-12 text-center rounded-none">
                        <p className="text-slate-500">No abandoned archives found. Good news!</p>
                    </div>
                ) : (
                    <div className="overflow-hidden border border-slate-200 bg-white shadow-sm rounded-none">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase">Memorial</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase">Owner</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase">Inactivity</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase">Progress</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {records.map((record) => (
                                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900">{record.memorialName || 'Untitled'}</div>
                                            <div className="text-xs text-slate-400 font-mono">{record.id.slice(0, 8)}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-900">{record.ownerName}</div>
                                            <div className="text-xs text-slate-500">{record.ownerEmail}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium ${getRiskColor(record.riskLevel)} rounded-none`}>
                                                <Clock size={12} />
                                                {record.daysInactive} days
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-16 overflow-hidden bg-slate-200 rounded-none">
                                                    <div className="h-full bg-blue-500" style={{ width: `${record.progress}%` }} />
                                                </div>
                                                <span className="text-xs text-slate-600">{record.progress}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                <a
                                                    href={`mailto:${record.ownerEmail}?subject=Help with your ULUMAE archive`}
                                                    className="p-2 text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-600 rounded-none"
                                                    title="Send Email Nudge"
                                                >
                                                    <Mail size={18} />
                                                </a>
                                                {record.riskLevel === 'critical' && (
                                                    <button
                                                        className="p-2 text-slate-600 transition-colors hover:bg-olive/10 hover:text-olive rounded-none"
                                                        title="Schedule Support Call"
                                                        onClick={() => alert('Feature: Integrate Calendly link sending here')}
                                                    >
                                                        <Phone size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
