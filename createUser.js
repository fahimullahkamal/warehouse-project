const bcrypt = require("bcrypt");
const saltRounds = 10;
const password = "admin43";
bcrypt.hash(password, saltRounds).then((hash) => {
  console.log("Hash:", hash);
});
