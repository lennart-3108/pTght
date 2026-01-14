import React, { useState, useMemo } from 'react';
import Avatar from './Avatar';
import { API_BASE } from '../config';

export default function CommentsSection({
  gameId,
  comments,
  setComments,
  newComment,
  setNewComment,
  commentLoading,
  setCommentLoading,
  likes,
  setLikes,
  hasLiked,
  setHasLiked,
  likeLoading,
  setLikeLoading,
  token,
  viewerId
}) {
  const [replyToComment, setReplyToComment] = useState(null);
  const [replyText, setReplyText] = useState('');
  
  const handleLike = async () => {
    if (likeLoading || !token) return;
    
    setLikeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/matches/${gameId}/like`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setLikes(data.count || 0);
        setHasLiked(data.hasLiked || false);
      }
    } catch (err) {
      console.error('Error liking match:', err);
    } finally {
      setLikeLoading(false);
    }
  };
  
  const handleCommentLike = async (commentId) => {
    if (!token) return;
    
    try {
      const res = await fetch(`${API_BASE}/comments/${commentId}/like`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setComments(comments.map(c => 
          c.id === commentId ? { ...c, likes: data.count, hasLiked: data.hasLiked } : c
        ));
      }
    } catch (err) {
      console.error('Error liking comment:', err);
    }
  };
  
  const handleCommentSubmit = async (e, parentCommentId = null) => {
    e.preventDefault();
    const text = parentCommentId ? replyText : newComment;
    if (!text.trim() || commentLoading || !token) return;
    
    setCommentLoading(true);
    try {
      const res = await fetch(`${API_BASE}/matches/${gameId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          text: text.trim(),
          parentCommentId 
        })
      });
      
      if (res.ok) {
        const newCommentData = await res.json();
        setComments([...comments, newCommentData]);
        if (parentCommentId) {
          setReplyText('');
          setReplyToComment(null);
        } else {
          setNewComment('');
        }
      } else {
        const error = await res.json();
        console.error('Error response:', error);
        alert('Fehler beim Speichern: ' + (error.error || 'Unbekannter Fehler'));
      }
    } catch (err) {
      console.error('Error posting comment:', err);
      alert('Netzwerkfehler beim Speichern des Kommentars');
    } finally {
      setCommentLoading(false);
    }
  };
  
  const commentThreads = useMemo(() => {
    const topLevel = comments.filter(c => !c.parentCommentId);
    return topLevel.map(parent => ({
      ...parent,
      replies: comments.filter(c => c.parentCommentId === parent.id)
    }));
  }, [comments]);
  
  const card = {
    background: '#0f2a20',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    color: '#fff'
  };
  
  const pill = {
    padding: '8px 16px',
    borderRadius: 999,
    border: '1px solid #2f6b57',
    background: '#0e2a22',
    color: '#9fd',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6
  };
  
  const pillActive = {
    ...pill,
    border: '2px solid #4af',
    background: 'rgba(68, 170, 255, 0.15)',
    color: '#4af'
  };
  
  const CommentItem = ({ comment, isReply = false }) => (
    <div
      style={{
        display: 'flex',
        gap: 12,
        marginBottom: 12,
        padding: 14,
        background: isReply ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        marginLeft: isReply ? 40 : 0
      }}
    >
      <Avatar
        userId={comment.userId}
        name={comment.userName || 'User'}
        size={isReply ? 36 : 42}
      />
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginBottom: 6
        }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#cfe' }}>
            {comment.userName || 'User'}
          </span>
          <span style={{ fontSize: 12, color: '#7a9' }}>
            {new Date(comment.createdAt).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
        <p style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.6,
          color: '#bcd',
          marginBottom: 8
        }}>
          {comment.text}
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => handleCommentLike(comment.id)}
            disabled={!token}
            style={{
              background: 'none',
              border: 'none',
              color: comment.hasLiked ? '#f4a460' : '#7a9',
              fontSize: 12,
              cursor: token ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 4,
              transition: 'all 0.2s'
            }}
          >
            {comment.hasLiked ? '❤️' : '🤍'} {comment.likes || 0}
          </button>
          {!isReply && token && (
            <button
              onClick={() => setReplyToComment(comment.id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#7a9',
                fontSize: 12,
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              💬 Antworten
            </button>
          )}
        </div>
        {replyToComment === comment.id && (
          <form 
            onSubmit={(e) => handleCommentSubmit(e, comment.id)} 
            style={{ display: 'flex', gap: 8, marginTop: 12 }}
          >
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Antworte..."
              disabled={commentLoading}
              autoFocus
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #2f6b57',
                borderRadius: 999,
                fontSize: 13,
                outline: 'none',
                background: '#0e2a22',
                color: '#fff'
              }}
            />
            <button
              type="submit"
              disabled={!replyText.trim() || commentLoading}
              style={{
                padding: '8px 16px',
                borderRadius: 999,
                border: 'none',
                backgroundColor: !replyText.trim() || commentLoading ? 'rgba(255,255,255,0.1)' : '#f4a460',
                color: !replyText.trim() || commentLoading ? '#7a9' : '#0f2a20',
                cursor: !replyText.trim() || commentLoading ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 700
              }}
            >
              Kommentieren
            </button>
            <button
              type="button"
              onClick={() => {
                setReplyToComment(null);
                setReplyText('');
              }}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border: '1px solid #2f6b57',
                backgroundColor: 'transparent',
                color: '#7a9',
                cursor: 'pointer',
                fontSize: 12
              }}
            >
              Abbrechen
            </button>
          </form>
        )}
      </div>
    </div>
  );
  
  return (
    <div style={card}>
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={handleLike}
          disabled={likeLoading || !token}
          style={{
            ...(hasLiked ? pillActive : pill),
            opacity: likeLoading ? 0.6 : 1,
            cursor: token ? 'pointer' : 'not-allowed'
          }}
        >
          <span style={{ fontSize: 18 }}>{hasLiked ? '❤️' : '🤍'}</span>
          <span>{likes} {likes === 1 ? 'Like' : 'Likes'}</span>
        </button>
      </div>
      
      <div>
        <h3 style={{ 
          fontSize: 20, 
          fontWeight: 700, 
          marginBottom: 16,
          color: '#9fd',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          💬 Kommentare ({comments.length})
        </h3>
        
        <div style={{ marginBottom: 20 }}>
          {commentThreads.length === 0 ? (
            <p style={{ color: '#7a9', fontStyle: 'italic', fontSize: 14 }}>
              Noch keine Kommentare. Sei der Erste!
            </p>
          ) : (
            commentThreads.map((thread) => (
              <div key={thread.id} style={{ marginBottom: 16 }}>
                <CommentItem comment={thread} />
                {thread.replies.map((reply) => (
                  <CommentItem key={reply.id} comment={reply} isReply={true} />
                ))}
              </div>
            ))
          )}
        </div>
        
        {token ? (
          <form onSubmit={handleCommentSubmit} style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Schreibe einen Kommentar..."
              disabled={commentLoading}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: '1px solid #2f6b57',
                borderRadius: 999,
                fontSize: 14,
                outline: 'none',
                background: '#0e2a22',
                color: '#fff',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#f4a460'}
              onBlur={(e) => e.target.style.borderColor = '#2f6b57'}
            />
            <button
              type="submit"
              disabled={!newComment.trim() || commentLoading}
              style={{
                padding: '12px 24px',
                borderRadius: 999,
                border: 'none',
                backgroundColor: !newComment.trim() || commentLoading ? 'rgba(255,255,255,0.1)' : '#f4a460',
                color: !newComment.trim() || commentLoading ? '#7a9' : '#0f2a20',
                cursor: !newComment.trim() || commentLoading ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 700,
                transition: 'all 0.2s'
              }}
            >
              {commentLoading ? 'Kommentieren...' : 'Kommentieren'}
            </button>
          </form>
        ) : (
          <p style={{ color: '#7a9', fontStyle: 'italic', fontSize: 14 }}>
            Bitte einloggen, um zu kommentieren.
          </p>
        )}
      </div>
    </div>
  );
}
