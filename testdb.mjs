import pool from './server/config/db.js'; pool.query('SELECT NOW()', (err,res)=>{if(err){console.log('ERR:'+err.message);}else{console.log(res.rows[0]);} process.exit(0);});
