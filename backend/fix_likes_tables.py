#!/usr/bin/env python3
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'sportsplatform.db.before_cleanup_379k')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Disable FK constraints
cursor.execute("PRAGMA foreign_keys = OFF")

# Drop tables in correct order (reverse dependency)
cursor.execute("DROP TABLE IF EXISTS comment_likes")
cursor.execute("DROP TABLE IF EXISTS match_comments")
cursor.execute("DROP TABLE IF EXISTS match_likes")

# Create match_likes with correct FK to matches
cursor.execute("""
CREATE TABLE match_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matchId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(matchId) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(matchId, userId)
)
""")
cursor.execute("CREATE INDEX idx_match_likes_matchId ON match_likes(matchId)")

# Create match_comments with correct FK to matches
cursor.execute("""
CREATE TABLE match_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matchId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  parentCommentId INTEGER,
  text TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(matchId) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(parentCommentId) REFERENCES match_comments(id) ON DELETE CASCADE
)
""")
cursor.execute("CREATE INDEX idx_match_comments_match_created ON match_comments(matchId, createdAt)")

# Create comment_likes
cursor.execute("""
CREATE TABLE comment_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  commentId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(commentId) REFERENCES match_comments(id) ON DELETE CASCADE,
  FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(commentId, userId)
)
""")
cursor.execute("CREATE INDEX idx_comment_likes_commentId ON comment_likes(commentId)")

conn.commit()

# Re-enable FK constraints
cursor.execute("PRAGMA foreign_keys = ON")

# Verify
cursor.execute("PRAGMA foreign_key_list(match_likes)")
fks = cursor.fetchall()
print("Foreign keys for match_likes:")
for fk in fks:
    print(f"  {fk}")

conn.close()
print("\n✓ Tables recreated successfully!")
