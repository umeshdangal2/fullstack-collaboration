"use strict";

const fs = require("fs/promises");
const crypto = require("crypto");

const BLOG_KV_KEY = "portfolio:blog:v1";
const PROJECTS_KV_KEY = "portfolio:projects:v1";

let redisClient = null;
let redisChecked = false;

function getRedis() {
  if (redisChecked) return redisClient;
  redisChecked = true;
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) {
    try {
      const { Redis } = require("@upstash/redis");
      redisClient = new Redis({ url, token });
    } catch (e) {
      console.warn("@upstash/redis unavailable:", e.message);
      redisClient = null;
    }
  }
  return redisClient;
}

/** On Vercel, disk writes are not persistent — Redis (REST) is required for admin saves. */
function persistenceAvailable() {
  if (process.env.VERCEL && !getRedis()) return false;
  return true;
}

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw e;
  }
}

async function atomicWriteJson(filePath, obj) {
  const json = JSON.stringify(obj, null, 2);
  const tmp = `${filePath}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  await fs.writeFile(tmp, json, "utf8");
  await fs.rename(tmp, filePath);
}

function normalizeRedisJson(data) {
  if (data == null) return null;
  if (typeof data === "object") return data;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return null;
}

async function readBlog(blogFile) {
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get(BLOG_KV_KEY);
    const data = normalizeRedisJson(raw);
    if (data && Array.isArray(data.posts)) return data;
  }
  return readJsonSafe(blogFile, { posts: [] });
}

async function writeBlog(blogFile, data) {
  const redis = getRedis();
  if (redis) {
    await redis.set(BLOG_KV_KEY, data);
    return;
  }
  await atomicWriteJson(blogFile, data);
}

async function readProjects(projectsFile) {
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get(PROJECTS_KV_KEY);
    const data = normalizeRedisJson(raw);
    if (data && Array.isArray(data.items)) return data;
  }
  return readJsonSafe(projectsFile, { items: [] });
}

async function writeProjects(projectsFile, data) {
  const redis = getRedis();
  if (redis) {
    await redis.set(PROJECTS_KV_KEY, data);
    return;
  }
  await atomicWriteJson(projectsFile, data);
}

module.exports = {
  getRedis,
  persistenceAvailable,
  readBlog,
  writeBlog,
  readProjects,
  writeProjects,
  readJsonSafe,
  atomicWriteJson,
};
