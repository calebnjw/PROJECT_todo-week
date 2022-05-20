// psql -d [database] -f [file_name].sql

// CREATE TABLE [table] ([column] [type], ...);
// CREATE TABLE IF NOT EXISTS [table] ([column] [type], ...); // create if no existing table
// SELECT * FROM [table] (WHERE [column]=[value]);
// SELECT * FROM [table] ORDER BY [column] ASC/DESC;
// SELECT [table1.column], [table2.column]... FROM [table1]
// >> INNER JOIN [table2] ON [table1.column]=[table2.column]
// INSERT INTO [table] ([column], [column]) VALUES ('[value]', '[value]');
// INSERT INTO [table] ([column], [column]) VALUES ('[value]', '[value]') RETURNING *;
// UPDATE [table] SET [column]=[value] WHERE [column]=[value];
// DELETE FROM [table] WHERE [column]=[value];
// ALTER TABLE [table] RENAME [column] TO [newName];
// ALTER TABLE [table] ADD [column] [type];

// route syntax
// app.get('/path/:parameter', (request, response) => {
//   const { parameter } = request.params; // get parameter from url
//   response.cookie('name', 'value'); // set cookie
//   request.cookies; // because of cookier parser, this will be an object with all cookies
//   response.render('page', { content });
// });

// query syntax
// const query = `SELECT * FROM cats;`;
// pool.query(query, (error, result) => {
//   console.log(result.rows);
// })

// read and write files
// import { readFile, writeFile } from 'fs';

// ------------------------------ //
// setting up app---------------- //
// ------------------------------ //
/* importing express and express packages */
import express from 'express';
import cookieParser from 'cookie-parser';
import methodOverride from 'method-override';
import jsSHA from 'jssha';

/* postgres */
import pg from 'pg';

/* create express app */
const app = express();

/* use express middleware */
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');

/* create postgres connection */
const { Pool } = pg; // postgresql

const pgConnectionConfigs = {
  user: 'calebnjw',
  host: 'localhost',
  database: 'todo',
  port: 5432, // Postgres server always runs on this port
};

const pool = new Pool(pgConnectionConfigs);

// ------------------------------ //
// helper functions-------------- //
// ------------------------------ //

/**
 * Function to get hash of input
 * @param {string} input input to be hashed
 * @returns              hash value of input
 */
const getHashed = (input) => {
  const hash = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
  hash.update(input);
  const output = hash.getHash('HEX');

  return output;
};

// ------------------------------ //
// route: home------------------- //
// ------------------------------ //
app.get('/', (request, response) => {
  response.redirect('login');
})

// ------------------------------ //
// route: signup----------------- //
// ------------------------------ //
app.get('/signup', (request, response) => {
  console.log('GET: SIGNUP');
  response.render('signup');
});

app.post('/signup', (request, response) => {
  console.log('POST: SIGNUP');

  const { first_name, last_name, username, password } = request.body; // contents of signup form
  const hashedPassword = getHashed(password); // hashing password entered
  const signupQuery = `INSERT INTO users 
    (first_name, last_name, username, password)
    VALUES ('${first_name}', '${last_name}', '${username}', '${hashedPassword}')`

  pool.query(signupQuery); // save user to databse

  response.redirect('login'); // redirect them to login page
});

// ------------------------------ //
// route: login------------------ //
// ------------------------------ //
app.get('/login', (request, response) => {
  console.log('GET: LOGIN');
  response.render('login');
});

app.post('/login', (request, response) => {
  console.log('POST: LOGIN');

  const { username, password } = request.body; // contents of login form
  const loginQuery = `SELECT password FROM users WHERE username='${username}'`

  pool.query(loginQuery) // look up data from users
    .then((result) => {
      if (result.rows.length === 0) { // no matching username
        console.log('Wrong username or password. Try again.');
        response.status(403).send('Wrong username or password. Try again.');
        return;
      }

      const enteredPassword = getHashed(password); // hash what the user has keyed in
      const { password: savedPassword } = result.rows[0] // get the hash from matching username

      if (enteredPassword !== savedPassword) { // hashed passwords don't match
        console.log('Wrong username or password. Try again.');
        response.status(403).send('Wrong username or password. Try again.');
        return;
      } else { // hashed passwords match
        console.log('Successfully logged in.')
        response.cookie('loggedIn', true); // set a cookie with login status
        response.redirect('/tasks'); // redirect them to todo list
      }
    })
});

// ------------------------------ //
// route: todo------------------- //
// ------------------------------ //
app.get('/tasks', (request, response) => {
  console.log('GET: TASKS');

  const getTodoQuery = `SELECT * FROM tasks`;
  // const getTodoQuery = `SELECT * FROM tasks WHERE user_id='${user_id}'`;

  pool.query(getTodoQuery)
    .then((result) => {
      const tasks = result.rows;

      response.render('tasks', { tasks });
    })
});

app.post('/tasks', (request, response) => { // creating new task
  console.log('POST: TASKS')

  const { todo } = request.body;
  const createTodoQuery = `INSERT INTO tasks 
    (task, task_state) 
    VALUES ('${todo}', false)`

  pool.query(createTodoQuery);
  response.redirect('/tasks');
});

app.put('/tasks/:index/complete', (request, response) => { // editing existing task
  console.log('PUT: TASKS')
});

app.delete('/tasks/:task_id', (request, response) => { // delete existing task
  console.log('DEL: TASKS')
  const { task_id } = request.params;

  const deleteTodoQuery = `DELETE FROM tasks WHERE task_id='${task_id}';`

  pool.query(deleteTodoQuery);
  response.redirect('/tasks')
});


// ------------------------------ //
// setting up server------------- //
// ------------------------------ //
/* app port and listen */
const PORT = 3004;
app.listen(PORT, () => {
  console.log(`app listening on port ${PORT}`);
});
