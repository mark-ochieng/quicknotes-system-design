# QuickNotes Architecture

This document describes how QuickNotes can grow from a browser-only app into an online service used by 1 million people.

## Requirements

### Functional requirements
- Users can register and log in.
- Users can create, view, edit and delete their own notes.
- Users can add tags to notes and filter notes by tag.
- A user can only see their own notes.
- Slow background jobs, such as welcome emails and note exports, do not make the user wait.

### Non-functional requirements
- **Fast:** loading the notes list should take under 200 ms for most requests.
- **Available:** target of 99.9% uptime, with no single point of failure.
- **Scalable:** handle growth to 1 million registered users by adding servers, not by rewriting the app.
- **Secure:** HTTPS everywhere, hashed passwords, token authentication and rate limiting.
- **Durable:** saved notes must never be lost, so the database is backed up and replicated.

## Load estimate for 1 million users

**Assumptions**
- 1,000,000 registered users, 20% active on a given day = **200,000 daily active users (DAU)**
- Each active user creates 5 notes per day and loads their notes 20 times per day
- An average note is about 500 bytes
- 1 day is about 100,000 seconds (rounded); peak traffic is 5 times the average

**Calculation**
- Writes: 200,000 x 5 = 1,000,000 per day / 100,000 = **about 10 writes per second** (peak about 50)
- Reads: 200,000 x 20 = 4,000,000 per day / 100,000 = **about 40 reads per second** (peak about 200)
- Storage: 1,000,000 notes x 500 bytes = 500 MB per day; 500 MB x 365 = **about 180 GB per year**

**What this tells us:** the system is read-heavy (4 reads for every write), so caching and read replicas help a lot. About 200 requests per second at peak is easy for a few ordinary servers, and 180 GB per year fits in one well-configured database, so the design does not need to be enormous.

## Architecture diagram

```
                  (1) look up address
          +----------------------------------> +-----------------------------+
          |                                    | DNS: quicknotes.com -> IPs  |
          |                                    +-----------------------------+
+---------+-------+
| Browser /       |   (2) static files         +-----------------------------+
| mobile client   | -------------------------> | CDN (HTML, CSS, JS)         |
+---------+-------+                            +-----------------------------+
          |
          | (3) API calls (HTTPS, JSON)
          v
+-----------------+
| Load balancer   |  health checks + spreads requests
+--------+--------+
         |
   +-----+-------+----------+
   v             v          v
+-------+    +-------+  +-------+        +-----------------+
| App 1 |    | App 2 |  | App 3 | -----> | Cache (Redis)   |
+---+---+    +---+---+  +---+---+        +-----------------+
    |            |          |
    | writes     | reads    | background jobs
    v            v          v
+---------+  +-----------+  +---------+     +--------+
| Primary |->| Read      |  | Queue   |---->| Worker |  (emails, exports)
| DB      |  | replica(s)|  +---------+     +--------+
+---------+  +-----------+
   (copies every change to the replicas)
```

Every app server is stateless and talks to the same cache, database and queue, so any server can handle any request.

## Components, one sentence each

- **Client (browser or mobile app):** Shows the notes and sends the user's actions to the API.
- **DNS:** Turns the name quicknotes.com into the address of the right servers so users can find the service.
- **CDN:** Serves the static files (HTML, CSS, JavaScript) from servers close to the user, which lowers latency and takes load off our own servers.
- **Load balancer:** Spreads requests across several app servers and stops sending traffic to any server that fails its health check.
- **App servers (2 or more):** Run the API code, and because they are stateless, we can add more of them when traffic grows.
- **Cache (Redis):** Keeps recently read notes in memory so most reads are answered in about 1 ms without touching the database.
- **Primary database:** Holds the one true copy of the data and accepts all writes.
- **Read replica:** Holds a copy of the primary and answers read queries, so the primary is not overloaded and can be replaced if it fails.
- **Message queue:** Holds slow jobs such as emails and exports so the app server can reply to the user immediately.
- **Worker:** Takes jobs from the queue and does them in the background, so slow work never delays a user request.

## Request flows

### GET /notes (loading the notes list)
1. The client sends `GET /notes` with its token over HTTPS.
2. The request reaches the load balancer, which picks a healthy app server.
3. The app server checks the token and finds the user's id.
4. The app server looks for `notes:user:<id>` in the Redis cache.
5. **Cache hit:** the cached list is returned straight away (about 1 ms).
6. **Cache miss:** the app server queries a read replica, saves the result in Redis with an expiry time (TTL), and returns it.
7. The server replies `200 OK` with the notes as JSON.

### POST /notes (creating a note)
1. The client sends `POST /notes` with the title, body and token.
2. The load balancer forwards the request to any healthy app server.
3. The app server checks the token and validates the data (title required, at most 100 characters), returning `400` if it is invalid.
4. The app server writes the new note to the **primary** database, because only the primary accepts writes.
5. The app server deletes `notes:user:<id>` from the cache so the next read gets fresh data.
6. If extra work is needed (for example an export), the app server adds a job to the queue.
7. The server replies `201 Created` with the new note, and the primary copies the change to the replicas a few milliseconds later.

## Trade-offs

1. **Speed versus freshness (cache and replicas).** The cache and read replicas make reads fast, but they can briefly show slightly old data (replication lag, or a cached list that has not yet been cleared). A notes list that is a second out of date is acceptable for QuickNotes, so we accept it. For something like a bank balance it would not be.
2. **Simplicity versus scalability.** One server with a database is easy to build and run, but it cannot grow and it fails completely if it breaks. Multiple servers, a load balancer, a cache and replicas scale further and stay up, but they are harder to build, debug and pay for. At 200 requests per second peak, we use only the parts we need and do not add sharding or microservices.
3. **Cost versus reliability.** Extra app servers, replicas and a second region improve uptime but cost more money. We start with two or three app servers and one or two replicas, and add more as traffic grows.
4. **Consistency versus availability.** If the primary database fails, we promote a replica (failover) so the service keeps running, accepting that a few of the most recent writes might be missing from the replica.

## Avoiding single points of failure

| Component | Risk | How we avoid it |
|-----------|------|-----------------|
| App servers | One crashes | Run 2 or more stateless servers behind the load balancer, which skips unhealthy ones |
| Load balancer | It fails | Use a managed or redundant pair of load balancers |
| Database | The primary fails | Keep read replicas, and promote one to primary if needed (failover); take regular backups |
| Cache | Redis goes down | The app falls back to the database (slower, but still works), and Redis can run with a standby copy |
| Queue and worker | A worker dies | Jobs stay in the queue until a worker finishes them, and several workers can run |
| CDN and DNS | Outage | Use large providers with servers in many locations |

Because the app servers are stateless, losing one loses no data, and a replacement can be started automatically. Monitoring (logs, metrics and alerts) tells engineers about problems before most users notice.