# First Administrator Bootstrap

The bootstrap command is development-only. It refuses to connect unless `MONGO_URL` names one explicit database, `BOOTSTRAP_ADMIN_CONFIRM_DATABASE` matches that database, and `BOOTSTRAP_ADMIN_CONFIRM_HOST` matches the URI host. Do not use the current Atlas URI until the owner has confirmed both the intended database and cluster; an absent database path can resolve to MongoDB's default `test` database.

Set `MONGO_URL` to the confirmed development database URI, then inject these values through the local shell or an approved secret manager:

```sh
export NODE_ENV=development
export BOOTSTRAP_ADMIN_CONFIRM_HOST='<confirmed-mongodb-host>'
export BOOTSTRAP_ADMIN_CONFIRM_DATABASE='<confirmed-database-name>'
export BOOTSTRAP_ADMIN_NAME='<administrator-name>'
export BOOTSTRAP_ADMIN_EMAIL='<administrator-email>'
read -r -s -p 'Initial administrator password: ' BOOTSTRAP_ADMIN_PASSWORD
printf '\n'
export BOOTSTRAP_ADMIN_PASSWORD
npm run bootstrap:admin
unset BOOTSTRAP_ADMIN_CONFIRM_HOST BOOTSTRAP_ADMIN_CONFIRM_DATABASE BOOTSTRAP_ADMIN_NAME BOOTSTRAP_ADMIN_EMAIL BOOTSTRAP_ADMIN_PASSWORD
```

Run the command from `backend/`. Passwords are never printed. Mongoose hashes the password using the existing bcrypt pre-save hook. The command refuses to run outside development, if an administrator already exists, or if the requested email belongs to any existing account. It does not promote existing customers.