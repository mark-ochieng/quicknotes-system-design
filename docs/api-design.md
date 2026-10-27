# QuickNotes API Design

This document describes the real REST API the backend team should build for QuickNotes. It is not the JSONPlaceholder practice API used by the front-end demo.

- Base URL: `https://api.quicknotes.com/v1`
- Format: JSON requests and responses (`Content-Type: application/json`)
- Authentication: after login, the client sends `Authorization: Bearer <token>` with every request except register and login
- Each user can only see and change their own notes

## Endpoints

| Method | Path | Description | Success status |
|--------|------|-------------|----------------|
| POST | `/auth/register` | Create a new user account | 201 Created |
| POST | `/auth/login` | Log in and receive an access token | 200 OK |
| GET | `/notes` | List the logged-in user's notes (supports `?page=`, `?limit=` and `?tag=`) | 200 OK |
| POST | `/notes` | Create a new note | 201 Created |
| GET | `/notes/{id}` | Get one note by id | 200 OK |
| PUT | `/notes/{id}` | Replace a note's title, body and tags | 200 OK |
| DELETE | `/notes/{id}` | Delete a note | 204 No Content |
| GET | `/tags` | List the user's tags | 200 OK |
| POST | `/notes/{id}/tags` | Attach a tag to a note | 201 Created |
| DELETE | `/notes/{id}/tags/{tagId}` | Remove a tag from a note | 204 No Content |

## Create a note

`POST /notes`

Request:

```json
{
  "title": "Buy groceries",
  "body": "Milk, eggs, bread",
  "tags": ["shopping", "home"]
}
```

Response: `201 Created`

```json
{
  "id": 42,
  "title": "Buy groceries",
  "body": "Milk, eggs, bread",
  "tags": ["shopping", "home"],
  "userId": 7,
  "createdAt": "2026-10-27T09:15:00Z",
  "updatedAt": "2026-10-27T09:15:00Z"
}
```

The response also includes a `Location: /v1/notes/42` header.

## List notes

`GET /notes?page=1&limit=10`

Response: `200 OK`

```json
{
  "data": [
    {
      "id": 42,
      "title": "Buy groceries",
      "body": "Milk, eggs, bread",
      "tags": ["shopping", "home"],
      "createdAt": "2026-10-27T09:15:00Z",
      "updatedAt": "2026-10-27T09:15:00Z"
    },
    {
      "id": 41,
      "title": "Study for Day 8",
      "body": "Review system design notes",
      "tags": ["school"],
      "createdAt": "2026-10-26T18:02:00Z",
      "updatedAt": "2026-10-26T18:02:00Z"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 2
}
```

## Error status codes

| Status | Meaning | When it happens |
|--------|---------|-----------------|
| 400 Bad Request | The request is invalid | Missing title, title longer than 100 characters, malformed JSON |
| 401 Unauthorized | Not logged in | Missing, expired or invalid token |
| 403 Forbidden | Logged in but not allowed | Trying to read or change another user's note |
| 404 Not Found | The resource does not exist | No note with that id |
| 409 Conflict | The data clashes with existing data | Registering with an email that is already used |
| 429 Too Many Requests | Rate limit exceeded | More than 100 requests per minute from one user or IP address |
| 500 Internal Server Error | The server failed | Unexpected bug or database failure |

All errors use the same body format, so the front end can handle them in one place.

Example `400 Bad Request` body:

```json
{
  "error": {
    "code": 400,
    "message": "Validation failed",
    "details": [
      { "field": "title", "problem": "Title is required and must be 100 characters or fewer" }
    ]
  }
}
```

Example `404 Not Found` body:

```json
{
  "error": {
    "code": 404,
    "message": "Note 999 was not found"
  }
}
```