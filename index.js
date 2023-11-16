import axios from 'axios';
import { mkConfig, generateCsv, asString } from "export-to-csv";
import { writeFile } from "node:fs";
import { Buffer } from "node:buffer";


const GRAPH_URL = "https://api.thegraph.com/subgraphs/name/shayanshiravani/pion-test"
let snapshots = []
const csvConfig = mkConfig({ useKeysAsHeaders: true, filename: "pion_snapshots" })

const getAccounts = async () => {
  let response = []
  let skip = 0
  while(true) {
    try {
      const query = `
        {
          accounts(
            first: 1000
            skip: ${skip}
          ) {
            address
          }
        }
      `
      const {
        data: { data },
        status
      } = await axios.post(GRAPH_URL, {
        query: query
      })
      if (status == 200 && data) {
        const {
          accounts,
        } = data
        if(accounts.length) {
          console.log(accounts.length)
          response = response.concat(accounts.reduce((result, a) => {
            result.push(a.address)
            return result
          }, []))
          skip += 1000
        } else {
          break
        }
      } else {
        throw { message: 'INVALID_SUBGRAPH_RESPONSE' }
      }
    } catch (error) {
      console.log(error.message)
    }
  }
  return response
}

const getSnapshot = async (account) => {
  try {
    const query = `
      {
        accountBalanceSnapshots(
          first: 1
          orderBy:block
          orderDirection:desc
          where: { 
            and: [
              {block_lte: 18426798},
              {account: "${account}"}
            ]
          }
        ) {
          block
          transaction
          amount
        }
        accountBalances(
          orderBy: block
          orderDirection: desc
          where: {
            account: "${account}"
          }
        ) {
          amount
        }
      }
    `
    const {
      data: { data },
      status
    } = await axios.post(GRAPH_URL, {
      query: query
    })
    if (status == 200 && data) {
      const {
        accountBalanceSnapshots,
        accountBalances
      } = data
      if(accountBalanceSnapshots.length) {
        const balanceSnapshot = accountBalanceSnapshots[0]
        const currentBalance = accountBalances[0]
        snapshots.push({
          address: account,
          snapshot_amount: balanceSnapshot.amount,
          current_amount: currentBalance.amount,
          balance_changed: balanceSnapshot.amount == currentBalance.amount ? false : true,
          snapshot_block: balanceSnapshot.block,
          snapshot_transaction: balanceSnapshot.transaction
        })
      } else {
        console.log(`There is no snapshot for account ${account}`)
      }
    } else {
      throw { message: 'INVALID_SUBGRAPH_RESPONSE' }
    }
  } catch (error) {
    console.log(`An error accourd in fetching snapshot of account ${account}`)
    console.log(error.message)
  }
}



const main = async () => {
  const accounts = await getAccounts()
  console.log(accounts.length)
  await Promise.all(accounts.map(async (account) => {
    return getSnapshot(account)
  }))

  const csv = generateCsv(csvConfig)(snapshots)
  const filename = `${csvConfig.filename}.csv`
  const csvBuffer = new Uint8Array(Buffer.from(asString(csv)))
  writeFile(filename, csvBuffer, (err) => {
    if (err) throw err
    console.log("file saved: ", filename)
  })
}

main()