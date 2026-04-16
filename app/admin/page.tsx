// app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, Search, Filter, Eye, Edit, Clock, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ConciergeProject } from '@/types/concierge';

const STATUS_CONFIG = {
    requested: { label: 'Requested', color: 'text-warm-brown', bg: 'bg-surface-high', icon: Clock },
    in_progress: { label: 'In Progress', color: 'text-blue-600', bg: 'bg-blue-50', icon: Edit },
    in_review: { label: 'In Review', color: 'text-purple-600', bg: 'bg-purple-50', icon: Eye },
    finalized: { label: 'Finalized', color: 'text-olive', bg: 'bg-olive/10', icon: CheckCircle }
};

export default function AdminDashboard() {
    const [projects, setProjects] = useState<ConciergeProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('concierge_projects')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProjects(data || []);
        } catch (err) {
            console.error('Error loading projects:', err);
            alert('Failed to load projects');
        } finally {
            setLoading(false);
        }
    };

    // Filter projects
    const filteredProjects = projects.filter(project => {
        const matchesSearch =
            project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.person_full_name?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === 'all' || project.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // Stats
    const stats = {
        total: projects.length,
        requested: projects.filter(p => p.status === 'requested').length,
        in_progress: projects.filter(p => p.status === 'in_progress').length,
        in_review: projects.filter(p => p.status === 'in_review').length,
        finalized: projects.filter(p => p.status === 'finalized').length
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900">Concierge Admin</h1>
                            <p className="text-slate-600 mt-1">Manage all concierge requests and projects</p>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-none">
                            <Users size={20} className="text-slate-600" />
                            <span className="font-semibold text-slate-900">{stats.total}</span>
                            <span className="text-slate-600 text-sm">Total Projects</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                        const Icon = config.icon;
                        const count = stats[status as keyof typeof stats];
                        return (
                            <div
                                key={status}
                                className={`cursor-pointer border-2 p-4 transition-all hover:border-slate-300 ${config.bg} border-transparent rounded-none`}
                                onClick={() => setStatusFilter(status)}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <Icon size={20} className={config.color} />
                                    <span className="text-2xl font-bold text-slate-900">{count}</span>
                                </div>
                                <p className={`text-sm font-medium ${config.color}`}>{config.label}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Search and Filter Bar */}
                <div className="mb-6 border border-slate-200 bg-white p-4 shadow-sm rounded-none">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name, email, or person being honored..."
                                className="w-full border border-slate-300 py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-none"
                            />
                        </div>
                        <div className="relative">
                            <Filter size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="border border-slate-300 bg-white py-3 pl-12 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-none"
                            >
                                <option value="all">All Status</option>
                                <option value="requested">Requested</option>
                                <option value="in_progress">In Progress</option>
                                <option value="in_review">In Review</option>
                                <option value="finalized">Finalized</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Projects Table */}
                <div className="overflow-hidden border border-slate-200 bg-white shadow-sm rounded-none">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Requester</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Honoring</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Contact</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Created</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <Loader2 size={32} className="animate-spin mx-auto text-slate-400 mb-2" />
                                            <p className="text-slate-500">Loading projects...</p>
                                        </td>
                                    </tr>
                                ) : filteredProjects.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <AlertCircle size={32} className="mx-auto text-slate-400 mb-2" />
                                            <p className="text-slate-500">No projects found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProjects.map((project) => {
                                        const statusConfig = STATUS_CONFIG[project.status];
                                        const StatusIcon = statusConfig.icon;

                                        return (
                                            <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="font-medium text-slate-900">{project.name}</p>
                                                        <p className="text-sm text-slate-500">{project.email}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-slate-900">{project.person_full_name || '—'}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium ${statusConfig.bg} ${statusConfig.color} rounded-none`}>
                                                        <StatusIcon size={14} />
                                                        {statusConfig.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm text-slate-600 capitalize">{project.contact_preference}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm text-slate-600">{formatDate(project.created_at)}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Link
                                                        href={`/admin/${project.id}`}
                                                        className="inline-flex items-center gap-2 bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 rounded-none"
                                                    >
                                                        <Edit size={16} />
                                                        Manage
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-8 text-center text-sm text-slate-500">
                    Showing {filteredProjects.length} of {projects.length} projects
                </div>
            </div>
        </div>
    );
}
