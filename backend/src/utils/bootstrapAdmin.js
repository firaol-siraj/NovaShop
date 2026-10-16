export class BootstrapAdminError extends Error {}

export function validateAdminBootstrapEnvironment(env) {
  if (env.NODE_ENV !== 'development') {
    throw new BootstrapAdminError('Admin bootstrap is only allowed in development.');
  }

  let databaseName;
  let databaseHost;
  try {
    const mongoUrl = new URL(env.MONGO_URL);
    if (!['mongodb:', 'mongodb+srv:'].includes(mongoUrl.protocol) || mongoUrl.searchParams.has('dbName')) {
      throw new Error();
    }
    databaseName = decodeURIComponent(mongoUrl.pathname.slice(1));
    databaseHost = mongoUrl.hostname;
  } catch {
    throw new BootstrapAdminError('MONGO_URL must identify a MongoDB database explicitly.');
  }

  if (!databaseName || databaseName.includes('/')) {
    throw new BootstrapAdminError('MONGO_URL must identify a MongoDB database explicitly.');
  }
  if (env.BOOTSTRAP_ADMIN_CONFIRM_DATABASE !== databaseName) {
    throw new BootstrapAdminError('Set BOOTSTRAP_ADMIN_CONFIRM_DATABASE to the exact database name before continuing.');
  }
  if (env.BOOTSTRAP_ADMIN_CONFIRM_HOST !== databaseHost) {
    throw new BootstrapAdminError('Set BOOTSTRAP_ADMIN_CONFIRM_HOST to the exact MongoDB host before continuing.');
  }

  const name = env.BOOTSTRAP_ADMIN_NAME?.trim();
  const email = env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!name || !email || !password) {
    throw new BootstrapAdminError('Provide BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, and BOOTSTRAP_ADMIN_PASSWORD.');
  }
  if (password.length < 12) {
    throw new BootstrapAdminError('The initial administrator password must be at least 12 characters long.');
  }

  return { mongoUrl: env.MONGO_URL, databaseName, databaseHost, name, email, password };
}

export async function createFirstAdmin({ User, name, email, password }) {
  if (await User.exists({ role: 'admin' })) {
    throw new BootstrapAdminError('An administrator already exists; bootstrap will not create another.');
  }
  if (await User.exists({ email: email.toLowerCase() })) {
    throw new BootstrapAdminError('An account already uses that email; bootstrap will not promote it.');
  }

  return User.create({
    name,
    email: email.toLowerCase(),
    password,
    role: 'admin',
  });
}