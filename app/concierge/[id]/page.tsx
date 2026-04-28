'use client';
import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import {
    Upload,
    FileText,
    Image as ImageIcon,
    Film,
    Music,
    File as FileIcon,
    Send,
    Video,
    MessageCircle,
    Calendar,
    CheckCircle,
    Loader2,
    X
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import toast from 'react-hot-toast';
import type {
    ConciergeProject,
    ConciergeFile,
    ConciergeNote
} from '@/types/concierge';
import {
    CONCIERGE_STATUS_CONFIG,
    formatFileSize,
    getFileCategory
} from '@/types/concierge';

export default function ConciergeSpacePage({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = use(params);
    const projectId = unwrappedParams.id;
    const router = useRouter();
    const supabase = createClient();

    const [project, setProject] = useState<ConciergeProject | null>(null);
    const [files, setFiles] = useState<ConciergeFile[]>([]);
    const [notes, setNotes] = useState<ConciergeNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');

    const [newNote, setNewNote] = useState('');
    const [sendingNote, setSendingNote] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Load project data
    useEffect(() => {
        loadProjectData();
    }, [projectId]);

    const loadProjectData = async () => {
        setLoading(true);
        try {
            // Load project
            const { data: projectData, error: projectError } = await supabase
                .from('concierge_projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (projectError) throw projectError;
            if (!projectData) {
                setError('Project not found');
                return;
            }

            setProject(projectData as ConciergeProject);

            // Load files
            const { data: filesData, error: filesError } = await supabase
                .from('concierge_files')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false });

            if (filesError) throw filesError;
            setFiles((filesData as ConciergeFile[]) || []);

            // Load notes (only from user)
            const { data: notesData, error: notesError } = await supabase
                .from('concierge_notes')
                .select('*')
                .eq('project_id', projectId)
                .eq('from_user', true)
                .order('created_at', { ascending: false });

            if (notesError) throw notesError;
            setNotes((notesData as ConciergeNote[]) || []);

        } catch (err: any) {
            console.error('Error loading project:', err);
            setError(err.message || 'Failed to load project');
        } finally {
            setLoading(false);
        }
    };

    // Handle file upload
    const handleFileUpload = async (uploadedFiles: FileList | null) => {
        if (!uploadedFiles || uploadedFiles.length === 0) return;

        setUploading(true);
        setUploadProgress('');

        const filesArray = Array.from(uploadedFiles);

        for (let i = 0; i < filesArray.length; i++) {
            const file = filesArray[i];
            setUploadProgress(`Gathering ${i + 1} of ${filesArray.length}...`);

            try {
                // Upload to Supabase Storage
                const fileExt = file.name.split('.').pop() || 'file';
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `${projectId}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('concierge-files')
                    .upload(filePath, file, {
                        contentType: file.type,
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                // Get public URL
                const { data: publicUrlData } = supabase.storage
                    .from('concierge-files')
                    .getPublicUrl(filePath);

                // Save to database
                const { error: dbError } = await supabase
                    .from('concierge_files')
                    .insert([{
                        project_id: projectId,
                        file_name: file.name,
                        file_type: file.type,
                        file_size: file.size,
                        storage_path: filePath,
                        public_url: publicUrlData.publicUrl,
                        user_note: null
                    }]);

                if (dbError) throw dbError;

            } catch (err: any) {
                console.error(`Error uploading ${file.name}:`, err);
                toast.error(`Failed to upload ${file.name}: ${err.message}`);
            }
        }

        setUploading(false);
        setUploadProgress('');

        // Reload files
        loadProjectData();

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFiles = e.dataTransfer.files;
        handleFileUpload(droppedFiles);
    };

    // Send note
    const handleSendNote = async () => {
        if (!newNote.trim()) return;

        setSendingNote(true);
        try {
            const { error } = await supabase
                .from('concierge_notes')
                .insert([{
                    project_id: projectId,
                    note_type: 'text',
                    content: newNote.trim(),
                    from_user: true
                }]);

            if (error) throw error;

            setNewNote('');
            loadProjectData();
        } catch (err: any) {
            console.error('Error sending note:', err);
            toast.error('Failed to send note. Please try again.');
        } finally {
            setSendingNote(false);
        }
    };

    // Get file icon
    const getFileIcon = (mimeType: string) => {
        if (mimeType.startsWith('image/')) return <ImageIcon size={20} className="text-olive" />;
        if (mimeType.startsWith('video/')) return <Film size={20} className="text-warm-muted" />;
        if (mimeType.startsWith('audio/')) return <Music size={20} className="text-olive" />;
        if (mimeType.includes('pdf') || mimeType.includes('document')) return <FileText size={20} className="text-warm-muted" />;
        return <FileIcon size={20} className="text-warm-outline" />;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={48} className="text-olive animate-spin mx-auto mb-4" />
                    <p className="text-warm-muted">Loading your space...</p>
                </div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <X size={40} className="text-red-600" />
                    </div>
                    <h1 className="font-serif text-3xl text-warm-dark mb-3">Project Not Found</h1>
                    <p className="text-warm-muted mb-6">{error || 'This project does not exist.'}</p>
                    <button
                        onClick={() => router.push('/choice-pricing')}
                        className="px-6 py-3 bg-olive/10 hover:bg-olive/20 text-olive rounded-lg font-medium transition-all"
                    >
                        Go to Home
                    </button>
                </div>
            </div>
        );
    }

    const statusConfig = CONCIERGE_STATUS_CONFIG[project.status];

    return (
        <div className="min-h-screen bg-gradient-to-br from-olive/5 via-surface-low to-warm-muted/5">
            {/* Header */}
            <div className="border-b border-warm-border/30 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="font-serif text-3xl text-warm-dark mb-1">Your Archive</h1>
                            <p className="text-sm text-warm-muted">{project.name}</p>
                        </div>

                        {/* Status Badge */}
                        <div className={`px-4 py-2 rounded-full ${statusConfig.bgColor} ${statusConfig.color} text-sm font-medium flex items-center gap-2`}>
                            {project.status === 'finalized' && <CheckCircle size={16} />}
                            {statusConfig.label}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
                {/* Reassuring Message */}
                <div className="bg-gradient-to-br from-olive/10 to-warm-muted/10 rounded-2xl p-8 border border-olive/20">
                    <h2 className="font-serif text-2xl text-warm-dark mb-3">
                        {project.status === 'requested' && "We'll contact you soon"}
                        {project.status === 'in_progress' && "Your archive is being created"}
                        {project.status === 'in_review' && "Almost ready"}
                        {project.status === 'finalized' && "Your archive is complete"}
                    </h2>
                    <p className="text-warm-dark/70 leading-relaxed">
                        {statusConfig.description}. You can close this page anytime — everything is taken care of.
                    </p>
                </div>

                {/* Zoom Call Button (if link exists) */}
                {project.zoom_link && (
                    <a
                        href={project.zoom_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-6 bg-white rounded-xl border-2 border-olive/30 hover:border-olive/50 hover:shadow-md transition-all"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-olive/10 rounded-xl flex items-center justify-center">
                                    <Video size={24} className="text-olive" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-warm-dark mb-1">
                                        Schedule a call with us
                                    </h3>
                                    <p className="text-sm text-warm-muted">
                                        Click to join or schedule your Zoom meeting
                                    </p>
                                </div>
                            </div>
                            <Calendar size={20} className="text-olive" />
                        </div>
                    </a>
                )}

                {/* File Upload Zone */}
                <div className="bg-white rounded-2xl border-2 border-warm-border/30 p-8">
                    <h3 className="font-semibold text-warm-dark mb-2 flex items-center gap-2">
                        <Upload size={20} className="text-olive" />
                        Share your materials
                    </h3>
                    <p className="text-sm text-warm-muted mb-6">
                        Drop any files here — photos, documents, videos, audio recordings. No need to organize or name anything.
                    </p>

                    {/* Drop Zone */}
                    <div
                        ref={dropZoneRef}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${isDragging
                            ? 'border-olive bg-olive/5 scale-[1.02]'
                            : 'border-olive/40 hover:border-olive/40 hover:bg-olive/5'
                            } ${uploading ? 'opacity-50 cursor-wait' : ''}`}
                    >
                        {uploading ? (
                            <div className="flex flex-col items-center">
                                <Loader2 size={40} className="text-olive animate-spin mb-4" />
                                <p className="text-olive font-medium">{uploadProgress}</p>
                                <p className="text-sm text-warm-muted mt-2">Please stay on this page...</p>
                            </div>
                        ) : (
                            <>
                                <Upload size={48} className="text-warm-outline mx-auto mb-4" />
                                <p className="text-warm-dark/70 mb-2">
                                    Drop files here or click to browse
                                </p>
                                <p className="text-sm text-warm-outline">
                                    Any file type accepted • No size limit concerns
                                </p>
                            </>
                        )}
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={(e) => handleFileUpload(e.target.files)}
                        className="hidden"
                        disabled={uploading}
                    />
                </div>

                {/* Uploaded Files List */}
                {files.length > 0 && (
                    <div className="bg-white rounded-2xl border border-warm-border/30 p-6">
                        <h3 className="font-semibold text-warm-dark mb-4">
                            Files you've shared ({files.length})
                        </h3>
                        <div className="space-y-2">
                            {files.map((file) => (
                                <div
                                    key={file.id}
                                    className="flex items-center gap-3 p-3 bg-warm-border/10 rounded-lg hover:bg-warm-border/20 transition-colors"
                                >
                                    {getFileIcon(file.file_type)}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-warm-dark truncate">
                                            {file.file_name}
                                        </p>
                                        <p className="text-xs text-warm-outline">
                                            {getFileCategory(file.file_type)} • {formatFileSize(file.file_size)}
                                        </p>
                                    </div>
                                    <CheckCircle size={16} className="text-olive flex-shrink-0" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Send a Note */}
                <div className="bg-white rounded-2xl border border-warm-border/30 p-6">
                    <h3 className="font-semibold text-warm-dark mb-2 flex items-center gap-2">
                        <MessageCircle size={20} className="text-warm-muted" />
                        Send us a message
                    </h3>
                    <p className="text-sm text-warm-muted mb-4">
                        Any questions, thoughts, or details you'd like to share?
                    </p>

                    <div className="flex gap-3">
                        <textarea
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Type anything you'd like us to know..."
                            rows={3}
                            className="flex-1 px-4 py-3 border border-olive/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/30 focus:border-olive transition-all resize-none"
                            disabled={sendingNote}
                        />
                        <button
                            onClick={handleSendNote}
                            disabled={!newNote.trim() || sendingNote}
                            className="px-6 py-3 bg-olive/10 hover:bg-olive/20 text-olive rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed self-end"
                        >
                            {sendingNote ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    <Send size={18} />
                                    Send
                                </>
                            )}
                        </button>
                    </div>

                    {/* Previous Notes */}
                    {notes.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-warm-border/20">
                            <p className="text-xs font-medium text-warm-muted mb-3">Your previous messages:</p>
                            <div className="space-y-2">
                                {notes.map((note) => (
                                    <div key={note.id} className="p-3 bg-warm-border/5 rounded-lg">
                                        <p className="text-sm text-warm-dark/70">{note.content}</p>
                                        <p className="text-xs text-warm-outline mt-1">
                                            {new Date(note.created_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Content Preview (what we're building) */}
                {project.content_preview && Object.keys(project.content_preview).length > 0 && (
                    <div className="bg-gradient-to-br from-olive/5 to-warm-muted/5 rounded-2xl border-2 border-olive/20 p-8">
                        <h3 className="font-serif text-2xl text-warm-dark mb-4">What we're building</h3>
                        <p className="text-sm text-warm-muted mb-6">
                            Here's what's taking shape. This will update as we make progress.
                        </p>

                        <div className="space-y-6">
                            {/* Name */}
                            {project.content_preview.full_name && (
                                <div>
                                    <p className="text-xs font-medium text-warm-muted mb-1">Name</p>
                                    <p className="font-serif text-xl text-warm-dark">{project.content_preview.full_name}</p>
                                </div>
                            )}

                            {/* Dates */}
                            {(project.content_preview.birth_date || project.content_preview.death_date) && (
                                <div>
                                    <p className="text-xs font-medium text-warm-muted mb-1">Dates</p>
                                    <p className="text-warm-dark">
                                        {project.content_preview.birth_date}
                                        {project.content_preview.death_date && ` — ${project.content_preview.death_date}`}
                                    </p>
                                </div>
                            )}

                            {/* Biography Intro */}
                            {project.content_preview.biography_intro && (
                                <div>
                                    <p className="text-xs font-medium text-warm-muted mb-2">Opening</p>
                                    <p className="text-warm-dark/80 leading-relaxed">{project.content_preview.biography_intro}</p>
                                </div>
                            )}

                            {/* Structure */}
                            {project.content_preview.structure && project.content_preview.structure.length > 0 && (
                                <div>
                                    <p className="text-xs font-medium text-warm-muted mb-3">Archive Structure</p>
                                    <div className="space-y-2">
                                        {project.content_preview.structure.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-3 p-3 bg-white/50 rounded-lg">
                                                <div className={`w-2 h-2 rounded-full ${item.status === 'complete' ? 'bg-olive' :
                                                    item.status === 'in_progress' ? 'bg-warm-muted' :
                                                        'bg-warm-border'
                                                    }`} />
                                                <span className="text-sm text-warm-dark">{item.section}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Reassurance Footer */}
                <div className="text-center py-8">
                    <p className="text-sm text-warm-outline leading-relaxed max-w-2xl mx-auto">
                        You don't need to do anything else right now. We'll reach out when we need more information or when your archive is ready to review.
                    </p>
                </div>
            </div>
        </div >
    );
}
