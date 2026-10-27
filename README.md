# QuickNotes System Design

## Description

QuickNotes is a notes app that the company wants to turn from a browser-only app into an online service for 1 million users. This project has two parts:

1. **An API client** (HTML, CSS and JavaScript) that talks to the JSONPlaceholder practice API. It can load notes (GET), create notes (POST) and delete notes (DELETE), and it shows loading, success, error and empty states.
2. **Design documents** for the real QuickNotes backend: the REST API, the database model and the system architecture.

## How to run the API client

No installation is needed.

1. Download or clone this repository.
2. Open `index.html` in a web browser (on a phone, open the file from your files app, or use GitHub Pages).
3. Tap **Load notes** to fetch 10 notes from the server.
4. Use the form to add a note (the title is required and can be at most 100 characters).
5. Tap **Delete** on a note to remove it.

An internet connection is required because the client calls `https://jsonplaceholder.typicode.com/posts`. JSONPlaceholder does not really save changes, so notes you create exist only on the page.

## Project files

- `index.html` - page structure
- `style.css` - styling, including separate success and error message styles
- `api.js` - fetch requests, validation and page updates

## Design documents

- [API design](docs/api-design.md) - REST endpoints, JSON examples and error codes
- [Data model](docs/data-model.md) - tables, relationships, SQL, index and SQL vs NoSQL decision
- [Architecture](docs/architecture.md) - requirements, load estimate, diagram, request flows, trade-offs and single points of failure

## What I learned

- A reusable `request()` function that checks `response.ok` keeps error handling in one place instead of repeating it for every fetch call.
- Always showing the user what is happening (loading, success, error and empty states) and disabling buttons during requests makes an app feel reliable and prevents double submissions.
- Inserting user text with `textContent` instead of `innerHTML` protects against malicious scripts being injected into the page.
- Back-of-the-envelope estimates show whether a design needs 1 server or 1,000: QuickNotes is read-heavy, so caching and read replicas help far more than a huge setup.
- Every design choice has a trade-off (speed versus freshness, simplicity versus scalability, cost versus reliability), and good designs remove single points of failure.
-