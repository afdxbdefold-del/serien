'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import Image from 'next/image';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    name: string;
    image: string | null;
  };
  replies?: Comment[];
}

interface CommentsProps {
  articleSlug: string;
}

export default function CommentsSection({ articleSlug }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  useEffect(() => {
    fetchComments();
  }, [articleSlug]);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/articles/${articleSlug}/comments`);
      const data = await res.json();
      setComments(data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault();
    
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/articles/${articleSlug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: newComment,
          parentId: parentId || null
        }),
      });

      if (res.status === 401) {
        alert('Bitte melde dich an, um zu kommentieren');
        return;
      }

      if (res.ok) {
        setNewComment('');
        setReplyTo(null);
        fetchComments(); // Refresh comments
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
      alert('Fehler beim Posten des Kommentars');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-8 border border-gray-200">
      <div className="flex items-center gap-3 mb-8">
        <MessageSquare className="h-6 w-6 text-blue-600" />
        <h3 className="text-2xl font-bold">
          Kommentare ({comments.length})
        </h3>
      </div>

      {/* Comment Form */}
      <form onSubmit={(e) => handleSubmit(e)} className="mb-8">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Schreibe einen Kommentar..."
          rows={4}
          className="w-full p-4 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="flex justify-end mt-3">
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            {submitting ? 'Wird gesendet...' : 'Kommentieren'}
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-6">
        {comments.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Noch keine Kommentare. Sei der Erste!
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="border-b border-gray-100 pb-6 last:border-0">
              <div className="flex gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {comment.user.image ? (
                    <Image
                      src={comment.user.image}
                      alt={comment.user.name}
                      width={48}
                      height={48}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                      {comment.user.name[0]}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold">{comment.user.name}</span>
                    <span className="text-sm text-gray-500">
                      {new Date(comment.createdAt).toLocaleDateString('de-DE', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    {comment.content}
                  </p>

                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-4 pl-4 border-l-2 border-gray-200 space-y-4">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="flex gap-3">
                          <div className="flex-shrink-0">
                            {reply.user.image ? (
                              <Image
                                src={reply.user.image}
                                alt={reply.user.name}
                                width={32}
                                height={32}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold text-sm">
                                {reply.user.name[0]}
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm">{reply.user.name}</span>
                              <span className="text-xs text-gray-500">
                                {new Date(reply.createdAt).toLocaleDateString('de-DE')}
                              </span>
                            </div>
                            <p className="text-gray-700 text-sm">{reply.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
