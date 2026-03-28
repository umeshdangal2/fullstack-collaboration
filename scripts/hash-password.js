#!/usr/bin/env node
"use strict";

const bcrypt = require("bcryptjs");

const pwd = process.argv[2];
if (!pwd || pwd.length < 8) {
  console.error("Usage: npm run hash-password -- <password>");
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

console.log(bcrypt.hashSync(pwd, 12));
