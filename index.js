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
import e from 'express';

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
});

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
  const existingUserQuery = `SELECT user_id FROM users WHERE username = $1;`

  pool.query(existingUserQuery, [username])
    .then((result) => {
      if (result.rows.length !== 0) {
        console.log('Username is in use.');
        response.status(403).send('Username is in use.');
      } else {
        const hashedPassword = getHashed(password); // hashing password entered
        const signupQuery = `INSERT INTO users 
          (first_name, last_name, username, password)
          VALUES ($1, $2, $3, $4);`;

        pool.query(signupQuery, [first_name, last_name, username, hashedPassword]); // save user to databse

        console.log('Singup success.');
        response.redirect('login'); // redirect them to login page
      };
    })
    .catch((error => {
      console.log(error);
      response.send(error);
    }));
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
  const loginQuery = `SELECT user_id, password FROM users WHERE username=$1;`;

  // look up data from users
  pool.query(loginQuery, [username])
    .then((result) => {
      if (result.rows.length === 0) { // no matching username
        console.log('Wrong username or password. Try again.');
        response.status(403).send('Wrong username or password. Try again.');
        return;
      };

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
      };
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
  };

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
      WHERE list_users.user_id=$1
      ORDER BY lists.list_id;`;

    // output variable to store data from all queries
    // this output is sent to response.render after all queries are done
    const output = { n, m };

    pool.query(listQuery, [userID]) // query to get list of lists
      .then((result) => {
        output.lists = result.rows;
      }).then(() => {
        // this query only gets results with a list_id attached (regardless of user_id)
        const getListTodoQuery = `SELECT * 
          FROM tasks
          WHERE list_id IS NOT NULL
          ORDER BY task_id;`;

        pool.query(getListTodoQuery) // query to get list of tasks that are attached to lists
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

                response.render('tasks', output);

              })
              .catch((error => {
                console.log(error);
                response.send(error);
              }));

          })
          .catch((error => {
            console.log(error);
            response.send(error);
          }));

      })
      .catch((error => {
        console.log(error);
        response.send(error);
      }));

  } else {
    console.log('Not logged in, redirecting to login page.')
    response.status(403).redirect('login');
  };
});

app.post('/tasks/:day/:month/:year', (request, response) => { // creating new task
  console.log('POST: TASKS');

  const n = !request.query.n ? 0 : Number(request.query.n);

  const { month, day, year } = request.params;
  const date = `${day}/${month}/${year}`;
  const { userID } = request.cookies;
  const { todo } = request.body;

  const createTodoQuery = `INSERT INTO tasks 
    (user_id, task, task_date, task_state) 
    VALUES ($1, $2, $3, false);`;

  pool.query(createTodoQuery, [userID, todo, date])
    .then((result) => {
      console.log('Task added to', date);
      setTimeout(() => { // set timeout because sometimes the page doesn't refresh properly.
        response.redirect(`/tasks?n=${n}`);
      }, 50);
    })
    .catch((error => {
      console.log(error);
      response.send(error);
    }));
});

app.post('/tasks/:list_id', (request, response) => { // creating new task
  console.log('POST: TASKS');

  const n = !request.query.n ? 0 : Number(request.query.n);

  const { list_id } = request.params;
  const { userID } = request.cookies;
  const { todo } = request.body;

  const createTodoQuery = `INSERT INTO tasks 
    (user_id, list_id, task, task_state) 
    VALUES ($1, $2, $3, false);`;

  pool.query(createTodoQuery, [userID, list_id, todo])
    .then((result) => {
      console.log('QUERY SUCCESS');
      setTimeout(() => { // set timeout because sometimes the page doesn't refresh properly.
        response.redirect(`/tasks?n=${n}`);
      }, 50);
    })
    .catch((error => {
      console.log(error);
      response.send(error);
    }));
});

app.put('/tasks/:task_id/complete', (request, response) => { // editing existing task
  console.log('PUT: TASKS');

  const n = !request.query.n ? 0 : Number(request.query.n);

  const { task_id } = request.params;

  const checkCompleteQuery = `SELECT task_state FROM tasks WHERE task_id=$1;`;

  pool.query(checkCompleteQuery, [task_id])
    .then((result) => {
      let changeStatusQuery = `UPDATE tasks SET task_state=true WHERE task_id=$1;`;
      if (result.rows[0].task_state === false) {
        console.log('Task marked as complete.');
        pool.query(changeStatusQuery, [task_id]);
      } else {
        changeStatusQuery = `UPDATE tasks SET task_state=false WHERE task_id=$1;`;
        console.log('Task marked as incomplete.');
        pool.query(changeStatusQuery, [task_id]);
      }
      setTimeout(() => { // set timeout because sometimes the page doesn't refresh properly.
        response.redirect(`/tasks?n=${n}`);
      }, 50);
    })
    .catch((error => {
      console.log(error);
      response.send(error);
    }));
});

app.delete('/tasks/:task_id', (request, response) => { // delete existing task
  console.log('DEL: TASKS');

  const n = !request.query.n ? 0 : Number(request.query.n);

  const { task_id } = request.params;

  const deleteTodoQuery = `DELETE FROM tasks WHERE task_id=$1;`;

  pool.query(deleteTodoQuery, [task_id])
    .then(() => {
      console.log('Task deleted:', task_id);
    })
    .catch((error => {
      console.log(error);
      response.send(error);
    }));

  setTimeout(() => { // set timeout because sometimes the page doesn't refresh properly
    response.redirect(`/tasks?n=${n}`);
  }, 50);
});

// ------------------------------ //
// route: create / edit lists---- //
// ------------------------------ //
// get create list
app.get('/list/create', (request, response) => {
  console.log('GET: LIST CREATE');

  response.render('list-create');
});

app.post('/list/create', (request, response) => {
  console.log('POST: LIST CREATE');

  // create list
  // get list id
  // make association in list_users

  const { list_name } = request.body;
  const user_id = Number(request.cookies.userID);

  const createListQuery = `INSERT INTO lists (list_name) 
    VALUES ($1)
    RETURNING list_id;`;

  pool.query(createListQuery, [list_name])
    .then((result) => {
      console.log('List created.');
      const { list_id } = result.rows[0]
      const addUserQuery = `INSERT INTO list_users (user_id, list_id)
        VALUES ($1, $2);`;

      pool.query(addUserQuery, [user_id, list_id])
        .then(() => {
          console.log('Added user to list.');
          response.redirect(`/list/edit/${list_id}`);
        });
    })
    .catch((error => {
      console.log(error);
      response.send(error);
    }));

});

// get edit list
app.get('/list/edit/:list_id', (request, response) => {
  console.log('GET: LIST EDIT');

  const currentUser = Number(request.cookies.userID);
  const { list_id } = request.params;

  const output = { currentUser, list_id };
  const listQuery = `SELECT list_name 
    FROM lists
    WHERE lists.list_id=$1;`;

  // get list name using list_id
  // then get list of users + user_id
  // in ejs: 
  // render a form that will lead to 
  // should render each user in the list as a list group 
  // with delete user button

  pool.query(listQuery, [list_id])
    .then((result) => {
      output.list_name = result.rows[0].list_name;
    })
    .then(() => {
      const userQuery = `SELECT users.user_id, users.username
      FROM users
      INNER JOIN list_users
      ON list_users.user_id = users.user_id
      WHERE list_users.list_id=$1;`;

      pool.query(userQuery, [list_id])
        .then((result) => {
          output.usernames = [];
          result.rows.forEach(({ user_id, username }) => {
            output.usernames.push({ user_id, username });
          });

          response.render('list-edit', output);
        })
        .catch((error => {
          console.log(error);
          response.send(error);
        }));
    })
    .catch((error => {
      console.log(error);
      response.send(error);
    }));
});

// to change list name
app.put('/list/rename/:list_id', (request, response) => {
  console.log('POST: LIST EDIT');

  const { list_id } = request.params;
  const { list_name } = request.body;

  // update value of list_name at list_id
  // UPDATE [table] SET[column] = [value] WHERE[column] = [value];
  const updateNameQuery = `UPDATE lists 
    SET list_name=$1 
    WHERE list_id=$2;`;

  pool.query(updateNameQuery, [list_name, list_id])
    .then(() => {
      console.log('List renamed!');
      response.redirect('/tasks');
    })
    .catch((error => {
      console.log(error);
      response.send(error);
    }));
});

// to add users
app.put('/list/add/:list_id/', (request, response) => {
  console.log('POST: LIST EDIT - ADD USER')

  const currentUser = Number(request.cookies.userID);
  const { list_id } = request.params;
  const { username } = request.body;
  // to add users: 
  // look for username entered,
  // if it exists, get user_id
  // create association in list_users
  // if not, say user does not exist

  const userQuery = `SELECT user_id FROM users WHERE username=$1;`
  pool.query(userQuery, [username])
    .then((result) => {
      console.log(result.rows);
      if (result.rows.length === 0) {
        console.log('No user found');
        response.status(403).send('No user with that username found.');
      }

      const { user_id } = result.rows[0];
      if (user_id === currentUser) {
        console.log(`You're already in the list!`);
        response.status(403).send(`You're already in the list!`);
      } else {
        const addUserQuery = `INSERT INTO list_users (user_id, list_id)
          VALUES ($1, $2);`;

        pool.query(addUserQuery, [user_id, list_id])
          .then(() => {
            console.log('Added user to list.');
            response.redirect(`/list/edit/${list_id}`);
          })
          .catch((error => {
            console.log(error);
            response.send(error);
          }));
      }
    })
    .catch((error => {
      console.log(error);
      response.send(error);
    }));
});

// to delete users (sub form)
app.delete('/list/delete/:list_id/:user_id', (request, response) => {
  console.log('POST: LIST EDIT - ADD USER')

  const { list_id, user_id } = request.params;

  // delete user_id from list_user where list_id = list_id
  const deleteUserQuery = `DELETE FROM list_users
    WHERE list_id=$1
    AND user_id=$2;`;

  pool.query(deleteUserQuery, [list_id, user_id])
    .then(() => {
      console.log('Removed user:', user_id);
      response.redirect(`/list/edit/${list_id}`);
    })
    .catch((error => {
      console.log(error);
      response.send(error);
    }));
});

app.delete('/list/delete/:list_id', (request, response) => {
  console.log('DELETE: LIST')

  const { list_id } = request.params;
  // delete list_id from lists
  // delete list_id from list_users

  const deleteQuery = `
    DELETE FROM lists WHERE list_id='${list_id}';
    DELETE FROM list_users WHERE list_id='${list_id}';`

  pool.query(deleteQuery)
    .then(() => {
      response.redirect('/tasks');
    })
    .catch((error => {
      console.log(error);
      response.send(error);
    }))
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
