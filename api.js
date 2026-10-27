const API_URL = "https://jsonplaceholder.typicode.com/posts";
const MAX_TITLE_LENGTH = 100;

const loadBtn = document.getElementById("load-btn");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");
const form = document.getElementById("note-form");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const notesList = document.getElementById("notes-list");

const createdLocally = new Set();

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = type || "";
}

function setBusy(isBusy) {
  loadBtn.disabled = isBusy;
  submitBtn.disabled = isBusy;
  document.querySelectorAll(".delete-btn").forEach(function (button) {
    button.disabled = isBusy;
  });
}

function friendlyError(error, action) {
  if (error instanceof TypeError) {
    return "Could not reach the server. Check your internet connection and try again.";
  }
  return "Sorry, we could not " + action + ". " + error.message + ".";
}

async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error("The server replied with status " + response.status);
  }
  const data = await response.json();
  return { status: response.status, data: data };
}

function showEmptyState() {
  const item = document.createElement("li");
  item.className = "empty";
  item.textContent = "No notes to show yet.";
  notesList.appendChild(item);
}

function removeEmptyState() {
  const empty = notesList.querySelector(".empty");
  if (empty) {
    empty.remove();
  }
}

function createNoteItem(note) {
  const item = document.createElement("li");
  item.className = "note";

  const title = document.createElement("h3");
  title.textContent = note.title;

  const body = document.createElement("p");
  body.textContent = note.body || "";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", function () {
    deleteNote(note.id, item);
  });

  item.appendChild(title);
  item.appendChild(body);
  item.appendChild(deleteBtn);
  return item;
}

function renderNotes(notes) {
  notesList.textContent = "";
  if (notes.length === 0) {
    showEmptyState();
    return;
  }
  notes.forEach(function (note) {
    notesList.appendChild(createNoteItem(note));
  });
}

async function loadNotes() {
  setBusy(true);
  setStatus("Loading notes...", "loading");
  try {
    const result = await request(API_URL + "?_limit=10");
    renderNotes(result.data);
    if (result.data.length === 0) {
      setStatus("The server has no notes yet.", "success");
    } else {
      setStatus("Loaded " + result.data.length + " notes from the server.", "success");
    }
  } catch (error) {
    setStatus(friendlyError(error, "load the notes"), "error");
  } finally {
    setBusy(false);
  }
}

function validateTitle(title) {
  if (title.length === 0) {
    return "Please enter a title.";
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return "The title must be " + MAX_TITLE_LENGTH + " characters or fewer (currently " + title.length + ").";
  }
  return "";
}

async function createNote(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  const problem = validateTitle(title);
  if (problem) {
    setStatus(problem, "error");
    titleInput.focus();
    return;
  }

  setBusy(true);
  setStatus("Saving note...", "loading");
  try {
    const result = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ title: title, body: body, userId: 1 })
    });
    createdLocally.add(result.data.id);
    removeEmptyState();
    notesList.prepend(createNoteItem(result.data));
    form.reset();
    setStatus("Note created (status " + result.status + ", id " + result.data.id + ").", "success");
  } catch (error) {
    setStatus(friendlyError(error, "create the note"), "error");
  } finally {
    setBusy(false);
  }
}

/*
  JSONPlaceholder is a practice API: it accepts POST requests and returns a
  new id (101), but it does not really save the note. Asking the server to
  delete that id later would not work as expected. So notes created in this
  session are removed from the page only, while notes loaded from the server
  are deleted with a real DELETE /posts/{id} request.
*/
async function deleteNote(id, item) {
  setBusy(true);
  try {
    if (createdLocally.has(id)) {
      createdLocally.delete(id);
      item.remove();
      setStatus("Note " + id + " removed (it only existed on this page, so no server request was needed).", "success");
    } else {
      setStatus("Deleting note " + id + "...", "loading");
      const result = await request(API_URL + "/" + id, { method: "DELETE" });
      item.remove();
      setStatus("Note " + id + " deleted (status " + result.status + ").", "success");
    }
    if (notesList.children.length === 0) {
      showEmptyState();
    }
  } catch (error) {
    setStatus(friendlyError(error, "delete the note"), "error");
  } finally {
    setBusy(false);
  }
}

loadBtn.addEventListener("click", loadNotes);
form.addEventListener("submit", createNote);