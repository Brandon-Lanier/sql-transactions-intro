const express = require('express');
const router = express.Router();

const pool = require('../modules/pool');

router.get('/', (req, res) => {
  const qryTxt = `
  SELECT account.name, SUM(register.amount) FROM account 
  JOIN register ON account.id = register.acct_id
  GROUP BY account.name;`;
  pool.query(qryTxt)
    .then(result => {
      console.log('got the balances', result.rows);
      res.send(result.rows)
    }).catch(err => {
      console.log('error getting balances', err);
    })
})

router.post('/transfer', async (req, res) => {
  const toId = req.body.toId;
  const fromId = req.body.fromId;
  const amount = req.body.amount;
  //Need to use the same connection for all queries
  const connection = await pool.connect();
  // basic JS try/catch/finally
  try {
    await connection.query('BEGIN');
    const sqlText = `
    INSERT INTO register (acct_id, amount)
    VALUES ($1, $2)
    `
    // use - amount for the withdrawal
    await connection.query(sqlText, [fromId, -amount])
    // Deposit
    await connection.query(sqlText, [toId, amount])
    await connection.query('COMMIT')
    res.sendStatus(200);
  } catch (error) {
    await connection.query('ROLLBACK');
    console.log('error in post', error);
    res.sendStatus(500)
  } finally {
    // always runs - both after successful try and after a catch
    // Put client connection back into pool
    // vERY IMPORTANT
    connection.release();
  }
})

router.post('/new', async (req, res) => {
  const name = req.body.name;
  const amount = req.body.amount;
  const connection = await pool.connect();
    try {
      await connection.query('BEGIN');
      const sqlAddAccount = `INSERT INTO account (name) VALUES ($1) RETURNING id;`
      // Save the result to get return value;
      const result = await pool.connect(sqlAddAccount, [name]);
      // Get the iid from the result
      const accountId = result.rows[0].id;
      const sqlInitialDeposit = `INSERT INTO register (acct_id, amount) VALUES ($1, $2);`;
      await connection.query(sqlInitialDeposit, [accountId, amount]);
      await connection.query('COMMIT');
    } catch (error) {
      await connection.query('ROLLBACK');
      console.log('Rolling Back', error);
      res.sendStatus(500)
    } finally {
      connection.release();
      res.sendStatus(200);
    }
})



module.exports = router;