const express = require('express')
const router = express.Router()

// In-memory store (resets on server restart — fine for testing)
const transactions = {}

// POST /api/payment/register
// Called by iOS app before opening UPI app
router.post('/register', (req, res) => {
  const { transactionId, amount } = req.body
  if (!transactionId || !amount) {
    return res.status(400).json({ error: 'transactionId and amount are required' })
  }
  transactions[transactionId] = {
    transactionId,
    amount,
    status: 'PENDING',
    receivedAt: null
  }
  console.log(`Registered transaction: ${transactionId} for ₹${amount}`)
  res.status(200).json({ message: 'registered' })
})

// GET /api/payment/status/:transactionId
// Called by iOS app while polling
router.get('/status/:transactionId', (req, res) => {
  const { transactionId } = req.params
  const txn = transactions[transactionId]
  if (!txn) {
    return res.status(404).json({ error: 'Transaction not found' })
  }
  res.status(200).json(txn)
})

// GET + POST /api/payment/callback
// Called by GPay/PhonePe after payment
router.get('/callback', (req, res) => {
  console.log('UPI Callback received (GET):', req.query)
  handleCallback(req.query, res)
})

router.post('/callback', (req, res) => {
  console.log('UPI Callback received (POST):', req.body)
  handleCallback({ ...req.body, ...req.query }, res)
})

function handleCallback(params, res) {
  // UPI apps send different param names — handle all variations
  const txnId = params.txnId || params.tr || params.transactionId
  const status = (params.Status || params.status || '').toUpperCase()

  console.log(`Callback — txnId: ${txnId}, status: ${status}`)

  if (txnId && transactions[txnId]) {
    if (status === 'SUCCESS' || status === 'SUCCESS') {
      transactions[txnId].status = 'SUCCESS'
    } else if (status === 'FAILURE' || status === 'FAILED') {
      transactions[txnId].status = 'FAILURE'
    }
    transactions[txnId].receivedAt = new Date().toISOString()
    transactions[txnId].rawCallback = params
  } else {
    console.log('Callback received for unknown transaction:', txnId)
    console.log('All known transactions:', Object.keys(transactions))
  }

  res.status(200).send('OK')
}

module.exports = router