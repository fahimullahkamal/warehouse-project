// hash.js (در پوشه ریشه پروژه)
const bcrypt = require('bcrypt');
const password = 'Admin@1370'; // رمز دلخواه خود را اینجا وارد کنید
bcrypt.hash(password, 10).then(hash => console.log(hash));