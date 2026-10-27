# QuickNotes Data Model

## Entities

### users
| Column | Type | Key / rule |
|--------|------|-----------|
| id | INTEGER | Primary key |
| name | TEXT | NOT NULL |
| email | TEXT | NOT NULL, UNIQUE |
| password_hash | TEXT | NOT NULL (never store plain passwords) |
| created_at | DATETIME | NOT NULL, defaults to now |

### notes
| Column | Type | Key / rule |
|--------|------|-----------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to users(id), NOT NULL |
| title | TEXT | NOT NULL, maximum 100 characters |
| body | TEXT | Optional |
| created_at | DATETIME | NOT NULL, defaults to now |
| updated_at | DATETIME | NOT NULL, defaults to now |

### tags
| Column | Type | Key / rule |
|--------|------|-----------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to users(id), NOT NULL |
| name | TEXT | NOT NULL, unique per user |

### note_tags
| Column | Type | Key / rule |
|--------|------|-----------|
| note_id | INTEGER | Foreign key to notes(id), part of the primary key |
| tag_id | INTEGER | Foreign key to tags(id), part of the primary key |

The primary key of `note_tags` is the pair `(note_id, tag_id)`, which also stops the same tag being attached to the same note twice.

## Relationships

- **users to notes: one-to-many.** One user can write many notes, but each note belongs to exactly one user.
- **users to tags: one-to-many.** One user can create many tags, and each tag belongs to one user.
- **notes to tags: many-to-many.** A note can have many tags (for example "school" and "urgent"), and a tag can be used on many notes. A many-to-many relationship cannot be stored directly in either table, so the join table `note_tags` holds one row for each note and tag pairing.

## CREATE TABLE statements

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL CHECK (length(title) <= 100),
    body TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
    note_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);

CREATE INDEX idx_notes_user_created ON notes (user_id, created_at);
```

## Example queries

**1. Latest 10 notes for one user (used by GET /notes):**

```sql
SELECT id, title, body, created_at
FROM notes
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 10;
```

**2. All notes with their tags (JOIN):**

```sql
SELECT n.id, n.title, t.name AS tag
FROM notes n
JOIN note_tags nt ON nt.note_id = n.id
JOIN tags t ON t.id = nt.tag_id
WHERE n.user_id = 1
ORDER BY n.created_at DESC;
```

**3. Number of notes per tag (including tags with no notes):**

```sql
SELECT t.name, COUNT(nt.note_id) AS note_count
FROM tags t
LEFT JOIN note_tags nt ON nt.tag_id = t.id
WHERE t.user_id = 1
GROUP BY t.id, t.name;
```

**4. Update a note's title (used by PUT /notes/{id}):**

```sql
UPDATE notes
SET title = 'Buy groceries today', updated_at = CURRENT_TIMESTAMP
WHERE id = 42 AND user_id = 1;
```

## Index

`CREATE INDEX idx_notes_user_created ON notes (user_id, created_at);`

The most common request is "show this user's newest notes" (`GET /notes`), which filters by `user_id` and sorts by `created_at`. Without the index the database would scan every note of all 1 million users; with it, the database jumps straight to the user's notes already in date order. The cost is a little extra storage and slightly slower writes, which is acceptable because QuickNotes is read-heavy.

## SQL or NoSQL?

I choose **SQL** (a relational database such as PostgreSQL or MySQL). QuickNotes data is structured and connected: users own notes, and notes and tags link in a many-to-many way. A relational database enforces these links with foreign keys, keeps emails unique, and answers questions across tables, like "how many notes does each tag have", with JOIN and GROUP BY. The data also needs to be correct, since a user's notes must never be lost or attached to the wrong account. A NoSQL document store would suit very large, loosely structured data, but it would move these integrity checks into application code, and at this scale (about 180 GB per year) one relational database with read replicas is more than enough.