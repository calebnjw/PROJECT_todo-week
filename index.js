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

/* Luxon for date / time */
import { DateTime } from 'luxon';
const dayFormat = { weekday: 'long' };
const dateFormat = { day: 'numeric', month: 'numeric', year: 'numeric' };

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
// global variables-------------- //
// ------------------------------ //
const today = DateTime.now();

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
  response.redirect('/tasks');
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
  const existingUserQuery = `SELECT user_id FROM users WHERE username = '${username}';`

  pool.query(existingUserQuery)
    .then((result) => {
      if (result.rows.length !== 0) {
        response.status(403).send('Username is in use.');
      } else {
        const hashedPassword = getHashed(password); // hashing password entered
        const signupQuery = `INSERT INTO users 
          (first_name, last_name, username, password)
          VALUES ('${first_name}', '${last_name}', '${username}', '${hashedPassword}');`;

        pool.query(signupQuery); // save user to databse

        response.redirect('login'); // redirect them to login page
      }
    });
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
  const loginQuery = `SELECT user_id, password FROM users WHERE username='${username}';`;

  // look up data from users
  pool.query(loginQuery)
    .then((result) => {
      if (result.rows.length === 0) { // no matching username
        console.log('Wrong username or password. Try again.');
        response.status(403).send('Wrong username or password. Try again.');
        return;
      }

      const enteredPassword = getHashed(password); // hash what the user has keyed in
      const { user_id, password: savedPassword } = result.rows[0] // get the hash from matching username

      if (enteredPassword !== savedPassword) { // hashed passwords don't match
        console.log('Wrong username or password. Try again.');
        response.status(403).send('Wrong username or password. Try again.');
        return;
      } else { // hashed passwords match
        console.log('Successfully logged in.');
        response.cookie('loggedIn', true); // set a cookie with login status
        response.cookie('userID', user_id); // set a cookie with login status
        response.redirect('/tasks'); // redirect them to todo list
      }
    })
    .catch((error) => {
      console.log(error);
      response.send(error);
    });
});

// ------------------------------ //
// middleware: user auth--------- //
// ------------------------------ //
app.use((request, response, next) => {
  request.isUserLoggedIn = false;

  if (request.cookies.loggedIn && request.cookies.userID) {
    request.isUserLoggedIn = true;
  }

  next();
});

// ------------------------------ //
// route: todo------------------- //
// ------------------------------ //
app.get('/tasks', (request, response) => {
  if (request.isUserLoggedIn) {
    console.log('GET: TASKS');

    // first get task lists with user ID and store as separate key:value pair (use inner join)
    // then get inner join of all tasks with list names
    // in EJS: 
    // display all columns for all lists with inputs
    // display button to create new lists and add users
    // if task has list name then show in list

    // these values are used to 'scroll' between dates / lists
    const n = !request.query.n ? 0 : Number(request.query.n); // for dates
    const m = !request.query.m ? 0 : Number(request.query.m); // for lists

    const { userID } = request.cookies;
    const listQuery = `SELECT list_users.user_id, lists.list_id, lists.list_name 
      FROM list_users
      INNER JOIN lists
      ON list_users.list_id=lists.list_id
      WHERE list_users.user_id=$1;`

    // output variable to store data from all queries
    // this output is sent to response.render after all queries are done
    const output = { n, m };

    pool.query(listQuery, [userID]) // query to get list of lists
      .then((result) => {
        output.lists = result.rows;
      }).then(() => {
        // this query only gets results with a list_id attached
        const getListTodoQuery = `SELECT tasks.task_id, tasks.user_id, tasks.task, tasks.task_date, tasks.task_state, 
          lists.list_id, lists.list_name
          FROM tasks
          INNER JOIN lists
          ON tasks.list_id=lists.list_id
          WHERE user_id=$1
          ORDER BY task_id;`;

        pool.query(getListTodoQuery, [userID]) // query to get list of tasks that are attached to lists
          .then((result) => {
            output.lists_tasks = result.rows;
          }).then(() => {
            // this query only gets results where there is no list_id
            const getDateTodoQuery = `SELECT * FROM tasks
              WHERE user_id=$1 AND list_id IS NULL
              ORDER BY task_id;`;

            pool.query(getDateTodoQuery, [userID]) // query to get list of tasks that are attached to dates
              .then((result) => {
                output.dates_tasks = result.rows;
                output.dates = [ // create the variable dates
                  {
                    weekday: today.plus({ days: n - 1 }).toLocaleString(dayFormat),
                    date: today.plus({ days: n - 1 }).setLocale('en-GB').toLocaleString(dateFormat)
                  },
                  {
                    weekday: today.plus({ days: n }).toLocaleString(dayFormat),
                    date: today.plus({ days: n }).setLocale('en-GB').toLocaleString(dateFormat)
                  },
                  {
                    weekday: today.plus({ days: n + 1 }).toLocaleString(dayFormat),
                    date: today.plus({ days: n + 1 }).setLocale('en-GB').toLocaleString(dateFormat)
                  },
                  {
                    weekday: today.plus({ days: n + 2 }).toLocaleString(dayFormat),
                    date: today.plus({ days: n + 2 }).setLocale('en-GB').toLocaleString(dateFormat)
                  },
                  {
                    weekday: today.plus({ days: n + 3 }).toLocaleString(dayFormat),
                    date: today.plus({ days: n + 3 }).setLocale('en-GB').toLocaleString(dateFormat)
                  }
                ];

                console.log('output', output);
                response.render('tasks', output);
              });
          });
      });
  } else {
    console.log('Not logged in, redirecting to login page.')
    response.status(403).redirect('login');
  }

});

app.post('/tasks/:day/:month/:year', (request, response) => { // creating new task
  console.log('POST: TASKS')

  const n = !request.query.n ? 0 : Number(request.query.n);
  const { month, day, year } = request.params;
  const date = `${day}/${month}/${year}`
  const { userID } = request.cookies;
  const { todo } = request.body;
  const createTodoQuery = `INSERT INTO tasks 
    (user_id, task, task_date, task_state) 
    VALUES ('${userID}', '${todo}', '${date}', false);`;

  pool.query(createTodoQuery)
    .then((result) => {
      setTimeout(() => { // set timeout because sometimes the page doesn't refresh properly.
        response.redirect(`/tasks?n=${n}`);
      }, 50);
    })
});

app.post('/tasks/:list', (request, response) => { // creating new task
  console.log('POST: TASKS')

  const n = !request.query.n ? 0 : Number(request.query.n);
  const { list } = request.params;
  const { userID } = request.cookies;
  const { todo } = request.body;
  const createTodoQuery = `INSERT INTO tasks 
    (user_id, task, task_date, task_state) 
    VALUES ('${userID}', '${todo}', '${date}', false);`;

  pool.query(createTodoQuery)
    .then((result) => {
      setTimeout(() => { // set timeout because sometimes the page doesn't refresh properly.
        response.redirect(`/tasks?n=${n}`);
      }, 50);
    })
});

app.put('/tasks/:task_id/complete', (request, response) => { // editing existing task
  console.log('PUT: TASKS');

  const n = !request.query.n ? 0 : Number(request.query.n);
  const { task_id } = request.params;
  const checkCompleteQuery = `SELECT task_state FROM tasks WHERE task_id=${task_id};`;

  pool.query(checkCompleteQuery)
    .then((result) => {
      let changeStatusQuery = `UPDATE tasks SET task_state=true WHERE task_id=${task_id};`;
      if (result.rows[0].task_state === false) {
        pool.query(changeStatusQuery);
      } else {
        changeStatusQuery = `UPDATE tasks SET task_state=false WHERE task_id=${task_id};`;
        pool.query(changeStatusQuery);
      }
      setTimeout(() => { // set timeout because sometimes the page doesn't refresh properly.
        response.redirect(`/tasks?n=${n}`);
      }, 50);
    })
});

app.delete('/tasks/:task_id', (request, response) => { // delete existing task
  console.log('DEL: TASKS')

  const n = !request.query.n ? 0 : Number(request.query.n);
  const { task_id } = request.params;
  const deleteTodoQuery = `DELETE FROM tasks WHERE task_id='${task_id}';`;

  pool.query(deleteTodoQuery);

  setTimeout(() => { // set timeout because sometimes the page doesn't refresh properly
    response.redirect(`/tasks?n=${n}`);
  }, 50);
});

// ------------------------------ //
// route: get / edit lists------- //
// ------------------------------ //
app.get('/list/create', (request, response) => {

});

app.post('/list/create', (request, response) => {

});

app.get('/list/edit', (request, response) => {

});

app.put('/list/edit', (request, response) => {

});

// ------------------------------ //
// route: logout----------------- //
// ------------------------------ //
app.delete('/logout', (request, response) => { // delete existing task
  if (request.isUserLoggedIn) {
    response.clearCookie('loggedIn');
    response.clearCookie('userID');
  }

  setTimeout(() => { // set timeout because sometimes the page doesn't refresh properly
    response.redirect('/login')
  }, 50);
});

// ------------------------------ //
// setting up server------------- //
// ------------------------------ //
/* app port and listen */
const PORT = 3004;
app.listen(PORT, () => {
  console.log(`app listening on port ${PORT}`);
});
