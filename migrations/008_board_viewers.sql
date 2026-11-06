-- Run against the existing Savvit database after taking a backup.
-- MySQL DDL commits implicitly. Both statements are safe to rerun after interruption.
ALTER TABLE boards MODIFY COLUMN visibility ENUM('public','private','semi-private') DEFAULT 'public';
CREATE TABLE IF NOT EXISTS board_viewers (
  board_id INT NOT NULL,
  user_id INT NOT NULL,
  PRIMARY KEY (board_id, user_id),
  CONSTRAINT board_viewers_board_fk FOREIGN KEY (board_id) REFERENCES boards(board_id) ON DELETE CASCADE,
  CONSTRAINT board_viewers_user_fk FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;
