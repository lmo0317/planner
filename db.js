const fs = require('fs').promises;
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'db.json');
let mutationQueue = Promise.resolve();

// Ensure database directory and file exist
async function initDb() {
  const dir = path.dirname(DB_FILE);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }

  try {
    await fs.access(DB_FILE);
  } catch (err) {
    // File doesn't exist, create it with empty structure
    await fs.writeFile(DB_FILE, JSON.stringify({ todos: [] }, null, 2), 'utf8');
  }
}

async function readDbUnlocked() {
  await initDb();
  const data = await fs.readFile(DB_FILE, 'utf8');
  return JSON.parse(data);
}

async function readDb() {
  await mutationQueue;
  return readDbUnlocked();
}

async function writeDb(data) {
  await initDb();
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function enqueueMutation(operation) {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.catch(() => {});
  return result;
}

// CRUD Operations
async function getAllTodos() {
  const db = await readDb();
  return db.todos;
}

async function getTodoById(id) {
  const db = await readDb();
  return db.todos.find(todo => todo.id === id);
}

async function createTodo(todoData) {
  return enqueueMutation(async () => {
    const db = await readDbUnlocked();
    const newTodo = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      title: todoData.title || 'Untitled Schedule',
      content: todoData.content || '',
      startDate: todoData.startDate || new Date().toISOString(),
      endDate: todoData.endDate || todoData.startDate || new Date().toISOString(),
      allDay: todoData.allDay === true,
      color: todoData.color || '#4f46e5',
      priority: todoData.priority || 'medium',
      completed: todoData.completed || false,
      category: todoData.category || 'general',
      dateReason: todoData.dateReason || '',
      evidence: todoData.evidence || '',
      confidence: Number.isFinite(todoData.confidence) ? todoData.confidence : null,
      createdAt: new Date().toISOString()
    };
    db.todos.push(newTodo);
    await writeDb(db);
    return newTodo;
  });
}

async function updateTodo(id, updateData) {
  return enqueueMutation(async () => {
    const db = await readDbUnlocked();
    const index = db.todos.findIndex(todo => todo.id === id);
    if (index === -1) return null;
    db.todos[index] = { ...db.todos[index], ...updateData, id };
    await writeDb(db);
    return db.todos[index];
  });
}

async function deleteTodo(id) {
  return enqueueMutation(async () => {
    const db = await readDbUnlocked();
    const initialLength = db.todos.length;
    db.todos = db.todos.filter(todo => todo.id !== id);
    if (db.todos.length === initialLength) return false;
    await writeDb(db);
    return true;
  });
}

module.exports = {
  initDb,
  getAllTodos,
  getTodoById,
  createTodo,
  updateTodo,
  deleteTodo
};
