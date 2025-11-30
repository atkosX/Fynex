import neo4j from 'neo4j-driver';

const uri = process.env.NEO4J_URI;
const user = process.env.NEO4J_USER;
const password = process.env.NEO4J_PASSWORD;

if (!uri) {
  console.warn('NEO4J_URI is not defined');
}

if (!user || !password) {
  console.warn('NEO4J_USER or NEO4J_PASSWORD is not defined');
}

export const neo4jDriver = neo4j.driver(
  uri || '', // Fallback to empty string to avoid crash, but will fail to connect
  neo4j.auth.basic(user || '', password || '')
);

export async function getNeo4jSession() {
  return neo4jDriver.session();
}
