const express = require('express');
const { isAuthenticated } = require('../middleware/auth');

module.exports = function commentsRoutes(ctx) {
  const router = express.Router();
  const { knex } = ctx;

  // GET /api/matches/:matchId/comments - Get all comments for a match
  router.get('/matches/:matchId/comments', async (req, res) => {
    try {
      const { matchId } = req.params;
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      let userId = null;
      if (token) {
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
          userId = decoded.id;
        } catch (err) {}
      }
      
      const comments = await knex('match_comments')
        .join('users', 'match_comments.userId', 'users.id')
        .where({ matchId })
        .orderBy('match_comments.createdAt', 'asc')
        .select(
          'match_comments.id',
          'match_comments.text',
          'match_comments.userId',
          'match_comments.parentCommentId',
          'match_comments.createdAt',
          'users.username as userName'
        );
      
      // Count likes per comment from comment_likes table
      const commentIds = comments.map(c => c.id);
      if (commentIds.length) {
        const likeCounts = await knex('comment_likes')
          .whereIn('commentId', commentIds)
          .groupBy('commentId')
          .select('commentId')
          .count('* as likes');
        const likeMap = Object.fromEntries(likeCounts.map(r => [r.commentId, r.likes]));
        comments.forEach(c => c.likes = likeMap[c.id] || 0);
      } else {
        comments.forEach(c => c.likes = 0);
      }

      // Check if user has liked each comment
      if (userId) {
        const commentIds = comments.map(c => c.id);
        const userLikes = await knex('comment_likes')
          .whereIn('commentId', commentIds)
          .where({ userId })
          .select('commentId');
        const likedIds = new Set(userLikes.map(l => l.commentId));
        comments.forEach(c => c.hasLiked = likedIds.has(c.id));
      }
      
      res.json(comments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      res.status(500).json({ error: 'Failed to fetch comments' });
    }
  });

  // POST /api/matches/:matchId/comments - Add a comment to a match
  router.post('/matches/:matchId/comments', isAuthenticated, async (req, res) => {
    try {
      const { matchId } = req.params;
      const { text, parentCommentId } = req.body;
      const userId = req.user.id;
      
      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Comment text is required' });
      }
      
      const [commentId] = await knex('match_comments').insert({
        matchId,
        userId,
        text: text.trim(),
        parentCommentId: parentCommentId || null,
        createdAt: new Date().toISOString()
      });
      
      // Fetch the newly created comment with user info
      const newComment = await knex('match_comments')
        .join('users', 'match_comments.userId', 'users.id')
        .where({ 'match_comments.id': commentId })
        .first(
          'match_comments.id',
          'match_comments.text',
          'match_comments.userId',
          'match_comments.parentCommentId',
          'match_comments.createdAt',
          'users.username as userName'
        );
      
      newComment.likes = 0;
      newComment.hasLiked = false;
      
      res.status(201).json(newComment);
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  });

  // GET /api/matches/:matchId/likes - Get likes count and user's like status
  router.get('/matches/:matchId/likes', async (req, res) => {
    try {
      const { matchId } = req.params;
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      let userId = null;
      if (token) {
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
          userId = decoded.id;
        } catch (err) {
          // Token invalid, continue without userId
        }
      }
      
      const count = await knex('match_likes')
        .where({ matchId })
        .count('* as count')
        .first();
      
      let hasLiked = false;
      if (userId) {
        const like = await knex('match_likes')
          .where({ matchId, userId })
          .first();
        hasLiked = !!like;
      }
      
      res.json({
        count: count?.count || 0,
        hasLiked
      });
    } catch (error) {
      console.error('Error fetching likes:', error);
      res.status(500).json({ error: 'Failed to fetch likes' });
    }
  });

  // PUT /api/matches/:matchId/like - Toggle like for a match
  router.put('/matches/:matchId/like', isAuthenticated, async (req, res) => {
    try {
      const { matchId } = req.params;
      const userId = req.user.id;
      
      // Check if user already liked
      const existingLike = await knex('match_likes')
        .where({ matchId, userId })
        .first();
      
      if (existingLike) {
        // Unlike
        await knex('match_likes')
          .where({ matchId, userId })
          .delete();
      } else {
        // Like
        await knex('match_likes').insert({
          matchId,
          userId,
          createdAt: new Date().toISOString()
        });
      }
      
      // Get updated count
      const count = await knex('match_likes')
        .where({ matchId })
        .count('* as count')
        .first();
      
      res.json({
        count: count?.count || 0,
        hasLiked: !existingLike
      });
    } catch (error) {
      console.error('Error toggling like:', error);
      res.status(500).json({ error: 'Failed to toggle like' });
    }
  });

  // PUT /api/comments/:commentId/like - Toggle like for a comment
  router.put('/comments/:commentId/like', isAuthenticated, async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = req.user.id;
      
      const existingLike = await knex('comment_likes')
        .where({ commentId, userId })
        .first();
      
      if (existingLike) {
        await knex('comment_likes')
          .where({ commentId, userId })
          .delete();
      } else {
        await knex('comment_likes').insert({
          commentId,
          userId,
          createdAt: new Date().toISOString()
        });
      }
      
      const countRow = await knex('comment_likes')
        .where({ commentId })
        .count('* as count')
        .first();
      
      res.json({
        count: countRow?.count || 0,
        hasLiked: !existingLike
      });
    } catch (error) {
      console.error('Error toggling comment like:', error);
      res.status(500).json({ error: 'Failed to toggle comment like' });
    }
  });

  return router;
};
