// TEMPORARY in-memory storage. Everything here is lost when the server restarts.
// This will be replaced by a database in a later milestone.
export const jobs = [];

let nextId = 1;

// Returns 1, 2, 3, ... each time it is called.
export function getNextId() {
    return nextId++;
}
